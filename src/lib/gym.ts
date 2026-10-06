import type { StrengthSet } from "@/lib/types";
import exerciseGroups from "@/data/exercise-groups.json";

/** Mapa nombre_normalizado → grupo muscular (precalculado del dataset RepDB). */
const GROUP_MAP = exerciseGroups as Record<string, string>;

const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

/** Lista canónica de grupos musculares (orden estable, para rankear/listar). */
export const MUSCLE_GROUPS: string[] = MUSCLE_LIFTS.map((m) => m.group);

/**
 * Grupos musculares de un ejercicio. Primero busca el nombre en el mapa real
 * del dataset (preciso para los nombres canónicos); si no está —alta manual
 * con nombre libre— cae a la detección por regex.
 */
export const groupsOf = (name: string): string[] => {
  const mapped = GROUP_MAP[normName(name)];
  if (mapped) return [mapped];
  return MUSCLE_LIFTS.filter((m) => m.re.test(name)).map((m) => m.group);
};

export type GroupStats = { group: string; sets: number; volume: number };

/**
 * Series y volumen por grupo muscular en un rango de fechas (inclusive).
 * Devuelve una fila por cada grupo de `MUSCLE_GROUPS` (en cero si no se
 * entrenó), ordenadas por series desc y volumen desc como desempate — el
 * orden que sirve para listar/graficar. Quien necesite rankear por otro
 * criterio (ej. recencia) puede reordenar el resultado.
 */
export function groupStatsInRange(
  sets: StrengthSet[],
  fromISO: string,
  toISO: string,
): GroupStats[] {
  const stats = new Map<string, GroupStats>(
    MUSCLE_GROUPS.map((g) => [g, { group: g, sets: 0, volume: 0 }]),
  );
  for (const s of sets) {
    if (s.date < fromISO || s.date > toISO) continue;
    for (const g of groupsOf(s.exercise)) {
      const entry = stats.get(g);
      if (!entry) continue; // grupo fuera de MUSCLE_GROUPS (no debería pasar)
      entry.sets += 1;
      entry.volume += setVolume(s);
    }
  }
  return [...stats.values()].sort(
    (a, b) => b.sets - a.sets || b.volume - a.volume,
  );
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

export type LastPerformance = {
  date: string;
  /** Mejor peso de esa sesión y las reps más altas que hiciste con él. */
  weight: number;
  reps: number;
  /** Cuántas series hiciste con ese peso. */
  setsAtWeight: number;
  /** Todas las series con ese peso llegaron al tope del rango: toca subir. */
  topped: boolean;
};

/**
 * Tope del rango de reps de un esquema del plan: "4 × 8-10" → 10. Los que van
 * por tiempo ("3 × 45-60 s") no tienen reps que topear.
 */
const rangeTop = (scheme: string): number | null => {
  if (/\d\s*s\b/.test(scheme)) return null;
  const m = scheme.match(/×\s*(?:\d+\s*-\s*)?(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Series del plan: "4 × 8-10" → 4. */
const plannedSets = (scheme: string): number | null => {
  const m = scheme.match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

/**
 * La última sesión ANTERIOR a `before` en que hiciste ese ejercicio: de ahí
 * sale el peso sugerido de la rutina, en vez de un número fijo en el plan que
 * queda viejo a la segunda semana.
 *
 * `same` decide si dos nombres son el mismo ejercicio (ej. por nombre
 * canónico): sin eso, "Abductor" y "Abducción de Cadera en Máquina" serían
 * dos historiales distintos.
 */
export function lastPerformance(
  sets: StrengthSet[],
  exercise: string,
  before: string,
  scheme?: string,
  same: (a: string, b: string) => boolean = (a, b) =>
    normName(a) === normName(b),
): LastPerformance | null {
  let lastDate = "";
  const byName = new Map<string, boolean>();
  const matches = (name: string) => {
    let ok = byName.get(name);
    if (ok === undefined) byName.set(name, (ok = same(name, exercise)));
    return ok;
  };
  for (const s of sets) {
    if (s.date < before && s.date > lastDate && s.weight > 0 && matches(s.exercise))
      lastDate = s.date;
  }
  if (!lastDate) return null;

  const session = sets.filter((s) => s.date === lastDate && matches(s.exercise));
  const weight = Math.max(...session.map((s) => s.weight));
  const atWeight = session.filter((s) => s.weight === weight);
  const reps = Math.max(...atWeight.map((s) => s.reps));

  const top = scheme ? rangeTop(scheme) : null;
  const planned = scheme ? plannedSets(scheme) : null;
  const topped =
    top != null &&
    planned != null &&
    atWeight.length >= planned &&
    atWeight.every((s) => s.reps >= top);

  return { date: lastDate, weight, reps, setsAtWeight: atWeight.length, topped };
}

/**
 * El siguiente escalón de peso: 2,5 kg en barra y máquina; con pesos chicos
 * (mancuerna liviana, polea de laterales) 2,5 kg es un salto del 30 %, así que
 * se sube de a 1.
 */
export const nextWeight = (w: number) => (w < 15 ? w + 1 : w + 2.5);
