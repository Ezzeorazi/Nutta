import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  StravaError,
  TOKEN_COOKIE,
  fetchActivities,
  refreshAccess,
  tokenCookieOpts,
} from "@/lib/strava";

// Una request extra por actividad para las calorías: puede tardar.
export const maxDuration = 30;

/** Entrenamientos de los últimos `days` días (default 30, tope 365). */
export async function GET(request: Request) {
  const jar = await cookies();
  const refresh = jar.get(TOKEN_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ error: "No hay cuenta vinculada." }, { status: 401 });
  }

  const raw = Number(new URL(request.url).searchParams.get("days"));
  const days = Math.min(365, Math.max(1, Math.round(raw) || 30));

  try {
    const token = await refreshAccess(refresh);
    const activities = await fetchActivities(
      token.access_token,
      Date.now() - days * 86_400_000,
    );

    const res = NextResponse.json({ activities });
    // Strava rota el refresh token cada tanto: si cambió, se guarda el nuevo.
    if (token.refresh_token && token.refresh_token !== refresh) {
      res.cookies.set(TOKEN_COOKIE, token.refresh_token, tokenCookieOpts());
    }
    return res;
  } catch (err) {
    console.error("[/api/strava/activities]", err);

    // 400/401 al refrescar = el usuario revocó el permiso desde Strava.
    if (err instanceof StravaError && (err.status === 400 || err.status === 401)) {
      const res = NextResponse.json(
        { error: "Se cortó el vínculo con Strava. Volvé a conectarlo." },
        { status: 401 },
      );
      res.cookies.delete(TOKEN_COOKIE);
      return res;
    }

    return NextResponse.json(
      { error: "Strava no respondió. Probá de nuevo en un rato." },
      { status: 502 },
    );
  }
}
