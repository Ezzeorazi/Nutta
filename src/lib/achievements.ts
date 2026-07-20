import {
  WATER_GOAL_L,
  type DailyMetrics,
  type ExerciseEntry,
  type FoodEntry,
  type PhotoEntry,
  type StrengthSet,
  type WeightEntry,
} from "@/lib/types";

const isoOffset = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

export type Streak = { current: number; best: number };

/** Racha actual (que termina hoy o ayer) y mejor racha histórica. */
export function streakFromDates(dates: Set<string>, today: string): Streak {
  if (dates.size === 0) return { current: 0, best: 0 };
  const sorted = [...dates].sort();

  // Mejor racha: corrida consecutiva más larga.
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (isoOffset(sorted[i - 1], 1) === sorted[i]) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  // Racha actual: cuenta hacia atrás desde hoy (o ayer si hoy no hay).
  let current = 0;
  let cursor = dates.has(today) ? today : isoOffset(today, -1);
  while (dates.has(cursor)) {
    current++;
    cursor = isoOffset(cursor, -1);
  }
  return { current, best };
}

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress?: { cur: number; target: number };
};

export type AchievementInput = {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  strengthSets: StrengthSet[];
  weights: WeightEntry[];
  metrics: DailyMetrics[];
  photos: Pick<PhotoEntry, "id">[];
  targetWeight?: number;
  today: string;
};

/** Días con alguna actividad registrada (comida, ejercicio, fuerza, métricas, peso). */
export function activeDays(input: AchievementInput): Set<string> {
  const s = new Set<string>();
  for (const f of input.foods) s.add(f.date);
  for (const e of input.exercises) s.add(e.date);
  for (const st of input.strengthSets) s.add(st.date);
  for (const m of input.metrics) s.add(m.date);
  for (const w of input.weights) s.add(w.date);
  return s;
}

const trainingDays = (input: AchievementInput): Set<string> => {
  const s = new Set<string>();
  for (const e of input.exercises) s.add(e.date);
  for (const st of input.strengthSets) s.add(st.date);
  return s;
};

/** Calcula los logros (desbloqueados o con progreso). */
export function computeAchievements(input: AchievementInput): Achievement[] {
  const active = activeDays(input);
  const logStreak = streakFromDates(active, input.today);
  const trainStreak = streakFromDates(trainingDays(input), input.today);
  const trainCount = trainingDays(input).size;

  const goodWater = input.metrics.some((m) => (m.water ?? 0) >= WATER_GOAL_L);
  const goodSleep = input.metrics.some(
    (m) => (m.sleepHours ?? 0) >= 7 && (m.sleepHours ?? 0) <= 9,
  );
  const latestWeight = input.weights.at(-1)?.kg;
  const reachedTarget =
    input.targetWeight != null &&
    latestWeight != null &&
    Math.abs(latestWeight - input.targetWeight) <= 0.5;

  const mk = (
    id: string,
    emoji: string,
    title: string,
    desc: string,
    cur: number,
    target: number,
  ): Achievement => ({
    id,
    emoji,
    title,
    desc,
    unlocked: cur >= target,
    progress: { cur: Math.min(cur, target), target },
  });

  const list: Achievement[] = [
    mk("first-log", "🥗", "Primer paso", "Registrá tu primer alimento", input.foods.length, 1),
    mk("streak-7", "🔥", "En racha", "7 días seguidos activo", logStreak.best, 7),
    mk("streak-30", "📅", "Imparable", "30 días activo en total", active.size, 30),
    mk("train-10", "🏋️", "Fierrero", "10 días de entrenamiento", trainCount, 10),
    mk("train-streak", "💪", "Disciplina", "5 días seguidos entrenando", trainStreak.best, 5),
    mk("first-pr", "🏆", "Primer PR", "Cargá tu primera serie de fuerza", input.strengthSets.length, 1),
    mk("weigh-5", "⚖️", "Bajo control", "Registrá tu peso 5 veces", input.weights.length, 5),
    mk("photos-2", "📸", "Antes y después", "Subí 2 fotos de progreso", input.photos.length, 2),
    {
      id: "hydrated",
      emoji: "💧",
      title: "Hidratado",
      desc: "Cumplí tu meta de agua un día",
      unlocked: goodWater,
    },
    {
      id: "rested",
      emoji: "😴",
      title: "Bien descansado",
      desc: "Dormí 7-9 h un día",
      unlocked: goodSleep,
    },
    {
      id: "target-weight",
      emoji: "🎯",
      title: "Meta cumplida",
      desc: "Alcanzá tu peso objetivo",
      unlocked: reachedTarget,
    },
  ];

  // Desbloqueados primero.
  return list.sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
}
