import type { ExerciseEntry, FoodEntry, Goals } from "@/lib/types";

/**
 * Resume los alimentos que el usuario repite por comida (histórico), para dar
 * contexto a la IA y resolver "lo de siempre". Solo cuenta los repetidos (≥2).
 * Es una función pura y client-safe (no importa el AI SDK).
 */
export function frequentFoodsSummary(foods: FoodEntry[]): string {
  const byMeal = new Map<string, Map<string, number>>();
  for (const f of foods) {
    const key = f.name.trim().toLowerCase();
    if (!key) continue;
    const m = byMeal.get(f.meal) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + 1);
    byMeal.set(f.meal, m);
  }

  const parts: string[] = [];
  for (const [meal, counts] of byMeal) {
    const top = [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
    if (top.length) parts.push(`${meal}: ${top.join(", ")}`);
  }
  return parts.join(" | ");
}

const ALCOHOL_RE = /cerveza|birra|vino|fernet|whisky|vodka|\bgin\b|trago|alcohol|licor|aperol/i;
const MUSCLES: [string, RegExp][] = [
  ["piernas", /pierna|cuadri|sentadilla|prensa|gemelo|gl[uú]teo|femoral/i],
  ["espalda", /espalda|dorsal|remo|jal[oó]n|dominada/i],
  ["pecho", /pecho|pectoral|banca|apertura/i],
];

const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );

/**
 * Resumen compacto de la última semana para el Coach IA (función pura).
 * No usa el AI SDK: se computa en el cliente y se manda al endpoint.
 */
export function weeklySummary(
  foods: FoodEntry[],
  exercises: ExerciseEntry[],
  goals: Goals,
  today: string,
): string {
  const inWeek = (d: string) => {
    const diff = dayDiff(today, d);
    return diff >= 0 && diff <= 6;
  };
  const wFoods = foods.filter((f) => inWeek(f.date));
  const wEx = exercises.filter((e) => inWeek(e.date));

  const trainDays = new Set(wEx.map((e) => e.date)).size;
  const activities = [...new Set(wEx.map((e) => e.name.toLowerCase()))].slice(
    0,
    8,
  );
  const groups = MUSCLES.filter(([, re]) =>
    wEx.some((e) => re.test(e.name)),
  ).map(([g]) => g);

  const foodDays = new Set(wFoods.map((f) => f.date));
  const n = Math.max(1, foodDays.size);
  const sum = wFoods.reduce(
    (a, f) => {
      a.cal += f.calories;
      a.prot += f.protein;
      a.carb += f.carbs;
      a.fat += f.fat;
      return a;
    },
    { cal: 0, prot: 0, carb: 0, fat: 0 },
  );
  const alcoholDays = new Set(
    wFoods.filter((f) => ALCOHOL_RE.test(f.name)).map((f) => f.date),
  ).size;

  return [
    `Entrenamientos: ${trainDays}/7 días${
      activities.length ? ` (${activities.join(", ")})` : ""
    }.`,
    `Grupos trabajados: ${groups.length ? groups.join(", ") : "ninguno detectado"}.`,
    `Promedio diario (${foodDays.size} días con registro): ${Math.round(
      sum.cal / n,
    )} kcal, ${Math.round(sum.prot / n)} g proteína (meta ${
      goals.protein
    }), ${Math.round(sum.carb / n)} g carbos, ${Math.round(
      sum.fat / n,
    )} g grasa.`,
    `Días con alcohol: ${alcoholDays}.`,
    `Metas: ${goals.calories} kcal, ${goals.protein} g proteína.`,
  ].join("\n");
}
