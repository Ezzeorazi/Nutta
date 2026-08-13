"use client";

import { Check } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { MODE_LABEL, type TodaySession } from "@/lib/session";

const MODE_TONE: Record<TodaySession["mode"], string> = {
  completa: "bg-primary/10 text-primary",
  liviana: "bg-accent/10 text-accent",
  descanso: "bg-sunken text-muted",
  hecha: "bg-success/10 text-success",
};

/**
 * La sesión de hoy, a pedido. Es un sheet y no una tarjeta fija a propósito:
 * la app ya muestra tu rutina del mes en la pantalla de Gym, y dos rutinas
 * compitiendo por la misma pantalla fue exactamente el problema anterior.
 */
export default function SessionSheet({
  session,
  onSelectExercise,
  onClose,
}: {
  session: TodaySession;
  /** Cargar ese ejercicio en el formulario de series. */
  onSelectExercise: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Tu día de hoy" description={session.title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden>
            {session.emoji}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MODE_TONE[session.mode]}`}
          >
            {MODE_LABEL[session.mode]}
          </span>
        </div>

        {session.swap && (
          <p className="rounded-control bg-sunken px-3 py-2 text-xs text-muted">
            Tu plan de hoy es <strong>{session.swap.from}</strong>, pero se
            propone cambiarlo: {session.swap.why}.
          </p>
        )}

        {session.exercises.length > 0 ? (
          <ol className="flex flex-col gap-1.5">
            {session.exercises.map((ex, i) => (
              <li key={ex.name}>
                <button
                  onClick={() => {
                    onSelectExercise(ex.name);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition active:scale-[0.99] ${
                    ex.done
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted">
                      {ex.done ? (
                        <Check
                          size={14}
                          className="text-primary"
                          aria-label="Ya cargado"
                        />
                      ) : (
                        `${i + 1}.`
                      )}
                    </span>
                    <span className="truncate">{ex.name}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted tabular-nums">
                    {ex.sets}
                    <span className="block">{ex.weight}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-card border border-dashed border-border p-4 text-center text-sm text-muted">
            Hoy no toca gimnasio.
          </p>
        )}

        {session.cardio && (
          <p className="text-sm text-muted">🏃 {session.cardio}</p>
        )}

        {/* El motivo. Sin esto la sugerencia es un oráculo: te dice qué hacer
            pero no por qué, y no hay forma de saber si se equivocó. */}
        {session.reasons.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Motivo
            </p>
            <ul className="flex flex-col gap-0.5">
              {session.reasons.map((r) => (
                <li key={r} className="text-xs text-muted">
                  · {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
