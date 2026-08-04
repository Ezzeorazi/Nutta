import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  STATE_COOKIE,
  TOKEN_COOKIE,
  backToApp,
  exchangeCode,
  tokenCookieOpts,
} from "@/lib/strava";

/**
 * Vuelta del OAuth: canjea el código por el refresh token y lo deja en una
 * cookie httpOnly. Siempre termina de vuelta en la app con `?strava=<estado>`,
 * que es lo que lee la UI para avisar cómo salió.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const home = (status: string) =>
    NextResponse.redirect(backToApp(request, status));

  const code = params.get("code");
  if (params.get("error") || !code) return home("denied");

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  if (!expected || params.get("state") !== expected) return home("state");

  // Sin permiso de lectura de actividades no hay nada que importar.
  if (!(params.get("scope") ?? "").includes("activity:read")) {
    return home("scope");
  }

  try {
    const token = await exchangeCode(code);
    const res = home("ok");
    res.cookies.set(TOKEN_COOKIE, token.refresh_token, tokenCookieOpts());
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("[/api/strava/callback]", err);
    return home("error");
  }
}
