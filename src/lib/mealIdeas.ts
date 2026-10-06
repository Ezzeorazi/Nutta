/**
 * Qué comida viene y cuánto le toca de lo que falta en el día. Pura y
 * client-safe: es lo que se le manda a la IA ("Ideas de comida" en Hoy).
 *
 * Los horarios siguen el plan (`PLAN_MEALS`): desayuno 9, entreno a media
 * mañana, almuerzo post-entreno 13, merienda 17, cena 21.
 */

import type { Goals } from "@/lib/types";

export type MealSlot = { key: string; label: string; share: number };

/** Peso relativo de cada comida: el almuerzo (post-entreno) es la grande. */
const SLOTS: MealSlot[] = [
  { key: "desayuno", label: "Desayuno (antes de entrenar)", share: 0.25 },
  { key: "almuerzo", label: "Almuerzo (post-entreno)", share: 0.35 },
  { key: "merienda", label: "Merienda", share: 0.15 },
  { key: "cena", label: "Cena", share: 0.25 },
];

const MAX_PROTEIN = 55;
const MAX_CARBS = 100;

/** Índice de la próxima comida según la hora local. */
const slotIndex = (hour: number) =>
  hour < 11 ? 0 : hour < 15 ? 1 : hour < 19 ? 2 : 3;

export function nextMeal(hour: number): MealSlot {
  return SLOTS[slotIndex(hour)];
}

/**
 * La porción de lo que falta que le corresponde a la próxima comida: lo que
 * falta repartido entre las comidas que quedan, según su peso. Así a la noche
 * la cena se lleva todo y a la mañana el desayuno no intenta cubrir el día.
 */
export function mealTarget(remaining: Goals, hour: number): Goals {
  const i = slotIndex(hour);
  const left = SLOTS.slice(i).reduce((s, m) => s + m.share, 0);
  const f = SLOTS[i].share / left;
  const part = (v: number) => Math.max(0, Math.round(v * f));
  return {
    calories: part(remaining.calories),
    protein: Math.min(MAX_PROTEIN, part(remaining.protein)),
    carbs: Math.min(MAX_CARBS, part(remaining.carbs)),
    fat: part(remaining.fat),
  };
}
