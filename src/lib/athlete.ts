/**
 * Estado del atleta: la capa que cruza TODOS los datos del usuario.
 *
 * El problema que resuelve: cada módulo miraba su propia rebanada. El score no
 * veía las series de fuerza (entrenabas una hora de gym y te decía "hoy no
 * registraste entrenamiento"), los insights no veían el sueño, la rutina no
 * veía la recuperación y las metas de macros eran las mismas entrenando fuerte
 * que en el sillón.
 *
 * Acá se calcula una sola vez lo que un entrenador tiene en la cabeza antes de
 * abrir la boca: qué entrenaste, cómo venís de recuperado, cuánto te falta
 * comer HOY (ajustado a lo que hiciste hoy) y qué conviene hacer ahora. Score,
 * insights, rutina y coach leen de acá.
 *
 * Es una función pura y client-safe: no toca la red, la IA ni el reloj.
 */

import { caloriesFromMet } from "@/lib/exercises";
import { groupsOf, setVolume } from "@/lib/gym";
import { waterGoalL } from "@/lib/nutrition";
import { carbPlan, proteinPlan, type MealPlan } from "@/lib/meals";
import { dailySupplementProtein } from "@/lib/supplements";
import {
  STEPS_GOAL,
  WATER_GOAL_L,
  shiftISO,
  type DailyMetrics,
  type DrinkEntry,
  type ExerciseEntry,
  type FoodEntry,
  type Goals,
  type StrengthSet,
  type Supplement,
  type SupplementLog,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Tipos compartidos
// ---------------------------------------------------------------------------

export type Tone = "good" | "warn" | "info";

/** Una línea que la app le dice al usuario (insight, tip del coach, tendencia). */
export type Signal = { emoji: string; text: string; tone: Tone };

export type Intensity = "descanso" | "suave" | "medio" | "fuerte";

export const INTENSITY_LABEL: Record<Intensity, string> = {
  descanso: "Descanso",
  suave: "Suave",
  medio: "Medio",
  fuerte: "Fuerte",
};

/**
 * La intensidad dentro de una frase. Existe porque `Sesión ${label}` producía
 * "Sesión medio": el sustantivo es femenino y la etiqueta suelta, masculina.
 */
export const INTENSITY_PHRASE: Record<Intensity, string> = {
  descanso: "Día de descanso",
  suave: "Sesión suave",
  medio: "Sesión media",
  fuerte: "Sesión fuerte",
};

/** Orden de menor a mayor, para poder quedarse con la señal más alta. */
const INTENSITY_RANK: Intensity[] = ["descanso", "suave", "medio", "fuerte"];

/** Cuánto "vale" cada intensidad para el score y las metas. */
const INTENSITY_RATIO: Record<Intensity, number> = {
  descanso: 0,
  suave: 0.7,
  medio: 0.9,
  fuerte: 1,
};

/** Ajuste de carbohidratos según lo que se entrenó (objetivos dinámicos). */
const CARB_FACTOR: Record<Intensity, number> = {
  descanso: -0.15,
  suave: 0,
  medio: 0.1,
  fuerte: 0.2,
};

/** MET de musculación entre moderada e intensa (Compendium of Physical Activities). */
const STRENGTH_MET = 5;

/** Minutos que ocupa una serie con su descanso (para estimar duración y gasto). */
const MINUTES_PER_SET = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Días entre dos fechas YYYY-MM-DD (`a - b`), en local. */
export const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );

/** 1 cuando `value` ≈ `goal`, cae a 0 al desviarse más de `tol` (fracción). */
export function closeness(value: number, goal: number, tol: number) {
  if (goal <= 0) return value > 0 ? 0.5 : 0;
  return clamp(1 - Math.abs(value - goal) / goal / tol, 0, 1);
}

