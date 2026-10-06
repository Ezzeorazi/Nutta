import { init } from "@instantdb/admin";
import { NextResponse } from "next/server";
import { APP_ID } from "@/lib/appId";

/**
 * Corta las llamadas a la IA que no vienen de un usuario logueado.
 *
 * Devuelve `null` si la petición puede seguir, o la respuesta 401 para
 * devolver tal cual. El token lo manda `aiFetch` (ver `lib/aiFetch.ts`).
 *
 * Sin `INSTANT_ADMIN_TOKEN` no hay con qué verificar y se deja pasar con un
 * aviso en el log: preferible a que la IA se apague entera por una variable
 * de entorno faltante (en local, por ejemplo).
 */
export async function requireUser(request: Request): Promise<NextResponse | null> {
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;
  if (!adminToken) {
    console.warn("[apiAuth] Falta INSTANT_ADMIN_TOKEN: la ruta de IA queda sin verificar.");
    return null;
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      const user = await init({ appId: APP_ID, adminToken }).auth.verifyToken(token);
      if (user) return null;
    } catch {
      // token vencido o inválido: cae al 401
    }
  }
  return NextResponse.json({ error: "Iniciá sesión para usar la IA." }, { status: 401 });
}
