import { db } from "@/lib/db";

/**
 * `fetch` a las rutas de IA con la sesión adjunta.
 *
 * Esas rutas gastan la cuota de Groq: sin esto cualquiera podía llamarlas
 * desde afuera de la app. El servidor verifica el token con el SDK de admin
 * (ver `lib/apiAuth.ts`).
 */
export async function aiFetch(url: string, init: RequestInit = {}) {
  const user = await db.getAuth();
  const headers = new Headers(init.headers);
  if (user?.refresh_token) {
    headers.set("Authorization", `Bearer ${user.refresh_token}`);
  }
  return fetch(url, { ...init, headers });
}
