/**
 * Suscripción a Web Push desde el navegador.
 *
 * Es la pieza que hace que el aviso llegue con la app CERRADA: el navegador
 * entrega un `endpoint` propio del dispositivo, se guarda en InstantDB y el
 * cron del servidor le empuja el mensaje (ver `lib/pushServer.ts`).
 *
 * Ojo iPhone: el push solo existe si la PWA está instalada en la pantalla de
 * inicio. En una pestaña de Safari `PushManager` directamente no está.
 */

export type PushKeys = { endpoint: string; p256dh: string; auth: string };

/** La clave VAPID viaja al cliente: es pública por diseño. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** `true` si el dispositivo puede recibir push (y está configurado). */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined" &&
    VAPID_PUBLIC_KEY !== ""
  );
}

/** iOS solo habilita push en la PWA instalada; sirve para explicar el porqué. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS se hace pasar por Mac: se lo detecta por el soporte táctil.
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS && /Safari/.test(ua);
}

/** `true` si corre como app instalada (no en una pestaña del navegador). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari en iOS no soporta display-mode y usa esta propiedad propia.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** La clave VAPID viaja en base64url y `subscribe` la pide en bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  // El buffer se reserva explícito: `new Uint8Array(n)` se tipa sobre
  // ArrayBufferLike (incluye SharedArrayBuffer) y `subscribe` pide ArrayBuffer.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Extrae las claves de una suscripción en el formato que espera el servidor. */
function toKeys(sub: PushSubscription): PushKeys | null {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth };
}

/**
 * Suscribe el dispositivo (o devuelve la suscripción que ya tenía). Asume que
 * el permiso ya fue concedido: pedirlo es decisión de la UI, no de acá.
 */
export async function subscribeToPush(): Promise<PushKeys | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return toKeys(existing);
  const sub = await reg.pushManager.subscribe({
    // Sin esto los navegadores rechazan la suscripción: no se permite push
    // silencioso, cada mensaje tiene que mostrarse.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  return toKeys(sub);
}

/** Corta la suscripción del dispositivo. Devuelve el endpoint dado de baja. */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}

/** Minutos de desfase respecto de UTC (positivo al este de Greenwich). */
export const tzOffsetMinutes = () => -new Date().getTimezoneOffset();
