"use client";

import { emojiForExercise, emojiForFood } from "@/lib/emoji";
import {
  MEALS,
  type ExerciseEntry,
  type FoodEntry,
  type MealType,
} from "@/lib/types";

/** Hora aproximada por comida, para ordenar entradas viejas sin createdAt. */
const MEAL_HOUR: Record<MealType, number> = {
  desayuno: 8,
  almuerzo: 13,
  merienda: 17,
  cena: 21,
  snack: 23,
};

const mealLabel = (m: MealType) =>
  MEALS.find((x) => x.key === m)?.label ?? m;

type TLEvent = {
  key: string;
  kind: "food" | "exercise";
  emoji: string;
  name: string;
  detail: string;
  kcal: number;
  minute: number; // minutos desde medianoche, para ordenar
  timeLabel: string | null;
  fallbackLabel: string | null;
  onRemove: () => void;
};

const timeFmt = (ms: number) =>
  new Date(ms).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 24h: evita el "p. m." que se partía en dos líneas
  });

const minuteFromMs = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

export default function Timeline({
  foods,
  exercises,
  onRemoveFood,
  onRemoveExercise,
}: {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  onRemoveFood: (id: string) => void;
  onRemoveExercise: (id: string) => void;
}) {
  const events: TLEvent[] = [
    ...foods.map<TLEvent>((f) => ({
      key: `f-${f.id}`,
      kind: "food",
      emoji: emojiForFood(f.name),
      name: f.name,
      detail: `${Math.round(f.qty)} g`,
      kcal: Math.round(f.calories),
      minute: f.createdAt ? minuteFromMs(f.createdAt) : MEAL_HOUR[f.meal] * 60,
      timeLabel: f.createdAt ? timeFmt(f.createdAt) : null,
      fallbackLabel: mealLabel(f.meal),
      onRemove: () => onRemoveFood(f.id),
    })),
    ...exercises.map<TLEvent>((e) => ({
      key: `e-${e.id}`,
      kind: "exercise",
      emoji: emojiForExercise(e.name),
      name: e.name,
      detail: `${Math.round(e.minutes)} min`,
      kcal: Math.round(e.caloriesBurned),
      minute: e.createdAt ? minuteFromMs(e.createdAt) : 12 * 60,
      timeLabel: e.createdAt ? timeFmt(e.createdAt) : null,
      fallbackLabel: "Ejercicio",
      onRemove: () => onRemoveExercise(e.id),
    })),
  ].sort((a, b) => a.minute - b.minute);

  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
        <p className="text-sm text-muted">
          Todavía no registraste nada hoy.
          <br />
          Contale al chat qué comiste o entrenaste 💬
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col">
      <h2 className="mb-3 text-sm font-semibold text-muted">Tu día</h2>
      <ol className="flex flex-col">
        {events.map((ev, i) => (
          <li key={ev.key} className="group flex gap-3">
            {/* Riel con hora y punto */}
            <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
              <span className="whitespace-nowrap text-[11px] tabular-nums text-muted">
                {ev.timeLabel ?? ev.fallbackLabel}
              </span>
            </div>
            <div className="relative flex flex-col items-center">
              <span
                className={`z-10 mt-1 h-2.5 w-2.5 rounded-full ${
                  ev.kind === "food" ? "bg-primary" : "bg-accent"
                }`}
              />
              {i < events.length - 1 && (
                <span className="w-px flex-1 bg-border" />
              )}
            </div>
            {/* Contenido */}
            <div className="mb-3 flex min-w-0 flex-1 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xl leading-none">{ev.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">
                    {ev.name}
                  </p>
                  <p className="text-xs text-muted">{ev.detail}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    ev.kind === "food" ? "text-foreground" : "text-accent"
                  }`}
                >
                  {ev.kind === "food" ? "" : "−"}
                  {ev.kcal} kcal
                </span>
                <button
                  onClick={ev.onRemove}
                  className="text-muted opacity-60 transition hover:text-accent hover:opacity-100"
                  aria-label={`Eliminar ${ev.name}`}
                >
                  ×
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
