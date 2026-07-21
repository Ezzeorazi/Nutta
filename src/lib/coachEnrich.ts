/**
 * Post-proceso determinístico de la salida del coach (IA) usando el dataset
 * de ejercicios. NO llama a la IA ni le pasa el dataset: "snapea" los nombres
 * libres que devolvió la IA contra los ejercicios canónicos para
 *  - normalizar el nombre (evita duplicados en PR/volumen del Gym), y
 *  - recalcular las calorías de cardio/actividad con el MET real del ejercicio.
 *
 * Es client-safe (no importa groq), así que puede correr en la ruta o donde sea.
 */
import { matchExercise } from "@/lib/exerciseDb";
import { caloriesFromMet } from "@/lib/exercises";

type ExItem = { name: string; minutes: number; caloriesBurned: number };
type StrItem = { exercise: string; sets: number; reps: number; weight: number };

/**
 * Enriquece los ejercicios de cardio/gasto: nombre canónico y, SOLO si no vino
 * un número de calorías, lo estima por MET real. Si el usuario ya dio las
 * calorías (ej. las del reloj/smartwatch), se respetan tal cual.
 */
export function enrichExercises<T extends ExItem>(
  items: T[],
  weight: number,
): T[] {
  return items.map((it) => {
    const m = matchExercise(it.name);
    if (!m) return it;
    const minutes = it.minutes > 0 ? it.minutes : 0;
    // Solo estimamos cuando NO hay calorías cargadas (respeta el dato del reloj).
    const caloriesBurned =
      it.caloriesBurned > 0
        ? it.caloriesBurned
        : m.met != null && minutes > 0
          ? caloriesFromMet(m.met, weight, minutes)
          : it.caloriesBurned;
    return { ...it, name: m.name_es, caloriesBurned };
  });
}

/** Enriquece los ejercicios de fuerza: solo normaliza el nombre al canónico. */
export function enrichStrength<T extends StrItem>(items: T[]): T[] {
  return items.map((it) => {
    const m = matchExercise(it.exercise);
    return m ? { ...it, exercise: m.name_es } : it;
  });
}
