import type { Goals } from "./types";

export type Sex = "masculino" | "femenino";
export type ActivityKey =
  | "sedentario"
  | "ligero"
  | "moderado"
  | "activo"
  | "muy_activo";
export type ObjectiveKey = "bajar" | "mantener" | "subir";

export type Profile = {
  sex: Sex;
  age: number;
  weight: number; // kg
  height: number; // cm
  activity: ActivityKey;
  objective: ObjectiveKey;
};

export const ACTIVITIES: {
  key: ActivityKey;
  label: string;
  desc: string;
  factor: number;
}[] = [
  { key: "sedentario", label: "Sedentario", desc: "Poco o nada de ejercicio", factor: 1.2 },
  { key: "ligero", label: "Ligero", desc: "1–3 días/semana", factor: 1.375 },
  { key: "moderado", label: "Moderado", desc: "3–5 días/semana", factor: 1.55 },
  { key: "activo", label: "Activo", desc: "6–7 días/semana", factor: 1.725 },
  { key: "muy_activo", label: "Muy activo", desc: "Físico intenso / 2x día", factor: 1.9 },
];

export const OBJECTIVES: {
  key: ObjectiveKey;
  label: string;
  desc: string;
  /** ajuste sobre TDEE */
  calorieDelta: number;
  /** proteína objetivo en g por kg de peso */
  proteinPerKg: number;
}[] = [
  { key: "bajar", label: "Bajar de peso", desc: "Déficit calórico", calorieDelta: -500, proteinPerKg: 2.0 },
  { key: "mantener", label: "Mantener", desc: "Peso estable", calorieDelta: 0, proteinPerKg: 1.6 },
  { key: "subir", label: "Subir masa", desc: "Superávit calórico", calorieDelta: 300, proteinPerKg: 1.8 },
];

/** Metabolismo basal — ecuación de Mifflin-St Jeor. */
export function mifflinStJeor(p: Profile): number {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  return p.sex === "masculino" ? base + 5 : base - 161;
}

/** Calcula metas diarias de calorías y macros a partir del perfil. */
export function computeGoals(p: Profile): Goals {
  const activity = ACTIVITIES.find((a) => a.key === p.activity) ?? ACTIVITIES[2];
  const obj = OBJECTIVES.find((o) => o.key === p.objective) ?? OBJECTIVES[1];

  const tdee = mifflinStJeor(p) * activity.factor;
  const calories = Math.max(1200, Math.round((tdee + obj.calorieDelta) / 10) * 10);

  // Proteína según objetivo (g/kg); grasa 25% de las calorías; resto carbohidratos.
  const protein = Math.round(p.weight * obj.proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat };
}
