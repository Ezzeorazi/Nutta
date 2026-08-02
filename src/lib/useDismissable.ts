"use client";

import { useEffect, useRef } from "react";

/** Marca propia en el historial: distingue nuestras entradas de la navegación real. */
type OverlayState = { nuttaOverlay: true };

const isOverlayEntry = (state: unknown): state is OverlayState =>
  typeof state === "object" &&
  state !== null &&
  (state as OverlayState).nuttaOverlay === true;

/**
 * Hace que el botón atrás del teléfono cierre un overlay en vez de salir de la
 * app. Mientras el overlay está abierto se empuja una entrada al historial;
 * al cerrarse se consume.
 *
 * En la PWA instalada esto es la diferencia entre cerrar un formulario y perder
 * todo lo que estabas cargando.
 *
 * Anida bien: si hay dos overlays abiertos (el escáner sobre el formulario),
 * cada uno empuja su entrada y el botón atrás los cierra de a uno, en orden.
 */
export function useDismissable(open: boolean, onDismiss: () => void) {
  // El callback se lee por ref para que cambiarlo no re-dispare el efecto: si
  // se re-suscribiera, empujaría una entrada de historial de más por render.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ nuttaOverlay: true } satisfies OverlayState, "");

    const onPopState = () => dismissRef.current();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Si el overlay se cerró por otra vía (la cruz, ESC, el arrastre), nuestra
      // entrada sigue en el historial: hay que sacarla o el próximo "atrás" se
      // gastaría en no hacer nada visible. Si se cerró CON el botón atrás, la
      // entrada ya se consumió y el estado actual no es nuestro, así que no se
      // toca nada.
      if (isOverlayEntry(window.history.state)) window.history.back();
    };
  }, [open]);
}
