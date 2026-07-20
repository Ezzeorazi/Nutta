"use client";

import MeasuresPanel from "@/components/MeasuresPanel";
import MetasPanel from "@/components/MetasPanel";
import PhotosPanel from "@/components/PhotosPanel";
import WeightPanel from "@/components/WeightPanel";
import type { ResolvedPhoto } from "@/lib/useNutta";
import type {
  BodyPart,
  CustomGoal,
  GoalKind,
  MeasureEntry,
  StrengthSet,
  WeightEntry,
} from "@/lib/types";

export default function ProgresoTab({
  weights,
  targetWeight,
  measures,
  photos,
  strengthSets,
  customGoals,
  today,
  addWeight,
  setTargetWeight,
  addMeasure,
  addPhoto,
  removePhoto,
  addGoal,
  removeGoal,
}: {
  weights: WeightEntry[];
  targetWeight?: number;
  measures: MeasureEntry[];
  photos: ResolvedPhoto[];
  strengthSets: StrengthSet[];
  customGoals: CustomGoal[];
  today: string;
  addWeight: (kg: number, date: string) => void;
  setTargetWeight: (kg: number) => void;
  addMeasure: (part: BodyPart, cm: number, date: string) => void;
  addPhoto: (file: File, date: string) => Promise<void>;
  removePhoto: (id: string, fileId: string) => void;
  addGoal: (kind: GoalKind, label: string, target: number, ref?: string) => void;
  removeGoal: (id: string) => void;
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
      <MetasPanel
        goals={customGoals}
        weights={weights}
        strengthSets={strengthSets}
        measures={measures}
        onAdd={addGoal}
        onRemove={removeGoal}
      />
      <MeasuresPanel measures={measures} onAdd={addMeasure} today={today} />
      <PhotosPanel
        photos={photos}
        today={today}
        onAdd={addPhoto}
        onRemove={removePhoto}
      />
    </main>
  );
}
