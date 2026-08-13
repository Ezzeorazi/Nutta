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
import { MUSCLE_GROUPS, groupsOf, setVolume } from "@/lib/gym";
import { waterGoalL, type ObjectiveKey } from "@/lib/nutrition";
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

/**
 * Días que el usuario marcó como descanso. Un día de descanso NO es un día sin
 * datos: corta la racha, no cuenta como día de entrenamiento de la semana y no
 * se lee como "te olvidaste de cargar".
 */
export const restDaysOf = (metrics: Pick<DailyMetrics, "date" | "restDay">[]) =>
  new Set(metrics.filter((m) => m.restDay).map((m) => m.date));

// ---------------------------------------------------------------------------
// Qué clase de día fue
// ---------------------------------------------------------------------------

/**
 * Tipos de día. Existen porque meter una caminata de 20 minutos en la misma
 * bolsa que una sesión de 26 series daba lecturas absurdas: "9 días seguidos
 * entrenando" cuando en realidad hubo 5 de gimnasio, 1 de caminata y 1 de
 * descanso. Y sobre esa cuenta se decidía si había fatiga acumulada.
 */
export type DayKind =
  | "fuerza"
  | "cardio"
  | "ligera"
  | "descanso"
  | "sin-registro";

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  fuerza: "Fuerza",
  cardio: "Cardio",
  ligera: "Actividad ligera",
  descanso: "Descanso",
  "sin-registro": "Sin registrar",
};

/** Versión corta, para columnas angostas y para contar ("4 fuerza · 2 ligera"). */
export const DAY_KIND_SHORT: Record<DayKind, string> = {
  fuerza: "Fuerza",
  cardio: "Cardio",
  ligera: "Ligera",
  descanso: "Descanso",
  "sin-registro": "—",
};

export const DAY_KIND_EMOJI: Record<DayKind, string> = {
  fuerza: "🏋️",
  cardio: "🏃",
  ligera: "🚶",
  descanso: "🧘",
  "sin-registro": "⚪",
};

/** Días que cuentan como entrenamiento de verdad (para racha y carga). */
export const isTrainingKind = (k: DayKind) => k === "fuerza" || k === "cardio";

/** Actividades que son moverse, no entrenar, salvo que duren mucho. */
const LIGHT_ACTIVITY =
  /caminat|caminar|caminando|paseo|walk|estiramiento|elongaci|movilidad|yoga/i;

/**
 * ¿Ese cardio es una sesión o es moverse? Se cree primero al reloj (efecto del
 * entrenamiento y pulso son la medida real del esfuerzo) y solo si no vino con
 * datos se cae al nombre y la duración.
 */
export function isStructuredCardio(e: ExerciseEntry): boolean {
  if (e.trainingEffect != null) return e.trainingEffect >= 2;
  if (e.avgHeartRate != null) return e.avgHeartRate >= 120;
  if (LIGHT_ACTIVITY.test(e.name)) return e.minutes >= 45;
  return e.minutes >= 20;
}

/**
 * Clase de un día. Las series mandan sobre todo lo demás: si levantaste, fue
 * día de fuerza aunque lo hubieras declarado de descanso.
 */
export function dayKindOf(x: {
  sets: number;
  cardio: ExerciseEntry[];
  rest: boolean;
}): DayKind {
  if (x.sets > 0) return "fuerza";
  if (x.rest) return "descanso";
  if (x.cardio.length === 0) return "sin-registro";
  return x.cardio.some(isStructuredCardio) ? "cardio" : "ligera";
}