/**
 * Calidad del sueño según horas (ideal 7-9 h).
 *
 * La curva por debajo de 7 h es más dura que un simple `horas/7`: con esa
 * proporción, 5,5 h daba 0,75 y la app te decía que tu sueño estaba "bien"
 * justo debajo del cartel que te pedía dormir más. Acá 6,5 h es "bien",
 * 5,5 h es "regular" y menos de 4,5 h es "flojo".
 */
export function sleepRatio(hours: number): number {
  if (hours <= 0) return 0;
  if (hours >= 7 && hours <= 9) return 1;
  if (hours < 7) return clamp((hours - 3) / 4, 0, 1) * 0.9;
  return clamp(1 - (hours - 9) * 0.1, 0.5, 0.9); // dormir de más resta un poco
}

/** Etiqueta cualitativa de un 0-1. Es como habla un entrenador, no un planilla. */
export function rate(ratio: number): string {
  if (ratio >= 0.85) return "Excelente";
  if (ratio >= 0.65) return "Bien";
  if (ratio >= 0.4) return "Regular";
  return "Flojo";
}

const sum = <T,>(arr: T[], f: (t: T) => number) =>
  arr.reduce((s, x) => s + f(x), 0);

// ---------------------------------------------------------------------------
// Entrenamiento del día
// ---------------------------------------------------------------------------

export type PersonalRecord = { exercise: string; weight: number; prev: number };

export type TrainingDay = {
  trained: boolean;
  intensity: Intensity;
  /** Volumen de fuerza (reps × peso) del día, en kg. */
  volume: number;
  sets: number;
  exercises: number;
  groups: string[];
  cardioMinutes: number;
  cardioBurned: number;
  /** Duración estimada de la sesión de fuerza (≈3 min por serie). */
  strengthMinutes: number;
  /** Gasto estimado de la sesión de fuerza (MET real × peso × duración). */
  strengthBurned: number;
  /** Duración total (cardio + fuerza estimada). */
  minutes: number;
  /** Gasto total (cardio registrado + fuerza estimada). */
  burned: number;
  /** PR batidos ese día (peso mayor que cualquier día anterior). */
  prs: PersonalRecord[];
  /** "Efecto del entrenamiento" del reloj (0-5), si vino en algún cardio. */
  effect: number | null;
};

/**
 * Qué se entrenó un día concreto, mirando fuerza Y cardio.
 *
 * `bodyWeight` se usa para estimar el gasto de la sesión de fuerza, que nunca
 * se registra en ningún lado (nadie carga "musculación 50 min" además de sus
 * series) y sin embargo es la mitad del gasto de quien va al gym.
 */
export function trainingOfDay(
  strengthSets: StrengthSet[],
  exercises: ExerciseEntry[],
  date: string,
  bodyWeight: number,
  refVolume = 0,
): TrainingDay {
  const daySets = strengthSets.filter((s) => s.date === date);
  const dayCardio = exercises.filter((e) => e.date === date);

  const volume = sum(daySets, setVolume);
  const sets = daySets.length;
  const exerciseNames = new Set(daySets.map((s) => s.exercise));
  const groups = [
    ...new Set(daySets.flatMap((s) => groupsOf(s.exercise))),
  ];

  const cardioMinutes = sum(dayCardio, (e) => e.minutes);
  const cardioBurned = sum(dayCardio, (e) => e.caloriesBurned);
  const strengthMinutes = Math.min(150, sets * MINUTES_PER_SET);
  const strengthBurned =
    strengthMinutes > 0 && bodyWeight > 0
      ? caloriesFromMet(STRENGTH_MET, bodyWeight, strengthMinutes)
      : 0;

  const effects = dayCardio
    .map((e) => e.trainingEffect)
    .filter((v): v is number => v != null);
  const effect = effects.length ? Math.max(...effects) : null;

  // PR del día: peso mayor a todo lo levantado en ese ejercicio ANTES de hoy.
  const prs: PersonalRecord[] = [];
  for (const name of exerciseNames) {
    const best = Math.max(
      ...daySets.filter((s) => s.exercise === name).map((s) => s.weight),
    );
    if (!(best > 0)) continue;
    const prev = strengthSets
      .filter((s) => s.exercise === name && s.date < date)
      .reduce((m, s) => Math.max(m, s.weight), 0);
    if (prev > 0 && best > prev) prs.push({ exercise: name, weight: best, prev });
  }

  const trained = sets > 0 || cardioMinutes > 0;
  const intensity = classifyIntensity({
    trained,
    volume,
    sets,
    cardioMinutes,
    refVolume,
    effect,
  });

  return {
    trained,
    intensity,
    volume,
    sets,
    exercises: exerciseNames.size,
    groups,
    cardioMinutes,
    cardioBurned,
    strengthMinutes,
    strengthBurned,
    minutes: cardioMinutes + strengthMinutes,
    burned: cardioBurned + strengthBurned,
    prs,
    effect,
  };
}

