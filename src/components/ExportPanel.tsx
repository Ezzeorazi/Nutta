"use client";

import { downloadCSV, printHTML } from "@/lib/export";
import { personalRecords } from "@/lib/gym";
import type {
  CustomGoal,
  DailyMetrics,
  ExerciseEntry,
  FoodEntry,
  MeasureEntry,
  StrengthSet,
  WeightEntry,
} from "@/lib/types";

const r1 = (n: number) => Math.round(n * 10) / 10;

export default function ExportPanel({
  foods,
  exercises,
  strengthSets,
  weights,
  measures,
  metrics,
  customGoals,
}: {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  strengthSets: StrengthSet[];
  weights: WeightEntry[];
  measures: MeasureEntry[];
  metrics: DailyMetrics[];
  customGoals: CustomGoal[];
}) {
  const buttons: { label: string; disabled: boolean; run: () => void }[] = [
    {
      label: "Comidas",
      disabled: foods.length === 0,
      run: () =>
        downloadCSV(
          "nutta-comidas.csv",
          foods.map((f) => ({
            fecha: f.date,
            comida: f.meal,
            alimento: f.name,
            gramos: f.qty,
            kcal: Math.round(f.calories),
            proteina_g: r1(f.protein),
            carbos_g: r1(f.carbs),
            grasa_g: r1(f.fat),
          })),
        ),
    },
    {
      label: "Ejercicio",
      disabled: exercises.length === 0,
      run: () =>
        downloadCSV(
          "nutta-ejercicio.csv",
          exercises.map((e) => ({
            fecha: e.date,
            actividad: e.name,
            minutos: e.minutes,
            kcal: Math.round(e.caloriesBurned),
          })),
        ),
    },
    {
      label: "Fuerza",
      disabled: strengthSets.length === 0,
      run: () =>
        downloadCSV(
          "nutta-fuerza.csv",
          strengthSets.map((s) => ({
            fecha: s.date,
            ejercicio: s.exercise,
            reps: s.reps,
            peso_kg: s.weight,
          })),
        ),
    },
    {
      label: "Peso",
      disabled: weights.length === 0,
      run: () =>
        downloadCSV(
          "nutta-peso.csv",
          weights.map((w) => ({ fecha: w.date, kg: w.kg })),
        ),
    },
    {
      label: "Medidas",
      disabled: measures.length === 0,
      run: () =>
        downloadCSV(
          "nutta-medidas.csv",
          measures.map((m) => ({ fecha: m.date, parte: m.part, cm: m.cm })),
        ),
    },
    {
      label: "Bienestar",
      disabled: metrics.length === 0,
      run: () =>
        downloadCSV(
          "nutta-bienestar.csv",
          metrics.map((m) => ({
            fecha: m.date,
            agua_l: m.water ?? "",
            sueno_h: m.sleepHours ?? "",
            pasos: m.steps ?? "",
          })),
        ),
    },
  ];

  const exportPDF = () => {
    const prs = personalRecords(strengthSets);
    const prRows = [...prs.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([ex, kg]) => `<tr><td>${ex}</td><td>${kg} kg</td></tr>`)
      .join("");
    const goalRows = customGoals
      .map((g) => `<tr><td>${g.label}</td><td>${g.target}</td></tr>`)
      .join("");
    const curWeight = weights.at(-1)?.kg;
    const trainDays = new Set([
      ...exercises.map((e) => e.date),
      ...strengthSets.map((s) => s.date),
    ]).size;

    printHTML(
      "Resumen Nutta",
      `
      <h1>Nutta — Resumen</h1>
      <p class="muted">Generado el ${new Date().toLocaleDateString("es-AR")}</p>
      <div class="grid">
        <div class="tile"><b>${foods.length}</b>registros de comida</div>
        <div class="tile"><b>${trainDays}</b>días de entrenamiento</div>
        <div class="tile"><b>${curWeight != null ? curWeight + " kg" : "—"}</b>peso actual</div>
      </div>
      ${prRows ? `<h2>Récords personales</h2><table><tr><th>Ejercicio</th><th>PR</th></tr>${prRows}</table>` : ""}
      ${goalRows ? `<h2>Metas</h2><table><tr><th>Meta</th><th>Objetivo</th></tr>${goalRows}</table>` : ""}
    `,
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Exportar mis datos</h2>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            onClick={b.run}
            disabled={b.disabled}
            className="rounded-full border border-border px-3 py-1.5 text-sm transition active:scale-95 hover:border-primary disabled:opacity-40"
          >
            ⬇ {b.label} CSV
          </button>
        ))}
        <button
          onClick={exportPDF}
          className="rounded-full border border-border px-3 py-1.5 text-sm text-accent transition active:scale-95 hover:border-accent"
        >
          🧾 Resumen PDF
        </button>
      </div>
    </section>
  );
}
