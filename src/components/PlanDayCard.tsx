"use client";

import { ArrowLeftRight, Check } from "lucide-react";
import { muscleWork } from "@/lib/exerciseDb";
import type { SwappedDay } from "@/lib/planSwaps";
import { dayLabel, type StrengthSet } from "@/lib/types";

/**
 * Sesión fija del plan del mes, con tap-to-fill: tocar un ejercicio lo carga en
 * el formulario de abajo. Es la única rutina que se muestra —antes convivía con
 * una sugerencia generada por la app y no se sabía cuál seguir—.
 */
export default function PlanDayCard({
  planDay,
  daySets,
  isToday = true,
  viewDate,
  onSelectExercise,
  onSwapExercise,
}: {
  planDay: SwappedDay;
  daySets: StrengthSet[];
  isToday?: boolean;
  viewDate?: string;
  onSelectExercise: (name: string) => void;
  /** Abre el reemplazo de ese ejercicio. */
  onSwapExercise?: (name: string) => void;
}) {
  const doneNames = new Set(
    daySets.map((s) => s.exercise.trim().toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">
        {isToday || !viewDate
          ? "Tu rutina de hoy"
          : `Tu rutina — ${dayLabel(viewDate)}`}
      </h2>
      <div className="flex flex-col gap-3 rounded-card border-l-4 border-l-primary bg-card px-4 py-3 shadow-e1">
        <div className="flex items-center gap-3">
          <span className="text-lg leading-none">{planDay.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{planDay.label}</p>
            {planDay.warning && (
              <p className="mt-0.5 text-xs text-accent">⚠️ {planDay.warning}</p>
            )}
          </div>
        </div>

        {planDay.rest ? (
          <p className="pl-1 text-xs text-muted">🧘 {planDay.cardio}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 pl-1">
              {planDay.exercises.map((ex) => {
                const done = doneNames.has(ex.name.trim().toLowerCase());
                // Qué músculos compromete: es lo que convierte la rutina en
                // algo que se puede razonar (y reemplazar) en vez de una lista
                // de nombres de máquinas.
                const musculos = muscleWork(ex.name).primary;
                return (
                  <div
                    key={ex.swappedFrom ?? ex.name}
                    className={`flex items-stretch rounded-xl border ${
                      done
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    <button
                      onClick={() => onSelectExercise(ex.name)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm active:scale-[0.99]"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          {done && (
                            <Check
                              size={14}
                              className="shrink-0 text-primary"
                              aria-hidden
                            />
                          )}
                          <span className="truncate">{ex.name}</span>
                        </span>
                        {(musculos.length > 0 || ex.swappedFrom) && (
                          <span className="truncate text-xs text-muted">
                            {ex.swappedFrom && (
                              <span className="text-accent">
                                en vez de {ex.swappedFrom}
                                {musculos.length > 0 ? " · " : ""}
                              </span>
                            )}
                            {musculos.join(", ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 pl-2 text-right text-xs text-muted tabular-nums">
                        {ex.sets}
                        {ex.weight && <span className="block">{ex.weight}</span>}
                      </span>
                    </button>
                    {onSwapExercise && (
                      <button
                        onClick={() => onSwapExercise(ex.name)}
                        aria-label={`Cambiar ${ex.name} por otro ejercicio`}
                        className="grid w-11 shrink-0 place-items-center rounded-r-xl border-l border-border/60 text-muted transition-colors active:scale-95 hover:text-primary"
                      >
                        <ArrowLeftRight size={15} strokeWidth={2} aria-hidden />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {planDay.cardio && (
              <p className="pl-1 text-xs text-muted">🏃 {planDay.cardio}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
