/**
 * Tendencias: lo que se ve mirando semanas, no un día.
 *
 * Antes esto solo miraba comida y cardio, así que no podía detectar ni una
 * mejora de fuerza ni un estancamiento ni la falta de recuperación —los datos
 * estaban ahí, pero en otra tabla—. Ahora cruza fuerza, nutrición, sueño y
 * agua, que es de donde salen los avisos que sirven de verdad.
 */

import { dayDiff, weeklyLoad, type Signal, type Tone } from "@/lib/athlete";
import { MUSCLE_GROUPS, groupsOf } from "@/lib/gym";
import { ACTIVITIES, activityMismatch, type Profile } from "@/lib/nutrition";
import { dailySupplementProtein } from "@/lib/supplements";
import {
  WATER_GOAL_L,
  shiftISO,
  type DailyMetrics,
  type ExerciseEntry,
  type FoodEntry,
  type Goals,
  type StrengthSet,
  type Supplement,
  type SupplementLog,
} from "@/lib/types";

export type InsightTone = Tone;
export type Insight = Signal;

const ALCOHOL =
  /cerveza|birra|vino|fernet|whisky|whiskey|vodka|\bgin\b|trago|alcohol|champ[aá]n|licor|aperol/i;

/** Emoji del grupo muscular, para que el aviso se reconozca de un vistazo. */
const GROUP_EMOJI: Record<string, string> = {
  pecho: "💪",
  espalda: "🔙",
  piernas: "🦵",
  hombros: "🎽",
  brazos: "🦾",
};

