/**
 * Puente con Strava.
 *
 * Es el único camino público para sacar los entrenamientos de un reloj Xiaomi:
 * Xiaomi no publica API propia, pero Mi Fitness los empuja a Strava (Perfil →
 * Apps conectadas) y Strava sí tiene API abierta. De ahí los leemos.
 *
 * Todo este módulo es de SERVIDOR: usa el client secret, que nunca sale de acá.
 * El refresh token vive en una cookie httpOnly y no en InstantDB, porque la
 * base es cliente y ahí el token viajaría al navegador.
 */

const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_URL = "https://www.strava.com/api/v3";

/** Incluye las actividades marcadas como privadas (las de Mi Fitness suelen serlo). */
const SCOPE = "activity:read_all";

export const TOKEN_COOKIE = "nutta_strava_token";
export const STATE_COOKIE = "nutta_strava_state";

/** Un año: el refresh token no vence, pero la cookie sí necesita un límite. */
const TOKEN_MAX_AGE = 60 * 60 * 24 * 365;

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export const tokenCookieOpts = () => cookieOpts(TOKEN_MAX_AGE);

export const stravaConfigured = () =>
  !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

/**
 * Origen público de la app. Detrás de un proxy (Vercel) `request.url` puede
 * apuntar al host interno, así que mandan los headers reenviados.
 */
export function originOf(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(request.url).origin;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Vuelve a la app con el resultado del vínculo (`?strava=ok`, `…=denied`…). */
export const backToApp = (request: Request, status: string) =>
  `${originOf(request)}/?strava=${status}`;

const redirectUri = (request: Request) =>
  `${originOf(request)}/api/strava/callback`;

export function authorizeUrl(request: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? "",
    redirect_uri: redirectUri(request),
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

/** Error con el status de Strava, para distinguir "token revocado" (400) del resto. */
export class StravaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function token(extra: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...extra,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new StravaError(`token ${res.status}: ${await res.text()}`, res.status);
  }
  return (await res.json()) as TokenResponse;
}

export const exchangeCode = (code: string) =>
  token({ code, grant_type: "authorization_code" });

/** Canjea el refresh token por uno de acceso. Strava puede rotar el refresh. */
export const refreshAccess = (refreshToken: string) =>
  token({ refresh_token: refreshToken, grant_type: "refresh_token" });

/** Corta el vínculo del lado de Strava (además de borrar la cookie). */
export async function deauthorize(accessToken: string): Promise<void> {
  await fetch(`${API_URL}/oauth/deauthorize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

type SummaryActivity = {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  moving_time?: number;
  elapsed_time?: number;
  start_date: string; // instante real (UTC)
  start_date_local: string; // hora de pared del reloj, pero formateada con Z
  average_heartrate?: number;
  max_heartrate?: number;
  distance?: number;
};

/** Actividad ya traducida al formato de cardio de la app. */
export type ImportedActivity = {
  externalId: string;
  name: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  caloriesBurned: number;
  createdAt: number; // epoch ms del inicio
  avgHeartRate?: number;
  maxHeartRate?: number;
  distanceKm?: number;
};

/** Nombre lindo si la actividad vino sin título propio. */
const SPORT_ES: Record<string, string> = {
  Run: "Correr",
  TrailRun: "Trail",
  Walk: "Caminata",
  Hike: "Senderismo",
  Ride: "Bici",
  VirtualRide: "Bici indoor",
  MountainBikeRide: "Mountain bike",
  Swim: "Natación",
  Elliptical: "Elíptico",
  Rowing: "Remo",
  StairStepper: "Escaladora",
  WeightTraining: "Pesas",
  Workout: "Entrenamiento",
  Yoga: "Yoga",
  Soccer: "Fútbol",
};

async function get<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new StravaError(`GET ${path} → ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/**
 * Las calorías solo vienen en el detalle de cada actividad, no en el listado,
 * así que hay una request extra por entrenamiento. Con el tope de `max` queda
 * muy por debajo del límite de Strava (100 requests cada 15 min).
 */
async function caloriesOf(id: number, accessToken: string): Promise<number> {
  try {
    const detail = await get<{ calories?: number }>(
      `/activities/${id}?include_all_efforts=false`,
      accessToken,
    );
    return Math.max(0, Math.round(detail.calories ?? 0));
  } catch {
    return 0; // sin calorías es un dato menos, no un fallo de la importación
  }
}

/** Trae las actividades posteriores a `afterMs`, normalizadas. */
export async function fetchActivities(
  accessToken: string,
  afterMs: number,
  max = 30,
): Promise<ImportedActivity[]> {
  const after = Math.floor(afterMs / 1000);
  const list = await get<SummaryActivity[]>(
    `/athlete/activities?after=${after}&per_page=${max}`,
    accessToken,
  );
  const recent = list.slice(0, max);
  const calories = await Promise.all(
    recent.map((a) => caloriesOf(a.id, accessToken)),
  );

  return recent.map((a, i) => {
    const seconds = a.moving_time || a.elapsed_time || 0;
    const sport = a.sport_type ?? a.type ?? "";
    return {
      externalId: `strava:${a.id}`,
      name: a.name?.trim() || SPORT_ES[sport] || sport || "Entrenamiento",
      date: a.start_date_local.slice(0, 10),
      minutes: Math.max(1, Math.round(seconds / 60)),
      caloriesBurned: calories[i],
      createdAt: new Date(a.start_date).getTime(),
      ...(a.average_heartrate
        ? { avgHeartRate: Math.round(a.average_heartrate) }
        : {}),
      ...(a.max_heartrate ? { maxHeartRate: Math.round(a.max_heartrate) } : {}),
      ...(a.distance ? { distanceKm: Math.round(a.distance / 100) / 10 } : {}),
    };
  });
}