function classifyIntensity(x: {
  trained: boolean;
  volume: number;
  sets: number;
  cardioMinutes: number;
  refVolume: number;
  effect: number | null;
}): Intensity {
  if (!x.trained) return "descanso";

  // Volumen: se compara contra las propias sesiones, porque 20 series son
  // "fuerte" para uno y rutina para otro. Sin historial, umbrales absolutos.
  const ratio = x.refVolume > 0 ? x.volume / x.refVolume : 0;
  const byLoad: Intensity =
    x.sets >= 16 || ratio >= 1.15 || x.cardioMinutes >= 60
      ? "fuerte"
      : x.sets >= 8 || ratio >= 0.7 || x.cardioMinutes >= 35
        ? "medio"
        : "suave";

  if (x.effect == null) return byLoad;

  // El "efecto del entrenamiento" del reloj mide SOLO la actividad que el reloj
  // registró (el cardio), no las series de fuerza. Antes pisaba todo y un día
  // de 26 series + 88 min de cardio salía "medio" porque el reloj dijo 2.5. Se
  // toma la señal más alta de las dos, no la del reloj.
  const byEffect: Intensity =
    x.effect >= 3.5 ? "fuerte" : x.effect >= 2 ? "medio" : "suave";
  return INTENSITY_RANK.indexOf(byEffect) > INTENSITY_RANK.indexOf(byLoad)
    ? byEffect
    : byLoad;
}

// ---------------------------------------------------------------------------
// Carga semanal
// ---------------------------------------------------------------------------

export type WeekLoad = {
  /** Volumen de fuerza de los últimos 7 días (incluye `date`). */
  volume: number;
  sets: number;
  /** Días distintos con entrenamiento (fuerza o cardio) en esos 7 días. */
  days: number;
  /** Volumen de los 7 días anteriores a esos (para comparar). */
  prevVolume: number;
  /** Volumen promedio por sesión de las últimas 4 semanas (excluye `date`). */
  avgSessionVolume: number;
  /** Días seguidos entrenando que terminan en `date`. */
  streak: number;
};

export function weeklyLoad(
  strengthSets: StrengthSet[],
  exercises: ExerciseEntry[],
  date: string,
): WeekLoad {
  const inRange = (d: string, from: number, to: number) => {
    const diff = dayDiff(date, d);
    return diff >= from && diff <= to;
  };

  const week = strengthSets.filter((s) => inRange(s.date, 0, 6));
  const prev = strengthSets.filter((s) => inRange(s.date, 7, 13));
  const trainDays = new Set<string>();
  for (const s of week) trainDays.add(s.date);
  for (const e of exercises) if (inRange(e.date, 0, 6)) trainDays.add(e.date);

  // Promedio por sesión de las últimas 4 semanas, SIN el día en curso: sirve de
  // vara para saber si la sesión de hoy fue fuerte para esta persona.
  const past = strengthSets.filter((s) => inRange(s.date, 1, 28));
  const byDay = new Map<string, number>();
  for (const s of past) {
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + setVolume(s));
  }
  const avgSessionVolume = byDay.size
    ? [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size
    : 0;

  const allDays = new Set<string>([
    ...strengthSets.map((s) => s.date),
    ...exercises.map((e) => e.date),
  ]);
  // Se permite que hoy todavía no esté entrenado: si no, a la mañana la racha
  // de cinco días seguidos aparecería como cero y perderíamos la señal de fatiga.
  let streak = 0;
  let cursor = allDays.has(date) ? date : shiftISO(date, -1);
  while (allDays.has(cursor)) {
    streak++;
    cursor = shiftISO(cursor, -1);
  }

  return {
    volume: sum(week, setVolume),
    sets: week.length,
    days: trainDays.size,
    prevVolume: sum(prev, setVolume),
    avgSessionVolume,
    streak,
  };
}

