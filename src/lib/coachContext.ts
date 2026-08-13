import { restDaysOf, weekBreakdown, weeklyLoad } from "@/lib/athlete";
import { readBody } from "@/lib/body";
import { groupsOf, MUSCLE_GROUPS } from "@/lib/gym";
import { OBJECTIVES, type ObjectiveKey } from "@/lib/nutrition";
import type {
  DailyMetrics,
  ExerciseEntry,
  FoodEntry,
  Goals,
  MeasureEntry,
  StrengthSet,
  WeightEntry,
} from "@/lib/types";

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

const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );

export type WeeklySummaryInput = {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  strengthSets: StrengthSet[];
  metrics: DailyMetrics[];
  weights: WeightEntry[];
  measures: MeasureEntry[];
  goals: Goals;
  objective?: ObjectiveKey;
  today: string;
};

/**
 * Resumen compacto de la última semana para el Coach IA (función pura).
 * No usa el AI SDK: se computa en el cliente y se manda al endpoint.
 *
 * Incluye entrenamiento, nutrición, descanso Y composición corporal: si el
 * resumen no trae sueño ni medidas, la IA no puede hacer otra cosa que hablar
 * de calorías, que es justo lo que no queremos.
 */
export function weeklySummary(input: WeeklySummaryInput): string {
  const {
    foods,
    exercises,
    strengthSets,
    metrics,
    weights,
    measures,
    goals,
    objective,
    today,
  } = input;
  const inWeek = (d: string) => {
    const diff = dayDiff(today, d);
    return diff >= 0 && diff <= 6;
  };
  const wFoods = foods.filter((f) => inWeek(f.date));
  const wEx = exercises.filter((e) => inWeek(e.date));
  const wSets = strengthSets.filter((s) => inWeek(s.date));
  const wMetrics = metrics.filter((m) => inWeek(m.date));

  // Días de entrenamiento REAL (fuerza o cardio estructurado). Contar acá las
  // caminatas hacía que la IA leyera "7/7 entrenamientos" y recomendara
  // descanso a alguien que en realidad había entrenado cuatro veces.
  const load = weeklyLoad(strengthSets, exercises, today, restDaysOf(metrics));
  const trainDays = load.days;
  const activities = [...new Set(wEx.map((e) => e.name.toLowerCase()))].slice(
    0,
    8,
  );
  const strengthNames = [
    ...new Set(wSets.map((s) => s.exercise.toLowerCase())),
  ].slice(0, 8);
  const groups = MUSCLE_GROUPS.filter((g) =>
    wSets.some((s) => groupsOf(s.exercise).includes(g)),
  );
  const objLabel = OBJECTIVES.find((o) => o.key === objective)?.label;

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

  // Volumen de fuerza y su comparación con la semana anterior: es la métrica
  // que dice si la persona está progresando, estancada o pasada de rosca.
  const volumeTrend =
    load.prevVolume > 0
      ? `${Math.round((load.volume / load.prevVolume - 1) * 100)}% vs. la semana anterior`
      : "sin semana previa para comparar";

  const avgOf = (vals: number[]) =>
    vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const sleep = avgOf(
    wMetrics.map((m) => m.sleepHours ?? 0).filter((h) => h > 0),
  );
  const water = avgOf(wMetrics.map((m) => m.water ?? 0).filter((l) => l > 0));
  const steps = avgOf(wMetrics.map((m) => m.steps ?? 0).filter((s) => s > 0));

  const body = readBody(weights, measures, today);

  return [
    `Objetivo: ${objLabel ?? "sin definir"}.`,
    `Entrenamientos: ${trainDays}/7 días de entrenamiento real — ${weekBreakdown(load) || "sin registros"}${
      activities.length ? ` (cardio: ${activities.join(", ")})` : ""
    }${strengthNames.length ? ` (fuerza: ${strengthNames.join(", ")})` : ""}.`,
    `Grupos trabajados: ${groups.length ? groups.join(", ") : "ninguno detectado"}.`,
    `Volumen de fuerza: ${Math.round(load.volume).toLocaleString("es-AR")} kg en ${
      wSets.length
    } series (${volumeTrend}). Racha: ${load.streak} días seguidos.`,
    `Promedio diario (${foodDays.size} días con registro): ${Math.round(
      sum.cal / n,
    )} kcal, ${Math.round(sum.prot / n)} g proteína (meta ${
      goals.protein
    }), ${Math.round(sum.carb / n)} g carbos, ${Math.round(
      sum.fat / n,
    )} g grasa.`,
    `Descanso e hidratación: ${
      sleep != null ? `${sleep.toFixed(1)} h de sueño` : "sueño sin registrar"
    }, ${water != null ? `${water.toFixed(1)} L de agua` : "agua sin registrar"}, ${
      steps != null
        ? `${Math.round(steps).toLocaleString("es-AR")} pasos`
        : "pasos sin registrar"
    } por día.`,
    `Composición corporal: ${body.headline.toLowerCase()}${
      body.deltas.length
        ? ` (${body.deltas
            .map(
              (d) =>
                `${d.label} ${d.delta > 0 ? "+" : "−"}${Math.abs(d.delta).toFixed(1)} ${d.unit}`,
            )
            .join(", ")})`
        : ""
    }.`,
    `Días con alcohol: ${alcoholDays}.`,
    `Metas: ${goals.calories} kcal, ${goals.protein} g proteína.`,
  ].join("\n");
}