export type InsightsInput = {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  strengthSets: StrengthSet[];
  metrics: DailyMetrics[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  goals: Goals;
  today: string;
  waterGoal?: number;
  /** Para contrastar el nivel de actividad declarado con el real. */
  profile?: Profile | null;
};

/** Insights accionables a partir del historial completo. */
export function buildInsights(input: InsightsInput): Insight[] {
  const {
    foods,
    exercises,
    strengthSets,
    metrics,
    supplements,
    supplementLogs,
    goals,
    today,
  } = input;
  const waterGoal = input.waterGoal ?? WATER_GOAL_L;

  const good: Insight[] = [];
  const warn: Insight[] = [];
  const info: Insight[] = [];

  const week = weeklyLoad(strengthSets, exercises, today);
  const inLastDays = (d: string, n: number) => {
    const diff = dayDiff(today, d);
    return diff >= 0 && diff < n;
  };

  // --- Perfil vs. realidad ---------------------------------------------------
  // Va primero porque, si está mal, TODO lo demás está calculado sobre una
  // meta equivocada: el factor de actividad multiplica el metabolismo entero.
  if (input.profile) {
    const trainDays = new Set(
      [
        ...strengthSets.map((s) => s.date),
        ...exercises.map((e) => e.date),
      ].filter((d) => inLastDays(d, 28)),
    ).size;
    const firstLog = [...foods, ...exercises, ...strengthSets]
      .map((x) => x.date)
      .sort()[0];
    const historyDays = firstLog
      ? Math.min(28, dayDiff(today, firstLog) + 1)
      : 0;
    const mismatch = activityMismatch(input.profile, trainDays, historyDays);
    if (mismatch) {
      const label = (k: string) =>
        ACTIVITIES.find((a) => a.key === k)?.label ?? k;
      warn.push({
        emoji: "⚙️",
        tone: "warn",
        text: `Tu perfil dice "${label(mismatch.declared)}" pero entrenás ${mismatch.actual} días/semana. Con "${label(
          mismatch.suggested,
        )}" tu meta sería ${Math.abs(mismatch.kcalDelta)} kcal ${
          mismatch.kcalDelta < 0 ? "más baja" : "más alta"
        }. Revisalo en tu perfil 👤`,
      });
    }
  }

  // --- Entrenamiento -------------------------------------------------------

  if (week.streak >= 2) {
    good.push({
      emoji: "🔥",
      tone: "good",
      text: `Llevás ${week.streak} días seguidos entrenando.`,
    });
  } else if (week.days >= 1) {
    info.push({
      emoji: "🏋️",
      tone: "info",
      text: `Entrenaste ${week.days} ${week.days === 1 ? "vez" : "veces"} esta semana.`,
    });
  }

  // Mejora de fuerza: PR reciente o salto de volumen contra la semana previa.
  const recentPr = latestPr(strengthSets, today, 7);
  if (recentPr) {
    good.push({
      emoji: "🏆",
      tone: "good",
      text: `Nuevo PR en ${recentPr.exercise}: ${recentPr.weight} kg (antes ${recentPr.prev} kg).`,
    });
  } else if (week.prevVolume > 0 && week.volume > week.prevVolume * 1.1) {
    const pct = Math.round((week.volume / week.prevVolume - 1) * 100);
    good.push({
      emoji: "📈",
      tone: "good",
      text: `Tu volumen subió ${pct}% respecto de la semana pasada.`,
    });
  }

  // Exceso de volumen: subir de golpe es la vía rápida a la lesión.
  if (week.prevVolume > 0 && week.volume > week.prevVolume * 1.5) {
    warn.push({
      emoji: "⚠️",
      tone: "warn",
      text: `Subiste el volumen más de un 50% de una semana a la otra. Bajá un poco o vas derecho a la lesión.`,
    });
  } else if (week.streak >= 6) {
    warn.push({
      emoji: "🛌",
      tone: "warn",
      text: `${week.streak} días seguidos entrenando sin descanso. El músculo crece descansando.`,
    });
  }

  // Estancamiento: mismo peso máximo dos ventanas seguidas.
  for (const stuck of stagnantLifts(strengthSets, today).slice(0, 1)) {
    warn.push({
      emoji: "🧱",
      tone: "warn",
      text: `Estancado en ${stuck.exercise}: seguís en ${stuck.weight} kg hace ${stuck.weeks} semanas. Probá bajar reps y subir el peso.`,
    });
  }

  // Grupos musculares abandonados (por las series reales, no por el nombre del
  // cardio: la fuerza vive en strengthSets).
  const lastByGroup = new Map<string, string>();
  for (const s of strengthSets) {
    for (const g of groupsOf(s.exercise)) {
      const prev = lastByGroup.get(g);
      if (!prev || s.date > prev) lastByGroup.set(g, s.date);
    }
  }
  for (const g of MUSCLE_GROUPS) {
    const last = lastByGroup.get(g);
    if (!last) continue;
    const gap = dayDiff(today, last);
    if (gap >= 7) {
      warn.push({
        emoji: GROUP_EMOJI[g] ?? "🏋️",
        tone: "warn",
        text: `Hace ${gap} días que no entrenás ${g}.`,
      });
    }
  }

  // --- Nutrición -----------------------------------------------------------

  const proteinByDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const date = shiftISO(today, -i);
    const fromFood = foods
      .filter((f) => f.date === date)
      .reduce((s, f) => s + f.protein, 0);
    const fromSup = dailySupplementProtein(supplements, supplementLogs, date);
    if (fromFood > 0 || fromSup > 0) proteinByDay.set(date, fromFood + fromSup);
  }
  if (proteinByDay.size >= 2) {
    const avg =
      [...proteinByDay.values()].reduce((s, v) => s + v, 0) / proteinByDay.size;
    if (avg >= goals.protein * 0.9) {
      good.push({
        emoji: "🥩",
        tone: "good",
        text: "Tu proteína viene excelente esta semana.",
      });
    } else if (avg < goals.protein * 0.6) {
      warn.push({
        emoji: "🥩",
        tone: "warn",
        text: `Proteína baja: promediás ${Math.round(avg)} g/día (meta ${goals.protein}).`,
      });
    }
  }

  const alcoholDays = new Set(
    foods.filter((f) => inLastDays(f.date, 7) && ALCOHOL.test(f.name)).map((f) => f.date),
  ).size;
  if (alcoholDays >= 3) {
    warn.push({
      emoji: "🍺",
      tone: "warn",
      text: `${alcoholDays} días con alcohol esta semana. Frena la recuperación y la síntesis de proteína.`,
    });
  } else if (alcoholDays >= 1) {
    const kcal = foods
      .filter((f) => f.date === today && ALCOHOL.test(f.name))
      .reduce((s, f) => s + f.calories, 0);
    if (kcal > 0) {
      info.push({
        emoji: "🍺",
        tone: "info",
        text: `El alcohol sumó ~${Math.round(kcal)} kcal hoy.`,
      });
    }
  }

  // --- Recuperación --------------------------------------------------------

  const sleepDays = metrics.filter(
    (m) => inLastDays(m.date, 7) && (m.sleepHours ?? 0) > 0,
  );
  if (sleepDays.length >= 3) {
    const avg =
      sleepDays.reduce((s, m) => s + (m.sleepHours ?? 0), 0) / sleepDays.length;
    if (avg < 6.5) {
      warn.push({
        emoji: "😴",
        tone: "warn",
        text: `Dormís ${avg.toFixed(1)} h en promedio. Con menos de 7 no recuperás ni construís músculo.`,
      });
    } else if (avg >= 7) {
      good.push({
        emoji: "😴",
        tone: "good",
        text: `Venís durmiendo ${avg.toFixed(1)} h de promedio. Así se recupera.`,
      });
    }
  }

  const waterDays = metrics.filter(
    (m) => inLastDays(m.date, 7) && (m.water ?? 0) > 0,
  );
  if (waterDays.length >= 3) {
    const avg =
      waterDays.reduce((s, m) => s + (m.water ?? 0), 0) / waterDays.length;
    if (avg < waterGoal * 0.6) {
      warn.push({
        emoji: "💧",
        tone: "warn",
        text: `Promediás ${avg.toFixed(1)} L de agua (meta ${waterGoal} L). Te baja fuerza y concentración.`,
      });
    }
  }

  // Los avisos primero: lo que hay que corregir es más útil que la palmada.
  return [...warn, ...good, ...info].slice(0, 5);
}

