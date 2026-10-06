/**
 * De quién es el plan del mes (`lib/plan.ts`).
 *
 * El plan es personal —metas, rutina y cintura de una persona concreta—, pero
 * la app está abierta: cualquiera puede crearse una cuenta. Sin este corte, un
 * usuario nuevo heredaba las 2.450 kcal, la rutina de 6 días y la meta de peso
 * ajenas en vez de las que calcula su propio onboarding.
 *
 * Se compara el SHA-256 del email, no el email ni el id: el repo es público y
 * así no queda ninguno de los dos escrito en el código ni en el bundle.
 *
 * Usa `crypto.subtle`, que existe igual en el navegador y en Node, así el
 * cliente y el cron de avisos (`pushServer.ts`) deciden con la misma regla.
 */

const PLAN_OWNER_HASHES = new Set([
  "fdd5caf5f0d8401556e818962d7718cba2b28aaa8aa457148d44c1ef968658f8",
]);

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function isPlanOwner(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return PLAN_OWNER_HASHES.has(await sha256(email.trim().toLowerCase()));
}
