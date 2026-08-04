import { NextResponse } from "next/server";
import {
  STATE_COOKIE,
  authorizeUrl,
  backToApp,
  cookieOpts,
  stravaConfigured,
} from "@/lib/strava";

/** Arranca el OAuth de Strava: manda al usuario a autorizar la app. */
export async function GET(request: Request) {
  if (!stravaConfigured()) {
    return NextResponse.redirect(backToApp(request, "nocfg"));
  }

  // `state` contra CSRF: se guarda en cookie y se compara al volver.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(request, state));
  res.cookies.set(STATE_COOKIE, state, cookieOpts(600));
  return res;
}
