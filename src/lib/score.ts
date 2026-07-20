import type { ExerciseEntry, FoodEntry, Goals } from "@/lib/types";

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

/**
 * Score diario 0-100 a partir de lo registrado hoy y las metas.
 * Factores actuales: proteína (30), calorías (25), macros (15),
 * entrenamiento (30) y penalización por alcohol (−15).
 * Sueño y agua se sumarán cuando se registren (Fase 3).
 */
export function dailyScore(
  foods: FoodEntry[],
  exercises: ExerciseEntry[],
  goals: Goals,
): DailyScore {
  const protein = foods.reduce((s, f) => s + f.protein, 0);
  const calories = foods.reduce((s, f) => s + f.calories, 0);
  const carbs = foods.reduce((s, f) => s + f.carbs, 0);
  const fat = foods.reduce((s, f) => s + f.fat, 0);
  const trained = exercises.length > 0;
  const hasAlcohol = foods.some((f) => ALCOHOL.test(f.name));

  const pPts = Math.round(clamp(protein / (goals.protein || 1), 0, 1) * 30);
  const cPts = Math.round(closeness(calories, goals.calories, 0.35) * 25);
  const mPts = Math.round(
    ((closeness(carbs, goals.carbs, 0.5) + closeness(fat, goals.fat, 0.5)) /
      2) *
      15,
  );
  const tPts = trained ? 30 : 0;
  const alcPen = hasAlcohol ? 15 : 0;

  const score = clamp(
    Math.round(pPts + cPts + mPts + tPts - alcPen),
    0,
    100,
  );

  const parts: ScorePart[] = [
    { label: "Proteína", points: pPts, max: 30 },
    { label: "Calorías", points: cPts, max: 25 },
    { label: "Macros", points: mPts, max: 15 },
    { label: "Entrenamiento", points: tPts, max: 30 },
  ];
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
  if (hasAlcohol) tips.push("El alcohol sumó calorías y bajó tu score.");
  if (score >= 85) tips.unshift("Gran día, seguí así 💪");

  return { score, label: label(score), parts, tips };
}
