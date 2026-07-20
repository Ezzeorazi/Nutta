"use client";

import { useState } from "react";
import { inputCls } from "@/components/Sheet";
import { usedExercises } from "@/lib/gym";
import {
  COMMON_LIFTS,
  GOAL_KINDS,
  MEASURE_PARTS,
  type BodyPart,
  type CustomGoal,
  type GoalKind,
  type MeasureEntry,
  type StrengthSet,
  type WeightEntry,
} from "@/lib/types";

const unitOf = (k: GoalKind) => (k === "medida" ? "cm" : "kg");

/** Valor actual, sentido y progreso de una meta según los datos reales. */
function evalGoal(
  goal: CustomGoal,
  weights: WeightEntry[],
  strengthSets: StrengthSet[],
  measures: MeasureEntry[],
): { cur: number | null; start: number | null; reached: boolean; pct: number } {
  let series: number[] = [];
  if (goal.kind === "peso") {
    series = weights.map((w) => w.kg);
  } else if (goal.kind === "levantamiento") {
    series = strengthSets
      .filter((s) => s.exercise.toLowerCase() === (goal.ref ?? "").toLowerCase())
      .map((s) => s.weight);
  } else {
    series = measures
      .filter((m) => m.part === goal.ref)
      .map((m) => m.cm);
  }

  if (series.length === 0)
    return { cur: null, start: null, reached: false, pct: 0 };

  const start = series[0];
  // Para levantamiento el "actual" es el PR (máximo); para peso/medida, el último.
  const cur =
    goal.kind === "levantamiento"
      ? Math.max(...series)
      : series[series.length - 1];

  const down = start > goal.target; // hay que bajar
  const reached = down ? cur <= goal.target : cur >= goal.target;

  const span = Math.abs(goal.target - start) || 1;
  const done = down ? start - cur : cur - start;
  const pct = Math.max(0, Math.min(1, done / span));

  return { cur, start, reached, pct };
}

export default function MetasPanel({
  goals,
  weights,
  strengthSets,
  measures,
  onAdd,
  onRemove,
}: {
  goals: CustomGoal[];
  weights: WeightEntry[];
  strengthSets: StrengthSet[];
  measures: MeasureEntry[];
  onAdd: (kind: GoalKind, label: string, target: number, ref?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<GoalKind>("peso");
  const [ref, setRef] = useState("");
  const [part, setPart] = useState<BodyPart>("cintura");
  const [target, setTarget] = useState("");

  const liftOptions = [...new Set([...usedExercises(strengthSets), ...COMMON_LIFTS])];

  const submit = () => {
    const t = Number(target);
    if (!(t > 0)) return;
    if (kind === "peso") onAdd("peso", "Peso corporal", t);
    else if (kind === "levantamiento") {
      if (!ref.trim()) return;
      onAdd("levantamiento", ref.trim(), t, ref.trim());
    } else {
      const label = MEASURE_PARTS.find((p) => p.key === part)?.label ?? part;
      onAdd("medida", label, t, part);
    }
    setTarget("");
    setRef("");
    setAdding(false);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🎯 Metas</h2>
        <button
          onClick={() => setAdding((a) => !a)}
          className="text-xs font-medium text-primary active:scale-95"
        >
          {adding ? "Cancelar" : "+ Nueva meta"}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {GOAL_KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                  kind === k.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {kind === "levantamiento" && (
            <input
              className={inputCls}
              list="goal-lift-options"
              placeholder="Ejercicio (ej. Press banca)"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          )}
          <datalist id="goal-lift-options">
            {liftOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>

          {kind === "medida" && (
            <select
              value={part}
              onChange={(e) => setPart(e.target.value as BodyPart)}
              className={inputCls}
            >
              {MEASURE_PARTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              className={inputCls}
              placeholder={`Meta (${unitOf(kind)})`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <button
              onClick={submit}
              disabled={!(Number(target) > 0)}
              className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              Crear
            </button>
          </div>
        </div>
      )}

      {goals.length === 0 && !adding ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted">
          Ponete una meta: peso, un PR o una medida (ej. 100 kg en press
          banca).
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((g) => {
            const { cur, reached, pct } = evalGoal(
              g,
              weights,
              strengthSets,
              measures,
            );
            const unit = unitOf(g.kind);
            return (
              <li
                key={g.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{g.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-muted">
                      {cur != null ? cur : "—"} → {g.target} {unit}
                    </span>
                    <button
                      onClick={() => onRemove(g.id)}
                      className="text-muted hover:text-accent"
                      aria-label="Eliminar meta"
                    >
                      ×
                    </button>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      reached ? "bg-success" : "bg-primary"
                    }`}
                    style={{ width: `${(reached ? 1 : pct) * 100}%` }}
                  />
                </div>
                {reached && (
                  <p className="mt-1 text-xs font-semibold text-success">
                    🎉 ¡Meta cumplida!
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