// ---------------------------------------------------------------------------
// Nutrición dinámica
// ---------------------------------------------------------------------------

export type NutritionState = {
  /** Lo consumido ese día (proteína incluye la de suplementos). */
  consumed: Goals;
  /** Calorías netas: consumidas − quemadas en cardio. Es lo que muestra el anillo. */
  netCalories: number;
  /** Metas del día YA ajustadas por lo que se entrenó. */
  goals: Goals;
  /** Metas del perfil, sin ajustar. */
  base: Goals;
  /**
   * Lo que falta para llegar (negativo si se pasó). En `calories` se usa el
   * NETO, igual que el anillo: si no, la tarjeta decía "faltan 1024 kcal"
   * mientras el anillo de arriba decía 1505.
   */
  remaining: Goals;
  /** Carbohidratos sumados (o restados) por el entrenamiento del día. */
  carbDelta: number;
  /** Por qué se ajustó. `null` si no hubo ajuste. */
  reason: string | null;
};

/**
 * Metas del día ajustadas al entrenamiento (objetivos dinámicos).
 *
 * Se mueve SOLO el carbohidrato: es el macro que paga el entrenamiento. La
 * proteína queda alta siempre —entrenes o no— porque es la que sostiene el
 * músculo, y la grasa se deja fija para no desarmar el perfil hormonal.
 */
export function dynamicGoals(
  base: Goals,
  intensity: Intensity,
  isToday: boolean,
): { goals: Goals; carbDelta: number; reason: string | null } {
  const factor = CARB_FACTOR[intensity];
  const carbDelta = Math.round(base.carbs * factor);
  if (carbDelta === 0) {
    return { goals: base, carbDelta: 0, reason: null };
  }
  const goals: Goals = {
    ...base,
    carbs: Math.max(0, base.carbs + carbDelta),
    calories: Math.max(1200, base.calories + carbDelta * 4),
  };
  const reason =
    carbDelta > 0
      ? `Entrenaste ${intensity === "fuerte" ? "fuerte" : "hoy"}: +${carbDelta} g de carbos para reponer.`
      : `${isToday ? "Todavía no entrenaste" : "Día sin entrenamiento"}: −${Math.abs(carbDelta)} g de carbos. La proteína se mantiene.`;
  return { goals, carbDelta, reason };
}

function nutritionOfDay(
  foods: FoodEntry[],
  drinks: DrinkEntry[],
  supplements: Supplement[],
  supplementLogs: SupplementLog[],
  date: string,
  base: Goals,
  intensity: Intensity,
  isToday: boolean,
  cardioBurned: number,
): NutritionState {
  const day = foods.filter((f) => f.date === date);
  const dayDrinks = drinks.filter((d) => d.date === date);
  const consumed: Goals = {
    calories: Math.round(
      sum(day, (f) => f.calories) + sum(dayDrinks, (d) => d.calories),
    ),
    protein: Math.round(
      sum(day, (f) => f.protein) +
        dailySupplementProtein(supplements, supplementLogs, date),
    ),
    carbs: Math.round(sum(day, (f) => f.carbs)),
    fat: Math.round(sum(day, (f) => f.fat)),
  };
  const { goals, carbDelta, reason } = dynamicGoals(base, intensity, isToday);
  // El neto es el mismo que muestra el anillo de calorías (consumidas menos
  // quemadas). Los macros no se netean: el ejercicio no te devuelve proteína.
  const netCalories = Math.max(0, consumed.calories - Math.round(cardioBurned));
  return {
    consumed,
    netCalories,
    goals,
    base,
    carbDelta,
    reason,
    remaining: {
      calories: goals.calories - netCalories,
      protein: goals.protein - consumed.protein,
      carbs: goals.carbs - consumed.carbs,
      fat: goals.fat - consumed.fat,
    },
  };
}

