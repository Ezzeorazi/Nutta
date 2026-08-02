"use client";

import { useEffect, useState } from "react";
import { Timer, X } from "lucide-react";

/**
 * Cuánto llevás descansando desde la última serie.
 *
 * Cuenta hacia arriba en vez de hacia abajo, a propósito: así no hay que
 * configurar un objetivo antes de empezar, y nunca queda "mal puesto". Aparece
 * solo al cargar una serie y se va cuando lo cerrás.
 */
export default function RestTimer({
  since,
  onDismiss,
}: {
  since: number;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secs = Math.max(0, Math.floor((now - since) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-3 rounded-card bg-sunken px-4 py-3">
      <Timer size={18} className="shrink-0 text-accent" aria-hidden />
      <span className="text-sm text-muted">Descanso</span>
      <span
        className="flex-1 text-right text-xl font-bold tabular-nums"
        role="timer"
        aria-live="off"
      >
        {mm}:{ss}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Ocultar cronómetro"
        className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-foreground"
      >
        <X size={17} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
