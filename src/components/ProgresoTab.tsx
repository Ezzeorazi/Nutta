"use client";

import MeasuresPanel from "@/components/MeasuresPanel";
import WeightPanel from "@/components/WeightPanel";
import type { BodyPart, MeasureEntry, WeightEntry } from "@/lib/types";

export default function ProgresoTab({
  weights,
  targetWeight,
  measures,
  today,
  addWeight,
  setTargetWeight,
  addMeasure,
}: {
  weights: WeightEntry[];
  targetWeight?: number;
  measures: MeasureEntry[];
  today: string;
  addWeight: (kg: number, date: string) => void;
  setTargetWeight: (kg: number) => void;
  addMeasure: (part: BodyPart, cm: number, date: string) => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Progreso</h1>
        <p className="text-sm text-muted">Tu cuerpo en el tiempo</p>
      </header>
      <WeightPanel
        weights={weights}
        targetWeight={targetWeight}
        onAdd={addWeight}
        onSetTarget={setTargetWeight}
        today={today}
      />
      <MeasuresPanel measures={measures} onAdd={addMeasure} today={today} />
    </main>
  );
}