// ---------------------------------------------------------------------------
// Recuperación
// ---------------------------------------------------------------------------

export type RecoveryFactor = {
  label: string;
  weight: number;
  ratio: number;
  note: string;
};

export type Recovery = {
  /** 0-100. `null` cuando no hay ningún dato para calcularlo. */
  score: number | null;
  label: string;
  factors: RecoveryFactor[];
  /** La acción más útil para recuperar mejor. */
  advice: string;
};

function buildRecovery(x: {
  metrics: DailyMetrics[];
  date: string;
  week: WeekLoad;
  nutritionYesterday: { calories: number; protein: number } | null;
  goals: Goals;
  waterGoal: number;
}): Recovery {
  const factors: RecoveryFactor[] = [];
  const metricOf = (d: string) => x.metrics.find((m) => m.date === d);

  // Sueño: el factor que más pesa. Se mira la noche del día y, si no está
  // cargada, la anterior (mucha gente carga el sueño al día siguiente).
  const sleepToday = metricOf(x.date)?.sleepHours;
  const sleepPrev = metricOf(shiftISO(x.date, -1))?.sleepHours;
  const hours = sleepToday ?? sleepPrev;
  if (hours != null && hours > 0) {
    factors.push({
      label: "Sueño",
      weight: 40,
      ratio: sleepRatio(hours),
      note: `${hours} h`,
    });
  }

  // Carga: días seguidos entrenando y salto de volumen contra la semana previa.
  if (x.week.days > 0 || x.week.streak > 0) {
    let ratio = 1;
    const notes: string[] = [];
    if (x.week.streak >= 6) {
      ratio -= 0.5;
      notes.push(`${x.week.streak} días seguidos`);
    } else if (x.week.streak >= 4) {
      ratio -= 0.25;
      notes.push(`${x.week.streak} días seguidos`);
    }
    if (x.week.prevVolume > 0 && x.week.volume > x.week.prevVolume * 1.5) {
      ratio -= 0.25;
      notes.push("volumen muy por encima de la semana pasada");
    }
    factors.push({
      label: "Carga",
      weight: 25,
      ratio: clamp(ratio, 0, 1),
      note: notes.join(" · ") || `${x.week.days} días esta semana`,
    });
  }

  // Nutrición de ayer: se recupera con lo que se comió, no con lo que se come.
  if (x.nutritionYesterday) {
    const { calories, protein } = x.nutritionYesterday;
    const ratio =
      clamp(protein / (x.goals.protein || 1), 0, 1) * 0.6 +
      closeness(calories, x.goals.calories, 0.4) * 0.4;
    factors.push({
      label: "Nutrición de ayer",
      weight: 20,
      ratio,
      note: `${Math.round(calories)} kcal · ${Math.round(protein)} g P`,
    });
  }

  const water = metricOf(x.date)?.water;
  if (water != null && water > 0) {
    factors.push({
      label: "Hidratación",
      weight: 15,
      ratio: clamp(water / x.waterGoal, 0, 1),
      note: `${water} L`,
    });
  }

  if (factors.length === 0) {
    return {
      score: null,
      label: "Sin datos",
      factors,
      advice: "Registrá tu sueño para que pueda medir tu recuperación.",
    };
  }

  const totalW = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(
    (factors.reduce((s, f) => s + f.weight * f.ratio, 0) / totalW) * 100,
  );

  const weakest = [...factors].sort((a, b) => a.ratio - b.ratio)[0];
  let advice: string;
  if (score >= 80) advice = "Estás fresco: es un buen día para ir a buscar un PR.";
  else if (weakest.label === "Sueño")
    advice = "Dormí al menos 7 horas hoy: es lo que más te está frenando.";
  else if (weakest.label === "Carga")
    advice = "Venís acumulando carga: metete un día suave o de descanso.";
  else if (weakest.label === "Nutrición de ayer")
    advice = "Comiste poco ayer: sumá calorías y proteína para recuperar.";
  else advice = "Tomá más agua: la deshidratación te baja el rendimiento.";

  return {
    score,
    label:
      score >= 80
        ? "Recuperado"
        : score >= 60
          ? "Aceptable"
          : score >= 40
            ? "Justo"
            : "Bajo",
    factors,
    advice,
  };
}

