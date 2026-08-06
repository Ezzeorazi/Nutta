import type { Goals, WeightEntry } from "./types";

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
  /** Días de entrenamiento por semana que describe el nivel (para contrastar). */
  daysPerWeek: [number, number];
}[] = [
  {
    key: "sedentario",
    label: "Sedentario",
    desc: "Poco o nada de ejercicio",
    factor: 1.2,
    daysPerWeek: [0, 0.5],
  },
  {
    key: "ligero",
    label: "Ligero",
    desc: "1–3 días/semana",
    factor: 1.375,
    daysPerWeek: [0.5, 3],
  },
  {
    key: "moderado",
    label: "Moderado",
    desc: "3–5 días/semana",
    factor: 1.55,
    daysPerWeek: [3, 5.5],
  },
  {
    key: "activo",
    label: "Activo",
    desc: "6–7 días/semana",
    factor: 1.725,
    daysPerWeek: [5.5, 7],
  },
  {
    key: "muy_activo",
    label: "Muy activo",
    desc: "Físico intenso / 2x día",
    factor: 1.9,
    daysPerWeek: [7, 14],
  },
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

/**
 * Meta diaria de hidratación (litros) escalada al peso (~35 ml/kg), con un
 * piso de 2 L. Redondeada a 0.1 L. Un dato que un entrenador ajusta por persona.
 */
export function waterGoalL(weightKg: number): number {
  if (!(weightKg > 0)) return 2.5;
  return Math.max(2, Math.round(weightKg * 0.035 * 10) / 10);
}

/**
 * Peso corporal para TODOS los cálculos: metas, agua y calorías de ejercicio.
 *
 * Sale de la balanza, no del formulario. El `weight` del perfil se completa una
 * vez en el onboarding y queda viejo para siempre —el usuario se pesa en
 * Progreso y ninguna meta se enteraba—, así que ahora manda el registro de
 * peso y el perfil queda solo como respaldo.
 *
 * Se promedian los pesajes de la última semana para que la meta no salte 200
 * kcal porque te pesaste después de cenar.
 */
export function effectiveWeight(
  profileWeight: number,
  weights: Pick<WeightEntry, "date" | "kg">[],
  today: string,
): number {
  if (weights.length === 0) return profileWeight;
  const dayDiff = (a: string, b: string) =>
    Math.round(
      (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
    );
  const recent = weights.filter((w) => {
    const d = dayDiff(today, w.date);
    return d >= 0 && d < 7;
  });
  const pool = recent.length ? recent : [weights[weights.length - 1]];
  const avg = pool.reduce((s, w) => s + w.kg, 0) / pool.length;
  return Math.round(avg * 10) / 10;
}

export type ActivityMismatch = {
  declared: ActivityKey;
  suggested: ActivityKey;
  /** Días de entrenamiento por semana medidos de verdad. */
  actual: number;
  /** Cuánto bajaría (o subiría) la meta diaria si se corrigiera. */
  kcalDelta: number;
};

/**
 * Contrasta el nivel de actividad declarado con los días que la persona
 * REALMENTE entrena. Si no coinciden, todas las metas están corridas: el
 * factor de actividad multiplica el metabolismo basal entero, así que una
 * casilla de más son cientos de kcal y ~100 g de carbos fantasma por día.
 *
 * Solo avisa cuando la diferencia es de al menos dos niveles: uno solo entra
 * dentro del error de una fórmula que ya es una estimación.
 */
export function activityMismatch(
  p: Profile,
  trainingDays: number,
  windowDays: number,
): ActivityMismatch | null {
  if (windowDays < 14) return null; // sin historial suficiente no se opina
  const actual = (trainingDays / windowDays) * 7;
  const declaredIdx = ACTIVITIES.findIndex((a) => a.key === p.activity);
  if (declaredIdx < 0) return null;
  const suggestedIdx = ACTIVITIES.findIndex(
    (a) => actual >= a.daysPerWeek[0] && actual < a.daysPerWeek[1],
  );
  if (suggestedIdx < 0 || Math.abs(suggestedIdx - declaredIdx) < 2) return null;

  const suggested = ACTIVITIES[suggestedIdx];
  const kcalDelta =
    computeGoals({ ...p, activity: suggested.key }).calories -
    computeGoals(p).calories;
  return {
    declared: p.activity,
    suggested: suggested.key,
    actual: Math.round(actual * 10) / 10,
    kcalDelta,
  };
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
