import { dailySupplementProtein } from "@/lib/supplements";
import type {
  ExerciseEntry,
  FoodEntry,
  Goals,
  Supplement,
  SupplementLog,
} from "@/lib/types";

export type InsightTone = "good" | "warn" | "info";
export type Insight = { emoji: string; text: string; tone: InsightTone };

/** Grupos musculares detectables por el nombre de la actividad. */
const MUSCLE_GROUPS: { key: string; label: string; re: RegExp; emoji: string }[] =
  [
    {
      key: "piernas",
      label: "piernas",
      emoji: "🦵",
      re: /pierna|cuadri|sentadilla|prensa|gemelo|gl[uú]teo|zancada|femoral|desplante/i,
    },
    {
      key: "espalda",
      label: "espalda",
      emoji: "🔙",
      re: /espalda|dorsal|remo|jal[oó]n|pull|dominada/i,
    },
    {
      key: "pecho",
      label: "pecho",
      emoji: "💪",
      re: /pecho|pectoral|banca|fondos|apertura/i,
    },
  ];

const ALCOHOL =
  /cerveza|birra|vino|fernet|whisky|whiskey|vodka|\bgin\b|trago|alcohol|champ[aá]n|licor|aperol/i;

const isoOffset = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );

/** Genera insights accionables a partir del historial. */
export function buildInsights(
  foods: FoodEntry[],
  exercises: ExerciseEntry[],
  goals: Goals,
  today: string,
  supplements: Supplement[] = [],
  supplementLogs: SupplementLog[] = [],
): Insight[] {
  const out: Insight[] = [];
  const exDates = new Set(exercises.map((e) => e.date));

  // Racha de entrenamiento (permite que hoy aún no esté hecho).
  let streak = 0;
  let cursor = exDates.has(today) ? today : isoOffset(today, -1);
  while (exDates.has(cursor)) {
    streak++;
    cursor = isoOffset(cursor, -1);
  }
  if (streak >= 2) {
    out.push({
      emoji: "🔥",
      tone: "good",
      text: `Llevás ${streak} días seguidos entrenando.`,
    });
  }

  // Entrenamientos en los últimos 7 días.
  let weekTrain = 0;
  for (let i = 0; i < 7; i++) if (exDates.has(isoOffset(today, -i))) weekTrain++;
  if (weekTrain >= 1 && streak < 2) {
    out.push({
      emoji: "🏋️",
      tone: "info",
      text: `Entrenaste ${weekTrain} ${
        weekTrain === 1 ? "vez" : "veces"
      } esta semana.`,
    });
  }

  // Grupos musculares sin entrenar hace tiempo.
  for (const g of MUSCLE_GROUPS) {
    const dates = exercises
      .filter((e) => g.re.test(e.name))
      .map((e) => e.date)
      .sort();
    if (dates.length === 0) continue;
    const gap = dayDiff(today, dates[dates.length - 1]);
    if (gap >= 7) {
      out.push({
        emoji: g.emoji,
        tone: "warn",
        text: `Hace ${gap} días que no entrenás ${g.label}.`,
      });
    }
  }

  // Tendencia de proteína (promedio de días con comida en la última semana).
  const proteinByDay = new Map<string, number>();
  for (const f of foods) {
    if (dayDiff(today, f.date) < 0 || dayDiff(today, f.date) > 6) continue;
    proteinByDay.set(f.date, (proteinByDay.get(f.date) ?? 0) + f.protein);
  }
  for (let i = 0; i <= 6; i++) {
    const date = isoOffset(today, -i);
    const supProtein = dailySupplementProtein(supplements, supplementLogs, date);
    if (supProtein > 0) {
      proteinByDay.set(date, (proteinByDay.get(date) ?? 0) + supProtein);
    }
  }
  if (proteinByDay.size >= 2) {
    const avg =
      [...proteinByDay.values()].reduce((s, v) => s + v, 0) /
      proteinByDay.size;
    if (avg >= goals.protein * 0.9) {
      out.push({
        emoji: "🥩",
        tone: "good",
        text: "Tu proteína viene excelente esta semana.",
      });
    } else if (avg < goals.protein * 0.6) {
      out.push({
        emoji: "🥩",
        tone: "warn",
        text: `Proteína baja: promediás ${Math.round(
          avg,
        )} g/día (meta ${goals.protein}).`,
      });
    }
  }

  // Alcohol hoy.
  const alcoholKcalToday = foods
    .filter((f) => f.date === today && ALCOHOL.test(f.name))
    .reduce((s, f) => s + f.calories, 0);
  if (alcoholKcalToday > 0) {
    out.push({
      emoji: "🍺",
      tone: "warn",
      text: `El alcohol sumó ~${Math.round(alcoholKcalToday)} kcal hoy.`,
    });
  }

  return out.slice(0, 4);
}
