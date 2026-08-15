import { useEffect, useState } from "react";
import {
  isIosSafari,
  isStandalone,
  pushSupported,
  subscribeToPush,
  tzOffsetMinutes,
  unsubscribeFromPush,
} from "@/lib/push";
import type { PushSubRecord } from "@/lib/useNutta";

/** Por qué no se puede activar el aviso en este dispositivo. */
export type PushBlocker =
  | null
  /** iPhone en una pestaña de Safari: hay que instalar la PWA primero. */
  | "instalar"
  /** El usuario bloqueó los avisos en el navegador. */
  | "bloqueado"
  /** Navegador sin Web Push (o falta la clave VAPID en el build). */
  | "no-soportado";

export type PushState = {
  /** Este dispositivo está suscrito y va a recibir los avisos. */
  enabled: boolean;
  blocker: PushBlocker;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendTest: () => Promise<void>;
};

/**
 * Por qué este dispositivo no puede recibir avisos. Se calcula al vuelo (son
 * capacidades del navegador, no estado que cambie solo) y se recalcula a mano
 * cuando el usuario responde al permiso.
 */
function detectBlocker(): PushBlocker {
  if (typeof window === "undefined") return "no-soportado";
  if (!pushSupported()) {
    // En iPhone `PushManager` no existe fuera de la PWA instalada: el problema
    // no es el navegador, es que falta agregarla a la pantalla de inicio.
    return isIosSafari() && !isStandalone() ? "instalar" : "no-soportado";
  }
  return Notification.permission === "denied" ? "bloqueado" : null;
}

/**
 * Avisos del plan por Web Push.
 *
 * Antes esto era un `setInterval` dentro de la página: solo podía sonar con la
 * app abierta —justo cuando no hace falta que te avise— y los navegadores
 * congelan los timers al mandar la PWA a segundo plano. Ahora el dispositivo se
 * suscribe y quien decide y empuja es el cron del servidor
 * (`/api/push/[slot]`), así el aviso llega con la app cerrada.
 */
export function usePlanReminders(
  pushSubs: PushSubRecord[],
  savePushSub: (
    keys: { endpoint: string; p256dh: string; auth: string },
    tzOffset: number,
  ) => void,
  removePushSub: (endpoint: string) => void,
): PushState {
  // Endpoint de ESTE dispositivo. Sin esto no se puede distinguir "hay una
  // suscripción en la cuenta" (puede ser la del otro teléfono) de "este
  // teléfono está suscrito".
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<PushBlocker>(detectBlocker);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo único que hace falta preguntarle al navegador de forma asíncrona: si ya
  // había una suscripción de antes (de otra sesión), para reflejar el estado
  // real del dispositivo en vez de ofrecer "Activar" sobre algo ya activo.
  useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setEndpoint(sub?.endpoint ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = endpoint != null && pushSubs.some((s) => s.endpoint === endpoint);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setBlocker(permission === "denied" ? "bloqueado" : null);
        return;
      }
      setBlocker(null);
      const keys = await subscribeToPush();
      if (!keys) {
        setError("No se pudo suscribir este dispositivo.");
        return;
      }
      savePushSub(keys, tzOffsetMinutes());
      setEndpoint(keys.endpoint);
    } catch {
      setError("No se pudo activar los avisos. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const gone = await unsubscribeFromPush();
      // Se borra la fila aunque el navegador ya no tuviera suscripción: si no,
      // el servidor seguiría empujando a un endpoint muerto.
      removePushSub(gone ?? endpoint ?? "");
      setEndpoint(null);
    } catch {
      setError("No se pudo desactivar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Aviso de prueba. Va SIEMPRE por el service worker: el constructor
   * `new Notification()` no existe en iOS y lanza excepción en Chrome de
   * Android, que es exactamente por qué el botón "Probar" no hacía nada.
   */
  const sendTest = async () => {
    setError(null);
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🔔 Nutta", {
        body: "Así se van a ver tus avisos del plan.",
        icon: "/icon.svg",
        tag: "nutta-test",
      });
    } catch {
      setError("Tu navegador no pudo mostrar el aviso de prueba.");
    }
  };

  return { enabled, blocker, busy, error, enable, disable, sendTest };
}
