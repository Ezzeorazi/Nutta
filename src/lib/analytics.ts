import { dailySupplementProtein } from "./supplements";
import type { ExerciseEntry, FoodEntry, Supplement, SupplementLog } from "./types";

export type DayStats = {
  date: string; // YYYY-MM-DD
  label: string; // Lun, Mar...
  dm: string; // d/m (para vistas largas)
  calories: number; // consumidas
  protein: number;
  carbs: number;
  fat: number;
  burned: number;
  net: number; // consumidas - quemadas
};

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Estadísticas por día para los últimos `days` días (incluye hoy). */
export function lastNDays(
  foods: FoodEntry[],
  exercises: ExerciseEntry[],
  days = 7,
  supplements: Supplement[] = [],
  supplementLogs: SupplementLog[] = [],
): DayStats[] {
  const out: DayStats[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = isoOf(d);

    const dayFoods = foods.filter((f) => f.date === date);
    const dayEx = exercises.filter((e) => e.date === date);

    const calories = dayFoods.reduce((s, f) => s + f.calories, 0);
    const protein =
      dayFoods.reduce((s, f) => s + f.protein, 0) +
      dailySupplementProtein(supplements, supplementLogs, date);
    const carbs = dayFoods.reduce((s, f) => s + f.carbs, 0);
    const fat = dayFoods.reduce((s, f) => s + f.fat, 0);
    const burned = dayEx.reduce((s, e) => s + e.caloriesBurned, 0);

    out.push({
      date,
      label: DOW[d.getDay()],
      dm: `${d.getDate()}/${d.getMonth() + 1}`,
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      burned: Math.round(burned),
      net: Math.round(calories - burned),
    });
  }
  return out;
}

/**
 * Promedios del período.
 *
 * Cada promedio se calcula SOLO sobre los días que tienen ese dato. Antes el
 * denominador era "días con actividad", así que un día en el que registraste el
 * entrenamiento pero no la comida entraba como 0 kcal comidas y hundía el
 * promedio: mostraba 1383 kcal/día a alguien que los días que registró comió
 * 2500. Un promedio que mezcla "comí poco" con "no anoté" no dice nada.
 */
export function averages(stats: DayStats[]) {
  const withFood = stats.filter((s) => s.calories > 0);
  const withTraining = stats.filter((s) => s.burned > 0);
  const active = stats.filter((s) => s.calories > 0 || s.burned > 0);
  const avg = (rows: DayStats[], k: keyof DayStats) =>
    rows.length
      ? Math.round(rows.reduce((acc, s) => acc + (s[k] as number), 0) / rows.length)
      : 0;
  return {
    daysLogged: active.length,
    /** Días con comida registrada: es la base de `calories` y `protein`. */
    daysWithFood: withFood.length,
    calories: avg(withFood, "calories"),
    protein: avg(withFood, "protein"),
    burned: avg(withTraining, "burned"),
  };
}
