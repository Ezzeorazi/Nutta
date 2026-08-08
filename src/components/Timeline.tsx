"use client";

import { Trash2 } from "lucide-react";
import { emojiForExercise, emojiForFood } from "@/lib/emoji";
import {
  MEALS,
  type DrinkEntry,
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
  kind: "food" | "exercise" | "drink";
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
  drinks,
  exercises,
  onRemoveFood,
  onRemoveDrink,
  onRemoveExercise,
}: {
  foods: FoodEntry[];
  drinks: DrinkEntry[];
  exercises: ExerciseEntry[];
  onRemoveFood: (id: string) => void;
  onRemoveDrink: (id: string) => void;
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
    ...drinks.map<TLEvent>((d) => ({
      key: `d-${d.id}`,
      kind: "drink",
      emoji: d.emoji,
      name: d.name,
      detail: `${d.ml} ml`,
      kcal: Math.round(d.calories),
      minute: d.createdAt ? minuteFromMs(d.createdAt) : 21 * 60,
      timeLabel: d.createdAt ? timeFmt(d.createdAt) : null,
      fallbackLabel: d.category === "cerveza" ? "Cerveza" : "Trago",
      onRemove: () => onRemoveDrink(d.id),
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
      <section className="flex flex-col items-center gap-1 rounded-card border border-dashed border-border px-6 py-8 text-center">
        <p className="font-medium">Tu día está vacío</p>
        <p className="text-sm text-muted">
          Sumá algo con los botones de arriba, o contale al chat qué comiste.
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
                  ev.kind === "exercise" ? "bg-accent" : "bg-primary"
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
                    ev.kind === "exercise" ? "text-accent" : "text-foreground"
                  }`}
                >
                  {ev.kind === "exercise" ? "−" : ""}
                  {ev.kcal} kcal
                </span>
                <button
                  type="button"
                  onClick={ev.onRemove}
                  className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent opacity-60 hover:opacity-100"
                  aria-label={`Eliminar ${ev.name}`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
