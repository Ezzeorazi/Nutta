import type { StrengthSet } from "@/lib/types";

/** Volumen de una serie = reps × peso. */
export const setVolume = (s: Pick<StrengthSet, "reps" | "weight">) =>
  s.reps * s.weight;

/** Volumen total de un conjunto de series. */
export const totalVolume = (sets: StrengthSet[]) =>
  sets.reduce((sum, s) => sum + setVolume(s), 0);

export type ExerciseGroup = {
  exercise: string;
  sets: StrengthSet[];
  volume: number;
  topWeight: number; // mejor peso del grupo
};

/** Agrupa series por ejercicio (orden por primera aparición). */
export function groupByExercise(sets: StrengthSet[]): ExerciseGroup[] {
  const map = new Map<string, StrengthSet[]>();
  for (const s of sets) {
    const key = s.exercise;
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return [...map.entries()].map(([exercise, arr]) => ({
    exercise,
    sets: arr.sort((a, b) => a.createdAt - b.createdAt),
    volume: totalVolume(arr),
    topWeight: Math.max(...arr.map((s) => s.weight)),
  }));
}

/** Mejor peso histórico (PR) por ejercicio, sobre todas las series. */
export function personalRecords(sets: StrengthSet[]): Map<string, number> {
  const pr = new Map<string, number>();
  for (const s of sets) {
    pr.set(s.exercise, Math.max(pr.get(s.exercise) ?? 0, s.weight));
  }
  return pr;
}

/** Nombres de ejercicios ya usados (para autocompletar), más recientes primero. */
export function usedExercises(sets: StrengthSet[]): string[] {
  const seen = new Map<string, number>();
  for (const s of sets) {
    seen.set(s.exercise, Math.max(seen.get(s.exercise) ?? 0, s.createdAt));
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/** Grupos musculares detectables por el nombre del ejercicio. */
const MUSCLE_LIFTS: { group: string; re: RegExp }[] = [
  { group: "pecho", re: /press banca|inclinad|pectoral|apertura|fondos|pecho/i },
  {
    group: "espalda",
    re: /dominada|remo|jal[oó]n|pull|peso muerto|dorsal|espalda/i,
  },
  {
    group: "piernas",
    re: /sentadilla|prensa|hip thrust|zancada|extensi[oó]n de cu[aá]dri|femoral|gemelo|pierna|gl[uú]teo/i,
  },
  { group: "hombros", re: /press militar|hombro|lateral|arnold|deltoide/i },
  { group: "brazos", re: /curl|b[ií]ceps|tr[ií]ceps/i },
];

const groupsOf = (name: string) =>
  MUSCLE_LIFTS.filter((m) => m.re.test(name)).map((m) => m.group);

const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );

/**
 * Recomendación de qué entrenar hoy, según los grupos trabajados
 * recientemente. Devuelve una frase o null si no hay historial suficiente.
 */
export function muscleRecommendation(
  sets: StrengthSet[],
  today: string,
): string | null {
  if (sets.length === 0) return null;

  const lastByGroup = new Map<string, string>();
  const todayGroups = new Set<string>();
  const yesterday = new Set<string>();
  for (const s of sets) {
    for (const g of groupsOf(s.exercise)) {
      const prev = lastByGroup.get(g);
      if (!prev || s.date > prev) lastByGroup.set(g, s.date);
      if (s.date === today) todayGroups.add(g);
      if (dayDiff(today, s.date) === 1) yesterday.add(g);
    }
  }

  if (todayGroups.size > 0) {
    return `Hoy ya moviste ${[...todayGroups].join(" y ")}. 🔥`;
  }

  // Grupo con más días sin entrenar (los nunca entrenados = gap grande).
  const groups = MUSCLE_LIFTS.map((m) => m.group);
  let pick = groups[0];
  let maxGap = -1;
  for (const g of groups) {
    const last = lastByGroup.get(g);
    const gap = last ? dayDiff(today, last) : 999;
    if (gap > maxGap) {
      maxGap = gap;
      pick = g;
    }
  }

  const yPart = yesterday.size ? `Ayer entrenaste ${[...yesterday].join(" y ")}. ` : "";
  const last = lastByGroup.get(pick);
  if (last && maxGap >= 5) {
    return `${yPart}Hace ${maxGap} días que no entrenás ${pick} — hoy es un buen día.`;
  }
  return `${yPart}Hoy te conviene ${pick}.`;
}

/** Mejor peso por día para un ejercicio (para graficar progresión). */
export function exerciseProgress(
  sets: StrengthSet[],
  exercise: string,
): { date: string; weight: number; volume: number }[] {
  const byDay = new Map<string, StrengthSet[]>();
  for (const s of sets) {
    if (s.exercise !== exercise) continue;
    const arr = byDay.get(s.date) ?? [];
    arr.push(s);
    byDay.set(s.date, arr);
  }
  return [...byDay.entries()]
    .map(([date, arr]) => ({
      date,
      weight: Math.max(...arr.map((s) => s.weight)),
      volume: totalVolume(arr),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