// ---------------------------------------------------------------------------
// Estado completo
// ---------------------------------------------------------------------------

export type StatusRow = {
  key: string;
  emoji: string;
  label: string;
  ratio: number;
  /** `false` cuando no hay dato ese día (no se juzga lo que no se registró). */
  logged: boolean;
  value: string;
};

export type AthleteInput = {
  foods: FoodEntry[];
  drinks: DrinkEntry[];
  exercises: ExerciseEntry[];
  strengthSets: StrengthSet[];
  metrics: DailyMetrics[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  goals: Goals;
  /** Peso corporal del perfil (para estimar el gasto de la sesión de fuerza). */
  bodyWeight: number;
  /** Día que se está mirando. */
  date: string;
  today: string;
};

export type AthleteState = {
  date: string;
  isToday: boolean;
  training: TrainingDay;
  week: WeekLoad;
  nutrition: NutritionState;
  recovery: Recovery;
  waterGoal: number;
  /** Las cinco filas del panel "Estado actual". */
  status: StatusRow[];
  /** La única cosa que hay que hacer ahora. */
  headline: string;
  /** Lectura del entrenamiento + nutrición, en tono entrenador. */
  coach: Signal[];
  /** Qué comer para cerrar lo que falta. `null` si no falta nada relevante. */
  meal: NextMeal | null;
};

/** El macro que hay que cerrar y cómo hacerlo en la próxima comida. */
export type NextMeal = { macro: "proteína" | "carbohidratos"; plan: MealPlan };

/** Cruza todos los datos del usuario y devuelve el estado del día. */
export function buildAthleteState(input: AthleteInput): AthleteState {
  const { date, today } = input;
  const isToday = date === today;
  const waterGoal = input.bodyWeight > 0 ? waterGoalL(input.bodyWeight) : WATER_GOAL_L;

  const week = weeklyLoad(input.strengthSets, input.exercises, date);
  const training = trainingOfDay(
    input.strengthSets,
    input.exercises,
    date,
    input.bodyWeight,
    week.avgSessionVolume,
  );
  const nutrition = nutritionOfDay(
    input.foods,
    input.drinks,
    input.supplements,
    input.supplementLogs,
    date,
    input.goals,
    training.intensity,
    isToday,
    training.cardioBurned,
  );

  const yesterday = shiftISO(date, -1);
  const yFoods = input.foods.filter((f) => f.date === yesterday);
  const yDrinks = input.drinks.filter((d) => d.date === yesterday);
  const nutritionYesterday = yFoods.length || yDrinks.length
    ? {
        calories: sum(yFoods, (f) => f.calories) + sum(yDrinks, (d) => d.calories),
        protein:
          sum(yFoods, (f) => f.protein) +
          dailySupplementProtein(input.supplements, input.supplementLogs, yesterday),
      }
    : null;

  const recovery = buildRecovery({
    metrics: input.metrics,
    date,
    week,
    nutritionYesterday,
    goals: input.goals,
    waterGoal,
  });

  const dayMetrics = input.metrics.find((m) => m.date === date);
  const status = buildStatus({
    training,
    nutrition,
    metrics: dayMetrics,
    waterGoal,
  });
  const { headline, coach, meal } = buildCoach({
    training,
    nutrition,
    recovery,
    week,
    metrics: dayMetrics,
    waterGoal,
    isToday,
    foodsOfDay: input.foods.filter((f) => f.date === date),
  });

  return {
    date,
    isToday,
    training,
    week,
    nutrition,
    recovery,
    waterGoal,
    status,
    headline,
    coach,
    meal,
  };
}

function buildStatus(x: {
  training: TrainingDay;
  nutrition: NutritionState;
  metrics?: DailyMetrics;
  waterGoal: number;
}): StatusRow[] {
  const { training, nutrition, metrics, waterGoal } = x;
  const sleep = metrics?.sleepHours;
  const water = metrics?.water;
  const steps = metrics?.steps;

  return [
    {
      key: "entrenamiento",
      emoji: "🏋️",
      label: "Entrenamiento",
      ratio: INTENSITY_RATIO[training.intensity],
      logged: true,
      value: training.trained
        ? training.volume > 0
          ? `${INTENSITY_LABEL[training.intensity]} · ${Math.round(training.volume).toLocaleString("es-AR")} kg`
          : `${INTENSITY_LABEL[training.intensity]} · ${training.cardioMinutes} min`
        : "Sin registrar",
    },
    {
      key: "proteina",
      emoji: "🥩",
      label: "Proteína",
      ratio: clamp(nutrition.consumed.protein / (nutrition.goals.protein || 1), 0, 1),
      logged: true,
      value: `${nutrition.consumed.protein} / ${nutrition.goals.protein} g`,
    },
    {
      key: "sueno",
      emoji: "😴",
      label: "Sueño",
      ratio: sleep ? sleepRatio(sleep) : 0,
      logged: sleep != null && sleep > 0,
      value: sleep ? `${sleep} h` : "Sin registrar",
    },
    {
      key: "agua",
      emoji: "💧",
      label: "Agua",
      ratio: water ? clamp(water / waterGoal, 0, 1) : 0,
      logged: water != null && water > 0,
      value: water ? `${water} / ${waterGoal} L` : "Sin registrar",
    },
    {
      key: "pasos",
      emoji: "👣",
      label: "Pasos",
      ratio: steps ? clamp(steps / STEPS_GOAL, 0, 1) : 0,
      logged: steps != null && steps > 0,
      value: steps ? steps.toLocaleString("es-AR") : "Sin registrar",
    },
  ];
}

/**
 * Lo que diría un entrenador mirando la pantalla: primero lee el
 * entrenamiento, después lo cruza con lo que comió y recién ahí recomienda.
 */
function buildCoach(x: {
  training: TrainingDay;
  nutrition: NutritionState;
  recovery: Recovery;
  week: WeekLoad;
  metrics?: DailyMetrics;
  waterGoal: number;
  isToday: boolean;
  foodsOfDay: FoodEntry[];
}): { headline: string; coach: Signal[]; meal: NextMeal | null } {
  const { training, nutrition, recovery, week, metrics, isToday } = x;
  const coach: Signal[] = [];
  const falta = nutrition.remaining;

  // 1) Lectura del entrenamiento.
  if (training.trained) {
    const partes = [
      training.volume > 0 &&
        `${Math.round(training.volume).toLocaleString("es-AR")} kg de volumen en ${training.sets} ${training.sets === 1 ? "serie" : "series"}`,
      training.cardioMinutes > 0 && `${training.cardioMinutes} min de cardio`,
      training.burned > 0 && `~${Math.round(training.burned)} kcal`,
    ].filter(Boolean);
    coach.push({
      emoji: training.intensity === "fuerte" ? "🔥" : "💪",
      tone: "good",
      text: `${INTENSITY_PHRASE[training.intensity]}: ${partes.join(" · ")}.`,
    });
  }

  for (const pr of training.prs.slice(0, 2)) {
    coach.push({
      emoji: "🏆",
      tone: "good",
      text: `PR en ${pr.exercise}: ${pr.weight} kg (antes ${pr.prev} kg).`,
    });
  }

  // 2) El cruce entrenamiento ↔ nutrición, que es el punto de todo esto.
  const cenaHecha = x.foodsOfDay.some((f) => f.meal === "cena");
  const momento = cenaHecha ? "en la próxima comida" : "en la cena";
  // Cuando el cruce ya habla de carbos, repetir el ajuste de metas abajo sería
  // decir lo mismo dos veces con otras palabras.
  let carbosDichos = false;
  if (training.intensity === "fuerte" && falta.calories > 400) {
    carbosDichos = true;
    coach.push({
      emoji: "🍚",
      tone: "warn",
      text: `Entrenaste fuerte y vas ${nutrition.netCalories} de ${nutrition.goals.calories} kcal netas. Subí los carbohidratos ${momento} para recuperar bien.`,
    });
  } else if (training.trained && falta.protein > 25) {
    coach.push({
      emoji: "🥩",
      tone: "warn",
      text: `Después de entrenar te faltan ${Math.round(falta.protein)} g de proteína para cerrar el día.`,
    });
  } else if (!training.trained && falta.calories < -300) {
    coach.push({
      emoji: "⚖️",
      tone: "warn",
      text: `Sin entrenar y ${Math.abs(Math.round(falta.calories))} kcal por encima de la meta. Mañana compensalo con movimiento, no con hambre.`,
    });
  }

  if (nutrition.reason && !carbosDichos) {
    coach.push({ emoji: "🎯", tone: "info", text: nutrition.reason });
  }

  // 3) Comidas concretas para cerrar lo que falta, topeadas a lo que entra en
  //    UNA comida (ver meals.ts: sin tope salían cosas como "17 bananas").
  let meal: NextMeal | null = null;
  if (falta.protein >= 15) {
    const p = proteinPlan(falta.protein);
    if (p) meal = { macro: "proteína", plan: p };
  } else if (training.intensity !== "descanso" && falta.carbs >= 40) {
    const c = carbPlan(falta.carbs);
    if (c) meal = { macro: "carbohidratos", plan: c };
  }

  // 4) La recomendación principal: una sola cosa, la que más mueve la aguja.
  const sleep = metrics?.sleepHours;
  const water = metrics?.water ?? 0;
  let headline: string;
  if (sleep != null && sleep > 0 && sleep < 6) {
    headline = `Dormiste ${sleep} h. Priorizá dormir 7-8 h hoy: sin eso no rendís ni recuperás.`;
  } else if (recovery.score != null && recovery.score < 45) {
    headline = recovery.advice;
  } else if (falta.protein >= 30) {
    headline = `Te faltan ${Math.round(falta.protein)} g de proteína. Cerralo ${momento}.`;
  } else if (!training.trained && isToday && week.days < 5) {
    headline = "Estás listo para entrenar. Pasá al Gym y arrancá con lo que te falta esta semana.";
  } else if (water > 0 && water < x.waterGoal * 0.5) {
    headline = `Vas ${water} L de agua: te falta más de la mitad de la meta.`;
  } else if (sleep == null) {
    headline = "Registrá cuánto dormiste: es el dato que más me falta para leerte bien.";
  } else if (
    // "Llegaste con la comida" pide estar CERCA de la meta, no solo no haberse
    // pasado: antes `falta.calories > -200` daba "día redondo" con 1000 kcal y
    // 460 g de carbos faltando, justo arriba del cartel que decía lo contrario.
    training.trained &&
    Math.abs(falta.protein) <= 15 &&
    Math.abs(falta.calories) <= 300
  ) {
    headline = "Día redondo: entrenaste y llegaste con la comida. Seguí así 💪";
  } else if (falta.calories > 500) {
    headline = `Te faltan ${Math.round(falta.calories)} kcal para tu meta del día. Comé algo más.`;
  } else {
    headline = recovery.advice;
  }

  return { headline, coach, meal };
}
