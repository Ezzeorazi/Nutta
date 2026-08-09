"use client";

import { Check } from "lucide-react";
import type { PlanDay } from "@/lib/plan";
import type { StrengthSet } from "@/lib/types";

/** Sesión fija del plan del mes, con tap-to-fill igual que la sugerencia dinámica. */
export default function PlanDayCard({
  planDay,
  daySets,
  onSelectExercise,
}: {
  planDay: PlanDay;
  daySets: StrengthSet[];
  onSelectExercise: (name: string) => void;
}) {
  const doneNames = new Set(
    daySets.map((s) => s.exercise.trim().toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">Tu plan de hoy</h2>
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
                return (
                  <button
                    key={ex.name}
                    onClick={() => onSelectExercise(ex.name)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm active:scale-[0.99] ${
                      done
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
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
                    <span className="shrink-0 pl-2 text-right text-xs text-muted tabular-nums">
                      {ex.sets}
                      <span className="block">{ex.weight}</span>
                    </span>
                  </button>
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
