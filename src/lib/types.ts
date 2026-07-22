export type MealType = "desayuno" | "almuerzo" | "merienda" | "cena" | "snack";

export const MEALS: { key: MealType; label: string }[] = [
  { key: "desayuno", label: "Desayuno" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "merienda", label: "Merienda" },
  { key: "cena", label: "Cena" },
  { key: "snack", label: "Snack" },
];

export type FoodEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealType;
  name: string;
  qty: number; // gramos o unidades
  calories: number; // por la cantidad indicada
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  createdAt?: number; // epoch ms (para el timeline)
};

export type ExerciseEntry = {
  id: string;
  date: string;
  name: string;
  minutes: number;
  caloriesBurned: number;
  createdAt?: number; // epoch ms (para el timeline)
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number; // epoch ms
};

export type WeightEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  kg: number;
  createdAt: number;
};

export type BodyPart =
  | "cintura"
  | "pecho"
  | "brazo"
  | "muslo"
  | "pantorrilla";

export const MEASURE_PARTS: { key: BodyPart; label: string; emoji: string }[] =
  [
    { key: "cintura", label: "Cintura", emoji: "📏" },
    { key: "pecho", label: "Pecho", emoji: "🫀" },
    { key: "brazo", label: "Brazo", emoji: "💪" },
    { key: "muslo", label: "Muslo", emoji: "🦵" },
    { key: "pantorrilla", label: "Pantorrilla", emoji: "🦶" },
  ];

export type MeasureEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  part: BodyPart;
  cm: number;
  createdAt: number;
};

export type GoalKind = "peso" | "levantamiento" | "medida";

export const GOAL_KINDS: { key: GoalKind; label: string; unit: string }[] = [
  { key: "peso", label: "Peso corporal", unit: "kg" },
  { key: "levantamiento", label: "Levantamiento (PR)", unit: "kg" },
  { key: "medida", label: "Medida corporal", unit: "cm" },
];

export type CustomGoal = {
  id: string;
  kind: GoalKind;
  label: string;
  target: number;
  ref?: string;
  createdAt: number;
};

export type PhotoEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  path: string;
  fileId: string;
  createdAt: number;
};

export type StrengthSet = {
  id: string;
  date: string; // YYYY-MM-DD
  exercise: string;
  reps: number;
  weight: number; // kg
  createdAt: number;
};

/** Ejercicios de fuerza comunes para alta rápida. */
export const COMMON_LIFTS = [
  "Press banca",
  "Sentadilla",
  "Peso muerto",
  "Press militar",
  "Remo con barra",
  "Dominadas",
  "Jalón al pecho",
  "Curl de bíceps",
  "Extensión de tríceps",
  "Press inclinado",
  "Hip thrust",
  "Prensa",
];

export type Supplement = {
  id: string;
  name: string;
  dose?: string;
  time?: string; // "HH:MM"
  createdAt: number;
};

export type SupplementLog = {
  id: string;
  supId: string;
  date: string;
  createdAt?: number; // epoch ms
};

/** Suplementos comunes para alta rápida. */
export const COMMON_SUPPLEMENTS = [
  "Creatina",
  "Proteína",
  "Omega 3",
  "Colágeno",
  "Cafeína",
  "Multivitamínico",
  "Vitamina D",
  "Magnesio",
];

export type DailyMetrics = {
  id: string;
  date: string; // YYYY-MM-DD
  water?: number; // litros
  sleepHours?: number;
  sleepQuality?: number; // 1-5
  steps?: number;
  createdAt?: number; // epoch ms
};

/** Meta diaria de hidratación (litros). */
export const WATER_GOAL_L = 2.5;

/** Meta diaria de pasos. */
export const STEPS_GOAL = 8000;

export type MemoryKind =
  | "habito"
  | "alimento"
  | "suplemento"
  | "lesion"
  | "objetivo"
  | "rutina"
  | "nota";

export const MEMORY_KINDS: {
  key: MemoryKind;
  label: string;
  emoji: string;
}[] = [
  { key: "habito", label: "Hábito", emoji: "🔁" },
  { key: "alimento", label: "Alimento frecuente", emoji: "🍽️" },
  { key: "suplemento", label: "Suplemento", emoji: "💊" },
  { key: "lesion", label: "Lesión", emoji: "🩹" },
  { key: "objetivo", label: "Objetivo", emoji: "🎯" },
  { key: "rutina", label: "Rutina", emoji: "📅" },
  { key: "nota", label: "Nota", emoji: "📝" },
];

export type MemoryFact = {
  id: string;
  kind: MemoryKind;
  text: string;
  createdAt: number;
};

export type RecipeItem = {
  name: string;
  qty: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Recipe = {
  id: string;
  name: string;
  items: RecipeItem[];
  createdAt: number;
};

export type FavoriteFood = {
  id: string;
  name: string;
  qty: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
};

export type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 130,
  carbs: 220,
  fat: 65,
};

/** Fecha (YYYY-MM-DD) de un instante en la zona horaria LOCAL del usuario. */
export function localDateFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fecha de hoy en LOCAL (no UTC). Ojo: `toISOString()` devuelve UTC, lo que
 * a la noche adelantaba el día y mezclaba registros de días distintos.
 */
export function todayISO(): string {
  return localDateFromMs(Date.now());
}

/**
 * Timestamp (epoch ms) anclado al MEDIODÍA local de una fecha YYYY-MM-DD.
 * Se usa al dar de alta registros en un día distinto de hoy: como el `date`
 * efectivo se deriva de `localDateFromMs(createdAt)`, un `createdAt` de mediodía
 * garantiza que el registro caiga en el día pretendido (sin cruzar husos).
 */
export function startOfLocalDayMs(iso: string): number {
  return new Date(`${iso}T12:00:00`).getTime();
}
