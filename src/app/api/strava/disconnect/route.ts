import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE, deauthorize, refreshAccess } from "@/lib/strava";

/** Corta el vínculo: revoca el permiso en Strava y borra la cookie. */
export async function POST() {
  const jar = await cookies();
  const refresh = jar.get(TOKEN_COOKIE)?.value;

  if (refresh) {
    try {
      const token = await refreshAccess(refresh);
      await deauthorize(token.access_token);
    } catch (err) {
      // Si Strava no responde, igual se desvincula de este lado.
      console.error("[/api/strava/disconnect]", err);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(TOKEN_COOKIE);
  return res;
}
