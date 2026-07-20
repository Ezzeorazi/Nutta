"use client";

import { useState } from "react";
import { STEPS_GOAL, WATER_GOAL_L, type DailyMetrics } from "@/lib/types";

const fmtL = (n: number) => (Math.round(n * 100) / 100).toString();

export default function WellbeingCard({
  metrics,
  onSetWater,
  onSetSleep,
  onSetSteps,
}: {
  metrics?: DailyMetrics;
  onSetWater: (liters: number) => void;
  onSetSleep: (hours: number) => void;
  onSetSteps: (steps: number) => void;
}) {
  const water = metrics?.water ?? 0;
  const sleep = metrics?.sleepHours;
  const steps = metrics?.steps ?? 0;
  const [sleepInput, setSleepInput] = useState(sleep != null ? String(sleep) : "");
  const [stepsInput, setStepsInput] = useState(steps ? String(steps) : "");

  const pct = Math.min(1, water / WATER_GOAL_L);
  const stepsPct = Math.min(1, steps / STEPS_GOAL);
  const addWater = (delta: number) =>
    onSetWater(Math.max(0, Math.round((water + delta) * 100) / 100));

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Agua */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold">💧 Agua</h3>
          <span className="text-xs text-muted tabular-nums">
            {fmtL(water)} / {WATER_GOAL_L} L
          </span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => addWater(0.25)}
            className="rounded-full border border-border px-3 py-1.5 text-sm active:scale-95 hover:border-primary"
          >
            + vaso
          </button>
          <button
            onClick={() => addWater(0.5)}
            className="rounded-full border border-border px-3 py-1.5 text-sm active:scale-95 hover:border-primary"
          >
            +½ L
          </button>
          {water > 0 && (
            <button
              onClick={() => onSetWater(0)}
              className="ml-auto rounded-full px-2 py-1.5 text-xs text-muted active:scale-95"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* Sueño */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold">😴 Sueño</h3>
          {sleep != null && (
            <span className="text-xs text-muted tabular-nums">{sleep} h</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max="16"
            placeholder="Horas (ej. 7.5)"
            value={sleepInput}
            onChange={(e) => setSleepInput(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              const n = Number(sleepInput);
              if (n > 0) onSetSleep(n);
            }}
            disabled={!(Number(sleepInput) > 0)}
            className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>

      {/* Pasos */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold">👣 Pasos</h3>
          <span className="text-xs text-muted tabular-nums">
            {steps.toLocaleString("es-AR")} / {STEPS_GOAL.toLocaleString("es-AR")}
          </span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${stepsPct * 100}%` }}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Pasos de hoy"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              const n = Number(stepsInput);
              if (n >= 0) onSetSteps(n);
            }}
            disabled={!(Number(stepsInput) >= 0) || stepsInput === ""}
            className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>
    </section>
  );
}