/** PR batido en los últimos `days` días (el más reciente). */
function latestPr(
  sets: StrengthSet[],
  today: string,
  days: number,
): { exercise: string; weight: number; prev: number; date: string } | null {
  const recent = sets.filter((s) => {
    const d = dayDiff(today, s.date);
    return d >= 0 && d < days;
  });
  let best: { exercise: string; weight: number; prev: number; date: string } | null =
    null;
  for (const s of recent) {
    if (!(s.weight > 0)) continue;
    const prev = sets
      .filter((o) => o.exercise === s.exercise && o.date < s.date)
      .reduce((m, o) => Math.max(m, o.weight), 0);
    if (prev > 0 && s.weight > prev) {
      if (!best || s.date > best.date) {
        best = { exercise: s.exercise, weight: s.weight, prev, date: s.date };
      }
    }
  }
  return best;
}

/**
 * Ejercicios trabados: el mejor peso de las últimas dos semanas no supera al de
 * las dos anteriores. Se piden 4 días distintos para no llamar "estancamiento"
 * a dos sesiones sueltas.
 */
function stagnantLifts(
  sets: StrengthSet[],
  today: string,
): { exercise: string; weight: number; weeks: number }[] {
  const byExercise = new Map<string, StrengthSet[]>();
  for (const s of sets) {
    const arr = byExercise.get(s.exercise) ?? [];
    arr.push(s);
    byExercise.set(s.exercise, arr);
  }

  const out: { exercise: string; weight: number; weeks: number }[] = [];
  for (const [exercise, arr] of byExercise) {
    const days = new Set(arr.map((s) => s.date));
    if (days.size < 4) continue;
    const maxIn = (from: number, to: number) =>
      arr
        .filter((s) => {
          const d = dayDiff(today, s.date);
          return d >= from && d < to;
        })
        .reduce((m, s) => Math.max(m, s.weight), 0);
    const recent = maxIn(0, 14);
    const before = maxIn(14, 28);
    if (recent > 0 && before > 0 && recent <= before) {
      out.push({ exercise, weight: recent, weeks: 4 });
    }
  }
  return out.sort(
    (a, b) =>
      (byExercise.get(b.exercise)?.length ?? 0) -
      (byExercise.get(a.exercise)?.length ?? 0),
  );
}
