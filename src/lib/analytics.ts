import type { ExerciseEntry, FoodEntry } from "./types";

export type DayStats = {
  date: string; // YYYY-MM-DD
  label: string; // Lun, Mar...
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
    const protein = dayFoods.reduce((s, f) => s + f.protein, 0);
    const carbs = dayFoods.reduce((s, f) => s + f.carbs, 0);
    const fat = dayFoods.reduce((s, f) => s + f.fat, 0);
    const burned = dayEx.reduce((s, e) => s + e.caloriesBurned, 0);

    out.push({
      date,
      label: DOW[d.getDay()],
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

export function averages(stats: DayStats[]) {
  const logged = stats.filter((s) => s.calories > 0 || s.burned > 0);
  const n = logged.length || 1;
  const sum = (k: keyof DayStats) =>
    logged.reduce((acc, s) => acc + (s[k] as number), 0);
  return {
    daysLogged: logged.length,
    calories: Math.round(sum("calories") / n),
    protein: Math.round(sum("protein") / n),
    burned: Math.round(sum("burned") / n),
  };
}