/** Clase de cada día con algún registro (o marcado como descanso). */
export function kindByDay(
  strengthSets: StrengthSet[],
  exercises: ExerciseEntry[],
  restDays: Set<string> = new Set(),
): Map<string, DayKind> {
  const setsByDay = new Map<string, number>();
  for (const s of strengthSets) {
    setsByDay.set(s.date, (setsByDay.get(s.date) ?? 0) + 1);
  }
  const cardioByDay = new Map<string, ExerciseEntry[]>();
  for (const e of exercises) {
    const arr = cardioByDay.get(e.date) ?? [];
    arr.push(e);
    cardioByDay.set(e.date, arr);
  }

  const days = new Set([...setsByDay.keys(), ...cardioByDay.keys(), ...restDays]);
  const out = new Map<string, DayKind>();
  for (const d of days) {
    out.set(
      d,
      dayKindOf({
        sets: setsByDay.get(d) ?? 0,
        cardio: cardioByDay.get(d) ?? [],
        rest: restDays.has(d),
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entrenamiento del día
// ---------------------------------------------------------------------------

export type PersonalRecord = { exercise: string; weight: number; prev: number };

export type TrainingDay = {
  /** Qué clase de día fue. Es la lectura principal; `trained` se deriva. */
  kind: DayKind;
  /** Fuerza o cardio estructurado. Una caminata NO cuenta como entrenar. */
  trained: boolean;
  /** El usuario marcó el día como descanso (y no cargó series). */
  rest: boolean;
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
 *
 * `isRest` es el día marcado como descanso por el usuario. Se ignora si igual
 * cargó series: lo que se hizo manda sobre lo que se declaró.
 */
export function trainingOfDay(
  strengthSets: StrengthSet[],
  exercises: ExerciseEntry[],
  date: string,
  bodyWeight: number,
  refVolume = 0,
  isRest = false,
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

  // Descanso declarado: vale mientras no haya series cargadas. Una caminata o
  // un cardio suave no lo invalidan —eso ES un día de descanso activo—, pero
  // ponerse a levantar sí.
  const rest = isRest && sets === 0;
  const kind = dayKindOf({ sets, cardio: dayCardio, rest: isRest });
  // Un día de caminata no es un día entrenado: cuenta como movimiento, y por
  // eso cae en "descanso" para la intensidad (y para el ajuste de carbos).
  const trained = isTrainingKind(kind);
  const intensity = classifyIntensity({
    trained,
    volume,
    sets,
    cardioMinutes,
    refVolume,
    effect,
  });

  return {
    kind,
    trained,
    rest,
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
// Estado de cada grupo muscular
// ---------------------------------------------------------------------------

/**
 * Cómo viene cada grupo muscular. Es lo que un entrenador tiene en la cabeza
 * cuando decide qué toca hoy: qué está fresco, qué está cargado y qué hace
 * rato que no se toca. La app tenía los datos y no los cruzaba.
 */
export type MuscleState = {
  group: string;
  /** Días desde la última vez que se entrenó. `null` si nunca. */
  daysSince: number | null;
  /** Series en los últimos 7 días. */
  weekSets: number;
};

export function muscleStates(
  strengthSets: StrengthSet[],
  today: string,
): MuscleState[] {
  const last = new Map<string, string>();
  const weekSets = new Map<string, number>();
  for (const s of strengthSets) {
    const diff = dayDiff(today, s.date);
    if (diff < 0) continue; // registros futuros: no existen todavía
    for (const g of groupsOf(s.exercise)) {
      const prev = last.get(g);
      if (!prev || s.date > prev) last.set(g, s.date);
      if (diff <= 6) weekSets.set(g, (weekSets.get(g) ?? 0) + 1);
    }
  }

  return MUSCLE_GROUPS.map((group) => {
    const d = last.get(group);
    return {
      group,
      daysSince: d ? dayDiff(today, d) : null,
      weekSets: weekSets.get(group) ?? 0,
    };
  }).sort(
    (a, b) =>
      (b.daysSince ?? 99) - (a.daysSince ?? 99) || a.weekSets - b.weekSets,
  );
}

// ---------------------------------------------------------------------------
// Carga semanal
// ---------------------------------------------------------------------------

export type WeekLoad = {
  /** Volumen de fuerza de los últimos 7 días (incluye `date`). */
  volume: number;
  sets: number;
  /** Días de entrenamiento real (fuerza o cardio estructurado) en 7 días. */
  days: number;
  /** Desglose de los últimos 7 días por clase de día. */
  byKind: Record<DayKind, number>;
  /** Volumen de los 7 días anteriores a esos (para comparar). */
  prevVolume: number;
  /** Volumen promedio por sesión de las últimas 4 semanas (excluye `date`). */
  avgSessionVolume: number;
  /**
   * Días seguidos entrenando que terminan en `date`. Es la señal de fatiga:
   * una caminata o un descanso la cortan, porque justamente son la pausa.
   */
  streak: number;
  /**
   * Racha de constancia: como `streak`, pero los días ligeros y de descanso no
   * suman ni cortan. Es la que se le muestra al usuario: descansar cuando toca
   * no es abandonar, y no debería castigarse con perder el 🔥.
   */
  habitStreak: number;
};

export function weeklyLoad(
  strengthSets: StrengthSet[],
  exercises: ExerciseEntry[],
  date: string,
  /** Días marcados como descanso: cortan la racha y no cuentan como entreno. */
  restDays: Set<string> = new Set(),
): WeekLoad {
  const inRange = (d: string, from: number, to: number) => {
    const diff = dayDiff(date, d);
    return diff >= from && diff <= to;
  };

  const week = strengthSets.filter((s) => inRange(s.date, 0, 6));
  const prev = strengthSets.filter((s) => inRange(s.date, 7, 13));

  // Cada día de la semana se clasifica una sola vez y de ahí sale todo: los
  // días de entrenamiento, el desglose y las dos rachas.
  const kinds = kindByDay(strengthSets, exercises, restDays);
  const byKind: Record<DayKind, number> = {
    fuerza: 0,
    cardio: 0,
    ligera: 0,
    descanso: 0,
    "sin-registro": 0,
  };
  for (const [d, k] of kinds) {
    if (inRange(d, 0, 6)) byKind[k]++;
  }

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

  const kindOn = (d: string) => kinds.get(d) ?? "sin-registro";
  const trainedOn = (d: string) => isTrainingKind(kindOn(d));

  // Racha de fatiga. Se permite que hoy todavía no esté entrenado: si no, a la
  // mañana la racha de cinco días seguidos aparecería como cero y perderíamos
  // la señal. Un día ligero o de descanso la corta: para eso está la pausa.
  let streak = 0;
  let cursor = trainedOn(date) ? date : shiftISO(date, -1);
  while (trainedOn(cursor)) {
    streak++;
    cursor = shiftISO(cursor, -1);
  }

  // Racha de constancia: los días ligeros y de descanso se saltean sin contar.
  // Corta recién cuando aparece un día sin ningún registro.
  let habitStreak = 0;
  let hCursor = kindOn(date) === "sin-registro" ? shiftISO(date, -1) : date;
  while (kindOn(hCursor) !== "sin-registro") {
    if (trainedOn(hCursor)) habitStreak++;
    hCursor = shiftISO(hCursor, -1);
  }

  return {
    volume: sum(week, setVolume),
    sets: week.length,
    days: byKind.fuerza + byKind.cardio,
    byKind,
    prevVolume: sum(prev, setVolume),
    avgSessionVolume,
    streak,
    habitStreak,
  };
}

/**
 * La semana en una línea: "🏋️ 5 fuerza · 🚶 1 ligera · 🧘 1 descanso".
 *
 * Reemplaza al "7/7 entrenamientos" que salía de contar cualquier día con algo
 * cargado. Solo se listan las clases que ocurrieron.
 */
export function weekBreakdown(week: WeekLoad): string {
  const orden: DayKind[] = ["fuerza", "cardio", "ligera", "descanso"];
  return orden
    .filter((k) => week.byKind[k] > 0)
    .map(
      (k) =>
        `${DAY_KIND_EMOJI[k]} ${week.byKind[k]} ${DAY_KIND_SHORT[k].toLowerCase()}`,
    )
    .join(" · ");
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
  /** Clase de día: cambia el porqué que se muestra, no el número. */
  kind: DayKind = "sin-registro",
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
  const porque =
    kind === "descanso"
      ? "Día de descanso"
      : kind === "ligera"
        ? "Día de actividad ligera"
        : isToday
          ? "Todavía no entrenaste"
          : "Día sin entrenamiento";
  const reason =
    carbDelta > 0
      ? `Entrenaste ${intensity === "fuerte" ? "fuerte" : "hoy"}: +${carbDelta} g de carbos para reponer.`
      : `${porque}: −${Math.abs(carbDelta)} g de carbos. La proteína se mantiene.`;
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
  kind: DayKind,
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
  const { goals, carbDelta, reason } = dynamicGoals(
    base,
    intensity,
    isToday,
    kind,
  );
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
// Balance energético
// ---------------------------------------------------------------------------

/**
 * Cómo cerró (o viene cerrando) el día en calorías.
 *
 * Reemplaza a "te faltan N kcal, comé algo más". Ese mensaje trataba la meta
 * como una tarea pendiente, y para alguien en déficit buscado eso es al revés:
 * el problema no es no llegar, es pasarse de largo para abajo. Acá se juzga el
 * DESVÍO, con una banda que se estrecha cuando el día tuvo entrenamiento
 * fuerte —no es lo mismo terminar 800 kcal abajo en el sillón que después de
 * 90 minutos de pesas—.
 */
export type EnergyLevel =
  | "sin-registro"
  | "en-curso"
  | "adecuado"
  | "deficit-alto"
  | "deficit-excesivo"
  | "exceso"
  | "exceso-alto";

export type EnergyTone = "good" | "warn" | "bad" | "neutral";

export type EnergyBalance = {
  level: EnergyLevel;
  tone: EnergyTone;
  emoji: string;
  /** Etiqueta corta: "Déficit alto", "En la meta", "En curso". */
  label: string;
  /** El número, para el panel: "1.203 / 2.350 kcal". */
  short: string;
  /** El número con su desvío: "1.203 de 2.350 kcal netas · 1.147 por debajo". */
  detail: string;
  /** kcal netas − meta. Negativo = déficit. */
  delta: number;
  /** Desvío como fracción de la meta (siempre positivo). */
  drift: number;
  /** 0-1 para la barra del panel de estado. */
  ratio: number;
  /**
   * `false` mientras el día sigue abierto: un día a medias no se juzga. A las
   * 15 h, 1.100 kcal "faltando" no son un déficit, son un día sin terminar.
   */
  closed: boolean;
};

/**
 * Desvíos (fracción de la meta) donde el balance deja de ser el buscado:
 * [empieza a ser mucho, es demasiado]. `under` es comer de menos y `over`
 * comer de más, y cada objetivo tolera distinto de cada lado.
 */
const ENERGY_BANDS: Record<
  ObjectiveKey,
  { under: [number, number]; over: [number, number] }
> = {
  bajar: { under: [0.15, 0.28], over: [0.08, 0.18] },
  mantener: { under: [0.12, 0.25], over: [0.12, 0.25] },
  subir: { under: [0.08, 0.18], over: [0.15, 0.3] },
};

/** Un día duro estrecha la banda del déficit; uno de descanso la afloja. */
const DEFICIT_TIGHTEN: Record<Intensity, number> = {
  descanso: 1.25,
  suave: 1.1,
  medio: 0.9,
  fuerte: 0.75,
};

/**
 * Hora a partir de la cual el día se considera cerrado para comer. Después de
 * esto lo que falta ya no se va a comer, así que recién ahí se opina.
 */
const DAY_CLOSE_HOUR = 21;

const kcal = (n: number) => Math.round(n).toLocaleString("es-AR");

export function energyStatus(x: {
  /** Calorías netas del día (consumidas − quemadas en cardio). */
  net: number;
  /** Meta del día, ya ajustada al entrenamiento. */
  goal: number;
  intensity: Intensity;
  objective: ObjectiveKey;
  isToday: boolean;
  /** Hora local (0-23). Solo importa si `isToday`. */
  hour: number;
  /** Si no se registró NADA de comida, no hay déficit: hay un registro vacío. */
  hasFood: boolean;
}): EnergyBalance {
  const delta = x.net - x.goal;
  const drift = x.goal > 0 ? Math.abs(delta) / x.goal : 0;
  const short = `${kcal(x.net)} / ${kcal(x.goal)} kcal`;
  const detail = `${kcal(x.net)} de ${kcal(x.goal)} kcal netas${
    Math.abs(delta) >= 25
      ? ` · ${kcal(Math.abs(delta))} ${delta < 0 ? "por debajo" : "por encima"}`
      : ""
  }`;

  if (!x.hasFood || x.goal <= 0) {
    return {
      level: "sin-registro",
      tone: "neutral",
      emoji: "⚪",
      label: "Sin registrar",
      short: "Sin registrar",
      detail: "Todavía no cargaste comida.",
      delta,
      drift,
      ratio: 0,
      closed: false,
    };
  }

  if (x.isToday && x.hour < DAY_CLOSE_HOUR) {
    return {
      level: "en-curso",
      tone: "neutral",
      emoji: "⏳",
      label: "En curso",
      short,
      detail,
      delta,
      drift,
      ratio: clamp(x.net / x.goal, 0, 1),
      closed: false,
    };
  }

  const band = ENERGY_BANDS[x.objective] ?? ENERGY_BANDS.mantener;
  const tighten = DEFICIT_TIGHTEN[x.intensity];
  const [warnAt, badAt] =
    delta < 0
      ? [band.under[0] * tighten, band.under[1] * tighten]
      : band.over;

  if (drift < warnAt) {
    const surplus = delta > 0 && x.objective === "subir";
    return {
      level: "adecuado",
      tone: "good",
      emoji: "🟢",
      // Menos de un 5% de desvío es ruido de medición, no un déficit buscado.
      label: delta < -0.05 * x.goal
        ? "Déficit adecuado"
        : surplus
          ? "Superávit adecuado"
          : "En la meta",
      short,
      detail,
      delta,
      drift,
      ratio: 1,
      closed: true,
    };
  }

  const bad = drift >= badAt;
  return {
    level: delta < 0
      ? bad
        ? "deficit-excesivo"
        : "deficit-alto"
      : bad
        ? "exceso-alto"
        : "exceso",
    tone: bad ? "bad" : "warn",
    emoji: bad ? "🔴" : "🟡",
    label:
      delta < 0
        ? bad
          ? "Déficit excesivo"
          : "Déficit alto"
        : bad
          ? "Muy por encima"
          : "Por encima",
    short,
    detail,
    delta,
    drift,
    ratio: bad ? 0.25 : 0.55,
    closed: true,
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
// El día anterior
// ---------------------------------------------------------------------------

/**
 * Cómo cerró el día anterior. Ya se calculaba a medias (solo las calorías, y
 * solo para la recuperación); acá se completa y se muestra, porque leer el
 * "hoy" sin el "ayer" es la diferencia entre un tablero y un entrenador.
 */
export type DaySummary = {
  date: string;
  kind: DayKind;
  /** Grupos musculares trabajados ese día. */
  groups: string[];
  volume: number;
  cardioMinutes: number;
  protein: number;
  calories: number;
  sleepHours: number | null;
};

/** El resumen de un día en una línea: "Fuerza · espalda, brazos · 148 g P · 7 h". */
export function daySummaryLine(d: DaySummary): string {
  const partes: string[] = [DAY_KIND_LABEL[d.kind]];
  if (d.groups.length) partes.push(d.groups.join(" + "));
  else if (d.cardioMinutes > 0) partes.push(`${d.cardioMinutes} min`);
  if (d.protein > 0) partes.push(`${Math.round(d.protein)} g P`);
  if (d.sleepHours) partes.push(`${d.sleepHours} h de sueño`);
  return partes.join(" · ");
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
  /**
   * Veredicto propio de la fila. Sin esto, todas se califican con `rate()`
   * (Excelente/Bien/Regular/Flojo), que para las calorías miente: un déficit
   * buscado no es "flojo" y un día a medias no es nada todavía.
   */
  rating?: string;
  /** Color del veredicto cuando no sale del ratio (ver `rating`). */
  tone?: EnergyTone;
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
  /** Objetivo del usuario: define qué desvío calórico es el buscado. */
  objective?: ObjectiveKey;
  /**
   * Hora local actual (0-23). Se pasa desde afuera a propósito: esta capa es
   * pura y no mira el reloj. Sirve para no juzgar un día que sigue abierto.
   */
  hour?: number;
};

export type AthleteState = {
  date: string;
  isToday: boolean;
  training: TrainingDay;
  week: WeekLoad;
  nutrition: NutritionState;
  /** Qué tan bien cerró el día en calorías (ver `energyStatus`). */
  energy: EnergyBalance;
  /** Cómo cerró el día anterior: sin eso, el consejo de hoy no tiene contexto. */
  yesterday: DaySummary;
  /** Cómo viene cada grupo muscular (lo fresco, lo cargado, lo abandonado). */
  muscles: MuscleState[];
  /**
   * Las señales de carga del día ("dormiste 6 h", "venís en déficit alto"…).
   * Se exponen para que la sesión sugerida explique su ajuste con las MISMAS
   * razones que da el panel: dos explicaciones distintas del mismo día es
   * peor que ninguna.
   */
  signals: string[];
  recovery: Recovery;
  waterGoal: number;
  /** Las filas del panel "Objetivo del día". */
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

  const restDays = restDaysOf(input.metrics);
  const week = weeklyLoad(input.strengthSets, input.exercises, date, restDays);
  const training = trainingOfDay(
    input.strengthSets,
    input.exercises,
    date,
    input.bodyWeight,
    week.avgSessionVolume,
    restDays.has(date),
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
    training.kind,
  );
  const energy = energyStatus({
    net: nutrition.netCalories,
    goal: nutrition.goals.calories,
    intensity: training.intensity,
    objective: input.objective ?? "mantener",
    isToday,
    hour: input.hour ?? DAY_CLOSE_HOUR,
    hasFood: nutrition.consumed.calories > 0,
  });

  const yDate = shiftISO(date, -1);
  const yTraining = trainingOfDay(
    input.strengthSets,
    input.exercises,
    yDate,
    input.bodyWeight,
    week.avgSessionVolume,
    restDays.has(yDate),
  );
  const yFoods = input.foods.filter((f) => f.date === yDate);
  const yDrinks = input.drinks.filter((d) => d.date === yDate);
  const yesterday: DaySummary = {
    date: yDate,
    kind: yTraining.kind,
    groups: yTraining.groups,
    volume: yTraining.volume,
    cardioMinutes: yTraining.cardioMinutes,
    protein:
      sum(yFoods, (f) => f.protein) +
      dailySupplementProtein(input.supplements, input.supplementLogs, yDate),
    calories: sum(yFoods, (f) => f.calories) + sum(yDrinks, (d) => d.calories),
    sleepHours: input.metrics.find((m) => m.date === yDate)?.sleepHours ?? null,
  };
  const nutritionYesterday =
    yesterday.calories > 0 || yesterday.protein > 0 ? yesterday : null;

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
    energy,
    metrics: dayMetrics,
    waterGoal,
  });
  const muscles = muscleStates(input.strengthSets, date);
  const signals = loadSignals({
    sleep: dayMetrics?.sleepHours,
    recovery,
    week,
    energy,
    muscles,
  });
  const { headline, coach, meal } = buildCoach({
    training,
    nutrition,
    energy,
    yesterday,
    muscles,
    signals,
    recovery,
    week,
    metrics: dayMetrics,
    waterGoal,
    isToday,
    hour: input.hour ?? DAY_CLOSE_HOUR,
    foodsOfDay: input.foods.filter((f) => f.date === date),
  });

  return {
    date,
    isToday,
    training,
    week,
    nutrition,
    energy,
    yesterday,
    muscles,
    signals,
    recovery,
    waterGoal,
    status,
    headline,
    coach,
    meal,
  };
}

/**
 * Cuánto "vale" cada clase de día en el panel. `null` = lo decide la carga
 * (fuerza y cardio se miden por intensidad, no por haber aparecido).
 */
const DAY_KIND_RATIO: Record<DayKind, number | null> = {
  fuerza: null,
  cardio: null,
  ligera: 0.5,
  descanso: 1,
  "sin-registro": 0,
};

/** El detalle del día: volumen si hubo fierros, minutos si hubo movimiento. */
function trainingValue(t: TrainingDay): string {
  if (t.kind === "sin-registro") return "Sin registrar";
  if (t.volume > 0) {
    const partes = [`${Math.round(t.volume).toLocaleString("es-AR")} kg`];
    if (t.cardioMinutes > 0) partes.push(`${t.cardioMinutes} min`);
    return `${INTENSITY_LABEL[t.intensity]} · ${partes.join(" · ")}`;
  }
  if (t.cardioMinutes > 0) return `${t.cardioMinutes} min`;
  return DAY_KIND_LABEL[t.kind];
}

function buildStatus(x: {
  training: TrainingDay;
  nutrition: NutritionState;
  energy: EnergyBalance;
  metrics?: DailyMetrics;
  waterGoal: number;
}): StatusRow[] {
  const { training, nutrition, energy, metrics, waterGoal } = x;
  const sleep = metrics?.sleepHours;
  const water = metrics?.water;
  const steps = metrics?.steps;

  return [
    {
      key: "entrenamiento",
      emoji: DAY_KIND_EMOJI[training.kind],
      label: "Entrenamiento",
      // El descanso elegido puntúa como día cumplido: descansar es parte del
      // plan, no una falta. Sin esto, marcarlo te pintaba la barra en cero.
      // Un día ligero puntúa a medias: moverse no es entrenar, pero tampoco es
      // lo mismo que no hacer nada.
      ratio: DAY_KIND_RATIO[training.kind] ?? INTENSITY_RATIO[training.intensity],
      logged: true,
      value: trainingValue(training),
      rating: DAY_KIND_SHORT[training.kind],
      tone:
        training.kind === "sin-registro"
          ? "neutral"
          : training.kind === "ligera"
            ? "warn"
            : "good",
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
      key: "calorias",
      emoji: energy.emoji,
      label: "Calorías",
      ratio: energy.ratio,
      logged: energy.level !== "sin-registro",
      value: energy.detail,
      rating: energy.label,
      tone: energy.tone,
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
 * Las señales que explican el consejo del día, de la que más pesa a la que
 * menos. Existen para que la recomendación deje de ser una frase suelta
 * ("Excelente", "te falta proteína") y pase a decir POR QUÉ: "mucho volumen +
 * dormiste poco + déficit alto → hoy bajá la intensidad".
 */
function loadSignals(x: {
  sleep?: number;
  recovery: Recovery;
  week: WeekLoad;
  energy: EnergyBalance;
  muscles: MuscleState[];
}): string[] {
  // El orden es el de importancia: solo se muestran las primeras, así que lo
  // sistémico (sueño, energía, carga acumulada) va antes que lo local.
  const out: string[] = [];
  if (x.sleep != null && x.sleep > 0 && x.sleep < 6.5) {
    out.push(`dormiste ${x.sleep} h`);
  }
  if (
    x.energy.closed &&
    (x.energy.level === "deficit-alto" || x.energy.level === "deficit-excesivo")
  ) {
    out.push(`venís en ${x.energy.label.toLowerCase()}`);
  }
  if (x.week.streak >= 4) {
    out.push(`${x.week.streak} días seguidos entrenando`);
  }
  if (x.week.prevVolume > 0 && x.week.volume > x.week.prevVolume * 1.4) {
    const pct = Math.round((x.week.volume / x.week.prevVolume - 1) * 100);
    out.push(`subiste el volumen ${pct}% en la semana`);
  }
  // El grupo más castigado de la semana: es el que explica la fatiga local.
  const cargado = [...x.muscles].sort((a, b) => b.weekSets - a.weekSets)[0];
  if (cargado && cargado.weekSets >= 12) {
    out.push(`mucho volumen de ${cargado.group} esta semana`);
  }
  // La recuperación va última porque resume a las anteriores: nombrarla antes
  // sería decir dos veces lo mismo.
  if (x.recovery.score != null && x.recovery.score < 55) {
    out.push(`recuperación ${x.recovery.score}%`);
  }
  return out;
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Lo que diría un entrenador mirando la pantalla: primero lee el
 * entrenamiento, después lo cruza con lo que comió y recién ahí recomienda.
 */
function buildCoach(x: {
  training: TrainingDay;
  nutrition: NutritionState;
  energy: EnergyBalance;
  yesterday: DaySummary;
  muscles: MuscleState[];
  /** Señales de carga ya calculadas (ver `loadSignals`). */
  signals: string[];
  recovery: Recovery;
  week: WeekLoad;
  metrics?: DailyMetrics;
  waterGoal: number;
  isToday: boolean;
  /** Hora local, para no dar como consejo lo que a esa hora es obvio. */
  hour: number;
  foodsOfDay: FoodEntry[];
}): { headline: string; coach: Signal[]; meal: NextMeal | null } {
  const { training, nutrition, energy, muscles, recovery, week, metrics, isToday } =
    x;
  const coach: Signal[] = [];
  const falta = nutrition.remaining;

  // 1) Lectura del entrenamiento.
  if (training.rest) {
    coach.push({
      emoji: "🧘",
      tone: "good",
      text:
        training.cardioMinutes > 0
          ? `Día de descanso con ${training.cardioMinutes} min de movimiento suave. Así se recupera.`
          : "Día de descanso. El músculo crece ahora, no en la sesión.",
    });
  } else if (training.kind === "ligera") {
    // Antes esto entraba como "Sesión suave" y sumaba a la racha. Moverse está
    // bien, pero llamarlo entrenamiento tapaba que hacía días que no entrenabas.
    coach.push({
      emoji: "🚶",
      tone: "info",
      text: `Actividad ligera: ${training.cardioMinutes} min. Suma movimiento y recuperación, no cuenta como entrenamiento.`,
    });
  } else if (training.trained) {
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
  // Con el día abierto se habla de lo que TODAVÍA se puede hacer; con el día
  // cerrado, de cómo quedó. Antes era siempre lo primero, y a las 23 h te
  // pedía comer 1.100 kcal más.
  if (
    training.intensity === "fuerte" &&
    !energy.closed &&
    falta.calories > 400
  ) {
    carbosDichos = true;
    coach.push({
      emoji: "🍚",
      tone: "warn",
      text: `Entrenaste fuerte y vas ${energy.short}. Subí los carbohidratos ${momento} para recuperar bien.`,
    });
  } else if (
    training.trained &&
    energy.closed &&
    (energy.level === "deficit-alto" || energy.level === "deficit-excesivo")
  ) {
    carbosDichos = true;
    coach.push({
      emoji: "🍚",
      tone: energy.level === "deficit-excesivo" ? "warn" : "info",
      text: `Entrenaste y cerraste ${kcal(Math.abs(energy.delta))} kcal por debajo de la meta. Un día no pasa nada; si se repite, el que paga es el músculo.`,
    });
  } else if (training.trained && falta.protein > 25) {
    coach.push({
      emoji: "🥩",
      tone: "warn",
      text: `Después de entrenar te faltan ${Math.round(falta.protein)} g de proteína para cerrar el día.`,
    });
  } else if (
    !training.trained &&
    (energy.level === "exceso" || energy.level === "exceso-alto")
  ) {
    coach.push({
      emoji: "⚖️",
      tone: "warn",
      text: `Sin entrenar y ${kcal(energy.delta)} kcal por encima de la meta. Mañana compensalo con movimiento, no con hambre.`,
    });
  }

  if (nutrition.reason && !carbosDichos) {
    coach.push({ emoji: "🎯", tone: "info", text: nutrition.reason });
  }

  // 3) Qué músculo está esperando. Solo si todavía no entrenaste hoy: después
  //    de la sesión ya no es accionable, es ruido.
  const pendiente = muscles.find(
    (m) => m.daysSince == null || m.daysSince >= 4,
  );
  if (isToday && !training.trained && pendiente) {
    coach.push({
      emoji: "🧭",
      tone: "info",
      text:
        pendiente.daysSince == null
          ? `Nunca registraste ${pendiente.group}: es el hueco más grande de tu semana.`
          : `Hace ${pendiente.daysSince} días que no entrenás ${pendiente.group}. Es lo que más falta.`,
    });
  }

  // 4) Comidas concretas para cerrar lo que falta, topeadas a lo que entra en
  //    UNA comida (ver meals.ts: sin tope salían cosas como "17 bananas").
  let meal: NextMeal | null = null;
  if (falta.protein >= 15) {
    const p = proteinPlan(falta.protein);
    if (p) meal = { macro: "proteína", plan: p };
  } else if (training.intensity !== "descanso" && falta.carbs >= 40) {
    const c = carbPlan(falta.carbs);
    if (c) meal = { macro: "carbohidratos", plan: c };
  }

  // 5) La recomendación principal: una sola cosa, la que más mueve la aguja.
  const sleep = metrics?.sleepHours;
  const water = metrics?.water ?? 0;
  // Cuando se juntan dos o más señales de carga, el consejo las nombra y baja
  // la intensidad. Antes ganaba la primera regla de la lista y el usuario veía
  // "Dormiste 6 h" sin enterarse de que además venía con volumen alto y en
  // déficit: tres cosas que juntas piden lo mismo, pero que sueltas no lo
  // explican.
  const señales = x.signals;
  const sobrecargado = señales.length >= 2 && !training.trained && isToday;
  let headline: string;
  if (sobrecargado) {
    // Con el día terminado, "hoy bajá la intensidad" ya no se puede cumplir:
    // el consejo se corre a mañana.
    const accion = energy.closed
      ? "mañana entrená liviano y priorizá dormir"
      : "hoy bajá la intensidad: menos series por ejercicio y cardio suave";
    headline = `${capFirst(señales.slice(0, 3).join(" + "))} → ${accion}.`;
  } else if (sleep != null && sleep > 0 && sleep < 6) {
    headline = `Dormiste ${sleep} h. Priorizá dormir 7-8 h hoy: sin eso no rendís ni recuperás.`;
  } else if (recovery.score != null && recovery.score < 45) {
    headline = recovery.advice;
  } else if (falta.protein >= 30 && (!isToday || x.hour >= 15)) {
    // A la mañana faltan 150 g de proteína SIEMPRE: decirlo como consejo es
    // gastar el único renglón importante de la pantalla en una obviedad.
    headline = energy.closed
      ? `El día cerró con ${Math.round(falta.protein)} g de proteína por debajo de la meta. Es lo que sostiene el músculo: mañana arrancá temprano con ella.`
      : `Te faltan ${Math.round(falta.protein)} g de proteína. Cerralo ${momento}.`;
  } else if (training.rest) {
    headline =
      "Día de descanso: sostené la proteína y dormí bien, que es cuando se construye.";
  } else if (!training.trained && isToday && week.days < 5) {
    // Ya que sabemos qué grupo viene esperando, se dice: "arrancá con lo que
    // te falta" obliga al usuario a hacer la cuenta que la app ya hizo.
    const fresco = recovery.score != null && recovery.score >= 80;
    headline = pendiente
      ? `Estás listo para entrenar y ${pendiente.group} es lo que más falta${fresco ? ". Venís fresco: buen día para ir por un PR" : ""}.`
      : "Estás listo para entrenar. Pasá al Gym y arrancá con lo que te falta esta semana.";
  } else if (water > 0 && water < x.waterGoal * 0.5) {
    headline = `Vas ${water} L de agua: te falta más de la mitad de la meta.`;
  } else if (sleep == null) {
    headline = "Registrá cuánto dormiste: es el dato que más me falta para leerte bien.";
  } else if (
    // "Llegaste con la comida" pide un balance dentro de la banda buscada, no
    // solo no haberse pasado: antes `falta.calories > -200` daba "día redondo"
    // con 1000 kcal y 460 g de carbos faltando.
    training.trained &&
    energy.level === "adecuado" &&
    Math.abs(falta.protein) <= 15
  ) {
    headline = "Día redondo: entrenaste y llegaste con la comida. Seguí así 💪";
  } else if (energy.level === "deficit-excesivo") {
    // El déficit no se corrige comiendo a las 23 h: se corrige mañana. Por eso
    // el mensaje describe lo que pasó en vez de mandar a comer.
    headline = `Cerraste ${kcal(Math.abs(energy.delta))} kcal por debajo de tu meta (${energy.short}). Un día no es problema; sostenido te baja fuerza y recuperación.`;
  } else if (energy.level === "exceso-alto") {
    headline = `Cerraste ${kcal(energy.delta)} kcal por encima de tu meta (${energy.short}). Ojo con las porciones mañana.`;
  } else if (!energy.closed && falta.calories > 500) {
    headline = `Vas ${energy.short}. Te queda margen para ${cenaHecha ? "lo que falte del día" : "la cena"}: apuntá primero a la proteína.`;
  } else {
    headline = recovery.advice;
  }

  return { headline, coach, meal };
}
