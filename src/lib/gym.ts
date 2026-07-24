import type { ObjectiveKey } from "@/lib/nutrition";
import type { StrengthSet } from "@/lib/types";
import exerciseGroups from "@/data/exercise-groups.json";
import exerciseByGroup from "@/data/exercise-by-group.json";

/** Mapa nombre_normalizado → grupo muscular (precalculado del dataset RepDB). */
const GROUP_MAP = exerciseGroups as Record<string, string>;

/** Mapa grupo → ejercicios sugeridos (priorizados del dataset RepDB). */
const BY_GROUP = exerciseByGroup as Record<string, string[]>;

/** Ejercicios sugeridos para un grupo (los N mejores). */
export function groupExercises(group: string, n = 3): string[] {
  return (BY_GROUP[group] ?? []).slice(0, n);
}

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

const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );

/** Objetivo de días de fuerza por semana (dispara los días de recuperación). */
export const GYM_DAYS_GOAL = 5;

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Lunes de la semana a la que pertenece `iso` (YYYY-MM-DD). */
const startOfWeek = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return toISO(d);
};

/** Cantidad de días distintos (con actividad) en la semana de `today`. */
const distinctDaysThisWeek = (dates: string[], today: string) => {
  const start = startOfWeek(today);
  const set = new Set(dates.filter((d) => d >= start && d <= today));
  return set.size;
};

export type RoutineExercise = { name: string; sets: number; reps: string };
export type RoutineGroup = { group: string; exercises: RoutineExercise[] };

export type RoutinePlan = {
  headline: string;
  tone: "train" | "recovery" | "done";
  groups: RoutineGroup[];
  /** Sugerencia de cardio para el día (recuperación activa o complemento). */
  cardioTip?: string;
  /** clave estable del día para poder descartarla por jornada. */
  key: string;
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

/** Fecha de la última vez que se trabajó cada grupo muscular. */
function lastTrainedByGroup(sets: StrengthSet[]): Map<string, string> {
  const last = new Map<string, string>();
  for (const s of sets) {
    for (const g of groupsOf(s.exercise)) {
      const prev = last.get(g);
      if (!prev || s.date > prev) last.set(g, s.date);
    }
  }
  return last;
}

/** Esquema de entrenamiento por objetivo: reps, series, días/semana y cardio. */
type TrainingStyle = {
  key: ObjectiveKey;
  /** reps por posición del ejercicio dentro de la rutina */
  repScheme: RoutineExercise["reps"][];
  setsPrimary: number; // series del primer ejercicio de cada grupo
  setsSecondary: number; // series del resto
  daysGoal: number; // objetivo de días de fuerza por semana
  cardioTip: string; // sugerencia de cardio en días de recuperación
};

export const TRAINING_STYLES: TrainingStyle[] = [
  {
    key: "bajar",
    repScheme: ["12-15", "15-20", "15-20"],
    setsPrimary: 4,
    setsSecondary: 3,
    daysGoal: 5,
    cardioTip:
      "25-35 min de cardio suave (caminar, bici, nadar) + movilidad/core.",
  },
  {
    // Valores idénticos al esquema original (antes de sumar objetivos), para
    // no cambiarle el comportamiento a quien no definió objetivo.
    key: "mantener",
    repScheme: ["8-10", "10-12", "12-15"],
    setsPrimary: 4,
    setsSecondary: 3,
    daysGoal: GYM_DAYS_GOAL,
    cardioTip: "20-30 min de cardio suave (caminar, bici, nadar) + movilidad/core.",
  },
  {
    key: "subir",
    repScheme: ["6-8", "8-10", "10-12"],
    setsPrimary: 4,
    setsSecondary: 4,
    daysGoal: 4,
    cardioTip:
      "15-20 min de cardio ligero de recuperación (no compromete la recuperación muscular).",
  },
];

const routineGroup = (
  group: string,
  from: number,
  style: TrainingStyle,
): RoutineGroup => ({
  group,
  exercises: groupExercises(group, 2).map((name, i) => ({
    name,
    sets: i === 0 ? style.setsPrimary : style.setsSecondary,
    reps: style.repScheme[from + i] ?? style.repScheme[style.repScheme.length - 1],
  })),
});

/**
 * Arma la rutina completa de hoy según lo entrenado esta semana: prioriza
 * los grupos musculares con menos series esta semana (desempate por más
 * días sin entrenarlos) y propone ejercicios concretos con series y reps
 * acordes al objetivo del usuario (bajar/mantener/subir). Al llegar al
 * objetivo semanal de días de fuerza, sugiere recuperación activa (cardio
 * suave) en vez de una rutina de fuerza.
 */
export function buildDailyRoutine(
  strengthSets: StrengthSet[],
  cardio: { date: string }[],
  today: string,
  objective: ObjectiveKey = "mantener",
): RoutinePlan {
  const style =
    TRAINING_STYLES.find((s) => s.key === objective) ?? TRAINING_STYLES[1];
  const goal = style.daysGoal;

  const strengthDays = distinctDaysThisWeek(
    strengthSets.map((s) => s.date),
    today,
  );
  const trainedToday = strengthSets.some((s) => s.date === today);
  const cardioToday = cardio.some((c) => c.date === today);
  const key = `${today}:${strengthDays}:${trainedToday ? "t" : "n"}`;

  if (trainedToday) {
    return {
      key,
      tone: "done",
      headline: `Listo por hoy 💪 Llevás ${strengthDays}/${goal} días de fuerza esta semana.`,
      groups: [],
    };
  }

  if (strengthDays >= goal) {
    const extra = cardioToday ? " Ya sumaste cardio hoy 👏" : "";
    return {
      key,
      tone: "recovery",
      headline: `Ya cumpliste tus ${goal} días de fuerza 🔥 Hoy toca recuperación activa.${extra}`,
      groups: [],
      cardioTip: style.cardioTip,
    };
  }

  const weekly = groupStatsInRange(strengthSets, startOfWeek(today), today);
  const lastByGroup = lastTrainedByGroup(strengthSets);

  // Orden: menos series esta semana primero; empate → más días sin entrenarlo.
  const ranked = [...MUSCLE_GROUPS].sort((a, b) => {
    const wa = weekly.find((g) => g.group === a)?.sets ?? 0;
    const wb = weekly.find((g) => g.group === b)?.sets ?? 0;
    if (wa !== wb) return wa - wb;
    const lastA = lastByGroup.get(a);
    const lastB = lastByGroup.get(b);
    const gapA = lastA ? dayDiff(today, lastA) : 999;
    const gapB = lastB ? dayDiff(today, lastB) : 999;
    return gapB - gapA;
  });

  const [primary, secondary] = ranked;
  const groups: RoutineGroup[] = [routineGroup(primary, 0, style)];
  if (secondary) groups.push(routineGroup(secondary, 1, style));

  return {
    key,
    tone: "train",
    headline: `Vas ${strengthDays}/${goal} días esta semana. Hoy toca: ${primary}${secondary ? ` + ${secondary}` : ""}.`,
    groups,
  };
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
