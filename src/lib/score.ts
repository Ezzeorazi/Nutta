import {
  WATER_GOAL_L,
  type DailyMetrics,
  type ExerciseEntry,
  type FoodEntry,
  type Goals,
} from "@/lib/types";

/** Bebidas alcohólicas (penalizan el score). */
const ALCOHOL =
  /cerveza|birra|vino|fernet|whisky|whiskey|vodka|\bgin\b|trago|alcohol|champ[aá]n|licor|aperol|c[au]ipi|daiquiri|margarita|ron\b|tequila/i;

export type ScorePart = { label: string; points: number; max: number };

export type DailyScore = {
  score: number; // 0-100
  label: string;
  parts: ScorePart[];
  tips: string[];
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** 1 cuando value ≈ goal, cae a 0 al desviarse más de `tol` (fracción). */
function closeness(value: number, goal: number, tol: number) {
  if (goal <= 0) return value > 0 ? 0.5 : 0;
  const err = Math.abs(value - goal) / goal;
  return clamp(1 - err / tol, 0, 1);
}

function label(score: number): string {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Muy bien";
  if (score >= 50) return "Bien";
  if (score >= 30) return "Flojo";
  return "A arrancar";
}

/** Calidad del sueño según horas (ideal 7-9 h). */
function sleepRatio(hours: number): number {
  if (hours <= 0) return 0;
  if (hours >= 7 && hours <= 9) return 1;
  if (hours < 7) return clamp((hours / 7) * 0.95, 0, 0.95);
  return clamp(1 - (hours - 9) * 0.1, 0.5, 0.9); // dormir de más resta un poco
}

/**
 * Score diario 0-100 a partir de lo registrado hoy y las metas.
 * Factores: proteína, calorías, macros, entrenamiento y —si se registran—
 * sueño y agua. El puntaje se normaliza sobre los factores presentes, así
 * que NO registrar sueño/agua no penaliza. El alcohol resta puntos.
 */
export function dailyScore(
  foods: FoodEntry[],
  exercises: ExerciseEntry[],
  goals: Goals,
  metrics?: Pick<DailyMetrics, "water" | "sleepHours">,
  waterGoal: number = WATER_GOAL_L,
): DailyScore {
  const protein = foods.reduce((s, f) => s + f.protein, 0);
  const calories = foods.reduce((s, f) => s + f.calories, 0);
  const carbs = foods.reduce((s, f) => s + f.carbs, 0);
  const fat = foods.reduce((s, f) => s + f.fat, 0);
  const trained = exercises.length > 0;
  const hasAlcohol = foods.some((f) => ALCOHOL.test(f.name));

  const factors: { label: string; weight: number; ratio: number }[] = [
    {
      label: "Proteína",
      weight: 30,
      ratio: clamp(protein / (goals.protein || 1), 0, 1),
    },
    { label: "Calorías", weight: 25, ratio: closeness(calories, goals.calories, 0.35) },
    {
      label: "Macros",
      weight: 15,
      ratio:
        (closeness(carbs, goals.carbs, 0.5) +
          closeness(fat, goals.fat, 0.5)) /
        2,
    },
    { label: "Entrenamiento", weight: 30, ratio: trained ? 1 : 0 },
  ];

  const hasSleep = metrics?.sleepHours != null && metrics.sleepHours > 0;
  const hasWater = metrics?.water != null && metrics.water > 0;
  if (hasSleep) {
    factors.push({
      label: "Sueño",
      weight: 20,
      ratio: sleepRatio(metrics!.sleepHours!),
    });
  }
  if (hasWater) {
    factors.push({
      label: "Agua",
      weight: 10,
      ratio: clamp(metrics!.water! / waterGoal, 0, 1),
    });
  }

  const totW = factors.reduce((s, f) => s + f.weight, 0);
  const base = (factors.reduce((s, f) => s + f.weight * f.ratio, 0) / totW) * 100;
  const alcPen = hasAlcohol ? 15 : 0;
  const score = clamp(Math.round(base - alcPen), 0, 100);

  const parts: ScorePart[] = factors.map((f) => ({
    label: f.label,
    points: Math.round(f.weight * f.ratio),
    max: f.weight,
  }));
  if (alcPen) parts.push({ label: "Alcohol", points: -alcPen, max: 0 });

  const tips: string[] = [];
  if (protein < goals.protein * 0.8) {
    tips.push(
      `Te falta proteína: sumá ~${Math.max(
        0,
        Math.round(goals.protein - protein),
      )} g.`,
    );
  }
  if (!trained) tips.push("Hoy no registraste entrenamiento.");
  if (calories > goals.calories * 1.15) {
    tips.push("Te pasaste de calorías; ojo con las porciones.");
  } else if (calories > 0 && calories < goals.calories * 0.6) {
    tips.push("Vas muy por debajo de tus calorías; comé algo más.");
  }
  if (hasSleep && metrics!.sleepHours! < 6) {
    tips.push(`Dormiste poco (${metrics!.sleepHours} h); apuntá a 7-8.`);
  }
  if (hasWater && metrics!.water! < waterGoal * 0.6) {
    tips.push("Tomá más agua para llegar a tu meta.");
  }
  if (!hasSleep && !hasWater) {
    tips.push("Registrá tu sueño y agua para un score más completo.");
  }
  if (hasAlcohol) tips.push("El alcohol sumó calorías y bajó tu score.");
  if (score >= 85) tips.unshift("Gran día, seguí así 💪");

  return { score, label: label(score), parts, tips };
}
