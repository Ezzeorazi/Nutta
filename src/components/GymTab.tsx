"use client";

import { useMemo, useState } from "react";
import { inputCls } from "@/components/Sheet";
import {
  groupByExercise,
  personalRecords,
  totalVolume,
  usedExercises,
} from "@/lib/gym";
import { COMMON_LIFTS, type StrengthSet } from "@/lib/types";

export default function GymTab({
  strengthSets,
  today,
  onAddSet,
  onRemoveSet,
}: {
  strengthSets: StrengthSet[];
  today: string;
  onAddSet: (exercise: string, reps: number, weight: number, date: string) => void;
  onRemoveSet: (id: string) => void;
}) {
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

  const todaySets = useMemo(
    () => strengthSets.filter((s) => s.date === today),
    [strengthSets, today],
  );
  const groups = useMemo(() => groupByExercise(todaySets), [todaySets]);
  const prs = useMemo(() => personalRecords(strengthSets), [strengthSets]);
  const dayVolume = totalVolume(todaySets);

  const options = useMemo(() => {
    const used = usedExercises(strengthSets);
    return [...new Set([...used, ...COMMON_LIFTS])];
  }, [strengthSets]);

  const canAdd = exercise.trim() !== "" && Number(reps) > 0;
  const submit = () => {
    if (!canAdd) return;
    onAddSet(exercise.trim(), Number(reps), Number(weight) || 0, today);
    setReps("");
    // se mantienen ejercicio y peso para cargar la próxima serie rápido
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entreno</h1>
          <p className="text-sm text-muted">Series, peso y PR</p>
        </div>
        {todaySets.length > 0 && (
          <span className="text-right text-xs text-muted">
            Volumen hoy
            <span className="block text-base font-bold tabular-nums text-foreground">
              {Math.round(dayVolume).toLocaleString("es-AR")} kg
            </span>
          </span>
        )}
      </header>

      {/* Alta de serie */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <input
          className={inputCls}
          list="lift-options"
          placeholder="Ejercicio (ej. Press banca)"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
        />
        <datalist id="lift-options">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            className={inputCls}
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            className={inputCls}
            placeholder="Peso (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button
            onClick={submit}
            disabled={!canAdd}
            className="shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground active:scale-95 disabled:opacity-40"
          >
            + Serie
          </button>
        </div>
        <p className="text-xs text-muted">
          Dejá el peso en 0 para ejercicios con peso corporal.
        </p>
      </section>

      {/* Sesión de hoy */}
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted">
          Todavía no cargaste series hoy. Sumá tu primera serie arriba 💪
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">Sesión de hoy</h2>
          {groups.map((g) => {
            const pr = prs.get(g.exercise) ?? 0;
            const isPr = g.topWeight >= pr && pr > 0;
            return (
              <div
                key={g.exercise}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">
                    {g.exercise}
                    {isPr && (
                      <span
                        className="ml-2 align-middle text-xs text-accent"
                        title="Récord personal"
                      >
                        🏆 PR
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-muted tabular-nums">
                    {Math.round(g.volume).toLocaleString("es-AR")} kg
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {g.sets.map((s, i) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="tabular-nums">
                        <span className="mr-2 text-muted">{i + 1}.</span>
                        {s.reps} <span className="text-muted">reps ×</span>{" "}
                        {s.weight} <span className="text-muted">kg</span>
                      </span>
                      <button
                        onClick={() => onRemoveSet(s.id)}
                        className="text-muted hover:text-accent"
                        aria-label="Eliminar serie"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  PR: {pr} kg · {g.sets.length}{" "}
                  {g.sets.length === 1 ? "serie" : "series"}
                </p>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
