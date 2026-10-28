/**
 * La rutina semanal que se usa de verdad: el plan fijo (`lib/plan.ts`) con los
 * días que el usuario editó encima.
 *
 * Se edita por día a propósito: cambiar el lunes no obliga a reescribir la
 * semana, y "restaurar" un día es borrar su registro y volver al plan. Quien no
 * tiene plan propio (ver `lib/planOwner.ts`) arranca con la semana vacía y la
 * arma desde cero.
 *
 * Función pura: no toca la red ni la base.
 */

import type { PlanDay } from "@/lib/plan";
import type { RoutineDayRecord } from "@/lib/types";

/** Lunes primero, como se lee una semana de gimnasio. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Un día que nadie definió: se lee como descanso hasta que lo armes. */
export const emptyDay = (dow: number): PlanDay => ({
  dow,
  label: "Sin rutina",
  emoji: "📭",
  rest: true,
  exercises: [],
  cardio: "Todavía no armaste este día. Hacelo desde «Editar rutina».",
});

export function buildWeeklyPlan(
  saved: RoutineDayRecord[],
  base: PlanDay[],
): PlanDay[] {
  return WEEK_ORDER.map((dow) => {
    const s = saved.find((d) => d.dow === dow);
    if (!s) return base.find((d) => d.dow === dow) ?? emptyDay(dow);
    return {
      dow,
      label: s.label,
      emoji: s.emoji,
      rest: !!s.rest,
      exercises: s.rest ? [] : s.exercises,
      cardio: s.cardio,
    };
  });
}

/** Parsea la columna JSON de ejercicios; una fila rota se lee como vacía. */
export function parseRoutineExercises(raw: string): RoutineDayRecord["exercises"] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.name === "string" && e.name.trim())
      .map((e) => ({
        name: String(e.name),
        sets: String(e.sets ?? ""),
        ...(e.weight ? { weight: String(e.weight) } : {}),
      }));
  } catch {
    return [];
  }
}
