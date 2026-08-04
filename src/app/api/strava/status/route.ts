import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE, stravaConfigured } from "@/lib/strava";

/**
 * Estado del vínculo, para que la UI sepa qué mostrar:
 * `configured` = el server tiene las claves de Strava,
 * `connected`  = este navegador ya autorizó la cuenta.
 */
export async function GET() {
  const jar = await cookies();
  return NextResponse.json({
    configured: stravaConfigured(),
    connected: !!jar.get(TOKEN_COOKIE)?.value,
  });
}
