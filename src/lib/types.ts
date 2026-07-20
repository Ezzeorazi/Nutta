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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
