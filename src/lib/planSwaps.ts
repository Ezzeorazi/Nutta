/**
 * Ejercicios de la rutina cambiados por otro, un día puntual.
 *
 * El plan del mes (`lib/plan.ts`) es fijo y sigue siéndolo: esto se le aplica
 * encima al leerlo. Un cambio vale SOLO para su día — la máquina ocupada de un
 * martes no debería reescribir el plan de todos los martes.
 *
 * Función pura: no toca la red ni la base.
 */

import type { PlanDay, PlanExercise } from "@/lib/plan";
import type { PlanSwap } from "@/lib/types";

export type PlanSlot = PlanExercise & {
  /** Si es un reemplazo, el ejercicio del plan al que sustituye. */
  swappedFrom?: string;
};

export type SwappedDay = Omit<PlanDay, "exercises"> & { exercises: PlanSlot[] };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * El día del plan con los cambios de esa fecha ya aplicados.
 *
 * El esquema de series se mantiene (mismo estímulo), pero el PESO no: el del
 * plan es el del ejercicio original y ponerlo al lado de otro movimiento sería
 * directamente un dato falso. Queda vacío para que lo definas vos.
 */
export function applySwaps(
  day: PlanDay,
  swaps: PlanSwap[],
  date: string,
): SwappedDay {
  const forDay = swaps.filter((s) => s.date === date);
  if (forDay.length === 0) return day;

  const byFrom = new Map(forDay.map((s) => [norm(s.from), s.to]));
  return {
    ...day,
    exercises: day.exercises.map((ex) => {
      const to = byFrom.get(norm(ex.name));
      return to ? { ...ex, name: to, weight: "", swappedFrom: ex.name } : ex;
    }),
  };
}
