import { useEffect, useRef, useState } from "react";
import type { AthleteState } from "@/lib/athlete";
import { getPlanDay } from "@/lib/plan";
import { eveningReminder } from "@/lib/reminders";

const SHOWN_KEY = "nutta.reminderShown";
const CHECK_MS = 15 * 60 * 1000;

function alreadyShown(key: string): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === key;
  } catch {
    return false;
  }
}
function markShown(key: string) {
  try {
    localStorage.setItem(SHOWN_KEY, key);
  } catch {
    // sin localStorage (modo privado): en el peor caso se repite el aviso
  }
}

/**
 * Notificación del navegador (no push): funciona mientras la PWA está
 * abierta o en segundo plano en el dispositivo, revisando cada 15 min y al
 * volver a foco. No llega si el usuario cerró la app del todo — eso requiere
 * Web Push con un backend que la dispare, que queda para una próxima vuelta.
 */
export function usePlanReminders(state: AthleteState, today: string) {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    const check = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      const hour = new Date().getHours();
      const planDay = getPlanDay(today);
      const reminder = eveningReminder({
        date: today,
        hour,
        state: stateRef.current,
        planDay,
      });
      if (!reminder || alreadyShown(reminder.key)) return;
      markShown(reminder.key);
      try {
        new Notification(reminder.title, {
          body: reminder.body,
          icon: "/icon.svg",
          tag: reminder.key,
        });
      } catch {
        // Algunos navegadores (Android/Chrome) no permiten `new Notification`
        // directo y piden pasar por el service worker.
        navigator.serviceWorker
          ?.getRegistration()
          .then((reg) =>
            reg?.showNotification(reminder.title, {
              body: reminder.body,
              icon: "/icon.svg",
              tag: reminder.key,
            }),
          )
          .catch(() => {});
      }
    };

    check();
    const id = setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [today]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const res = await Notification.requestPermission();
    setPermission(res);
  };

  const sendTest = () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    new Notification("🔔 Nutta", {
      body: "Así se van a ver tus avisos del plan.",
      icon: "/icon.svg",
    });
  };

  return { permission, requestPermission, sendTest };
}
