"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { inputCls } from "@/components/ui/Field";
import { STEPS_GOAL, WATER_GOAL_L, type DailyMetrics } from "@/lib/types";

const fmtL = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Agua, sueño y pasos del día.
 *
 * Eran tres tarjetas con borde propio para tres números. Ahora es una sola con
 * tres filas separadas por una línea fina: la misma información con un tercio
 * del peso visual.
 */
export default function WellbeingCard({
  metrics,
  waterGoal = WATER_GOAL_L,
  onSetWater,
  onSetSleep,
  onSetSteps,
}: {
  metrics?: DailyMetrics;
  waterGoal?: number;
  onSetWater: (liters: number) => void;
  onSetSleep: (hours: number) => void;
  onSetSteps: (steps: number) => void;
}) {
  const water = metrics?.water ?? 0;
  const sleep = metrics?.sleepHours;
  const steps = metrics?.steps ?? 0;
  const [sleepInput, setSleepInput] = useState(
    sleep != null ? String(sleep) : "",
  );
  const [stepsInput, setStepsInput] = useState(steps ? String(steps) : "");

  const pct = Math.min(1, water / waterGoal);
  const stepsPct = Math.min(1, steps / STEPS_GOAL);
  const addWater = (delta: number) =>
    onSetWater(Math.max(0, Math.round((water + delta) * 100) / 100));

  return (
    <section className="flex flex-col rounded-card bg-card shadow-e1">
      <h2 className="px-4 pb-1 pt-4 text-sm font-semibold text-muted">
        Bienestar
      </h2>

      {/* Agua */}
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">💧 Agua</h3>
          <span className="text-xs text-muted tabular-nums">
            {fmtL(water)} / {fmtL(waterGoal)} L
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Chip onClick={() => addWater(0.25)}>+ vaso</Chip>
          <Chip onClick={() => addWater(0.5)}>+½ L</Chip>
          {water > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                if (confirm("¿Resetear el agua de este día?")) onSetWater(0);
              }}
            >
              Reiniciar
            </Button>
          )}
        </div>
      </div>

      {/* Sueño */}
      <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">😴 Sueño</h3>
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
            className={inputCls}
            aria-label="Horas de sueño"
          />
          <Button
            onClick={() => {
              const n = Number(sleepInput);
              if (n > 0) onSetSleep(n);
            }}
            disabled={!(Number(sleepInput) > 0)}
          >
            OK
          </Button>
        </div>
      </div>

      {/* Pasos */}
      <div className="flex flex-col gap-2.5 border-t border-border px-4 pb-4 pt-3.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">👣 Pasos</h3>
          <span className="text-xs text-muted tabular-nums">
            {steps.toLocaleString("es-AR")} /{" "}
            {STEPS_GOAL.toLocaleString("es-AR")}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
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
            className={inputCls}
            aria-label="Pasos de hoy"
          />
          <Button
            onClick={() => {
              const n = Number(stepsInput);
              if (n >= 0) onSetSteps(n);
            }}
            disabled={!(Number(stepsInput) >= 0) || stepsInput === ""}
          >
            OK
          </Button>
        </div>
      </div>
    </section>
  );
}
