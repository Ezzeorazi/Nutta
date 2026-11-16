import type { ExerciseKind, StrengthSet } from "@/lib/types";
import {
  fmtSeconds,
  lessAssist,
  setScore,
  type BodyweightOn,
  type KindOf,
} from "@/lib/exerciseKind";
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

/**
 * Clave con la que dos nombres son el MISMO ejercicio.
 *
 * El historial se escribe a mano y por el chat, así que el mismo movimiento
 * entra como "Jalón al Pecho", "Jalón al pecho" y "Jalon al pecho" — y antes
 * cada variante tenía su propia progresión, su propio PR y su propia fila en
 * la sesión: el gráfico mostraba la mitad de los puntos y el PR salía de la
 * mitad del historial.
 *
 * Fusiona SOLO por texto: mayúsculas, tildes, puntuación y espacios. Da la
 * tentación de resolver contra el catálogo —así "Abductor" y "Abducción de
 * Cadera en Máquina" caerían juntos—, pero probado contra un historial real
 * el fuzzy matching también fusiona ejercicios DISTINTOS ("Apertura de
 * Deltoides Posterior" con "Apertura con mancuernas", remo de agarre vertical
 * con el de agarre ancho). Partir un ejercicio en dos se ve y se corrige;
 * mezclar dos en uno corrompe la progresión en silencio, que es con lo que el
 * usuario decide cuánto cargar.
 *
 * El peso sugerido de la rutina sí usa el catálogo, porque ahí la comparación
 * es contra UN nombre del plan y no contra todo el historial (ver el
 * parámetro `same` de `lastPerformance`).
 */
export const exerciseKey = (name: string): string => normName(name);

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

/**
 * Agrupa series por ejercicio (orden por primera aparición). Las variantes de
 * un mismo nombre caen juntas; se muestra la grafía que más usaste.
 */
export function groupByExercise(sets: StrengthSet[]): ExerciseGroup[] {
  const map = new Map<string, StrengthSet[]>();
  for (const s of sets) {
    const key = exerciseKey(s.exercise);
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return [...map.values()].map((arr) => ({
    exercise: displayName(arr),
    sets: arr.sort((a, b) => a.createdAt - b.createdAt),
    volume: totalVolume(arr),
    topWeight: Math.max(...arr.map((s) => s.weight)),
  }));
}

/**
 * De varias grafías del mismo ejercicio, la que se muestra: la más repetida, y
 * ante empate la más reciente. Se prefiere lo que el usuario escribe a lo que
 * dice el catálogo: es su historial.
 */
function displayName(sets: StrengthSet[]): string {
  const count = new Map<string, { n: number; last: number }>();
  for (const s of sets) {
    const c = count.get(s.exercise) ?? { n: 0, last: 0 };
    c.n++;
    c.last = Math.max(c.last, s.createdAt);
    count.set(s.exercise, c);
  }
  return [...count.entries()].sort(
    (a, b) => b[1].n - a[1].n || b[1].last - a[1].last,
  )[0][0];
}

/** Mejor peso histórico (PR) por ejercicio, sobre todas las series. */
export function personalRecords(sets: StrengthSet[]): Map<string, number> {
  const best = new Map<string, { name: string; kg: number }>();
  for (const s of sets) {
    const k = exerciseKey(s.exercise);
    const prev = best.get(k);
    if (!prev) best.set(k, { name: s.exercise, kg: s.weight });
    else prev.kg = Math.max(prev.kg, s.weight);
  }
  // Se devuelve por nombre visible (lo consume el PDF de exportación), ya con
  // las variantes fusionadas: antes el mismo ejercicio salía dos veces.
  const byKey = new Map<string, StrengthSet[]>();
  for (const s of sets) {
    const k = exerciseKey(s.exercise);
    byKey.set(k, [...(byKey.get(k) ?? []), s]);
  }
  const pr = new Map<string, number>();
  for (const [k, arr] of byKey) pr.set(displayName(arr), best.get(k)!.kg);
  return pr;
}

/** Nombres de ejercicios ya usados (para autocompletar), más recientes primero. */
export function usedExercises(sets: StrengthSet[]): string[] {
  const seen = new Map<string, { name: string; last: number }>();
  for (const s of sets) {
    const k = exerciseKey(s.exercise);
    const prev = seen.get(k);
    // Una sola entrada por ejercicio, con la grafía que usaste la última vez:
    // el autocompletado mostraba "Jalón al Pecho" y "Jalón al pecho" juntos.
    if (!prev || s.createdAt > prev.last)
      seen.set(k, { name: s.exercise, last: s.createdAt });
  }
  return [...seen.values()]
    .sort((a, b) => b.last - a.last)
    .map((v) => v.name);
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

/**
 * El mejor puntaje de cada día para un ejercicio (para graficar progresión).
 * Según el tipo es el peso máximo, los kg netos de una asistida, las reps o
 * los segundos (ver `setScore`).
 */
export function exerciseProgress(
  sets: StrengthSet[],
  exercise: string,
  kind: ExerciseKind = "peso",
  bwOn: BodyweightOn = () => 0,
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  const target = exerciseKey(exercise);
  for (const s of sets) {
    if (exerciseKey(s.exercise) !== target) continue;
    const v = setScore(s, kind, bwOn(s.date));
    byDay.set(s.date, Math.max(byDay.get(s.date) ?? -Infinity, v));
  }
  return [...byDay.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** El mejor puntaje histórico por ejercicio: el PR, según su tipo. */
export function bestScores(
  sets: StrengthSet[],
  kindOf: KindOf,
  bwOn: BodyweightOn,
): Map<string, number> {
  const best = new Map<string, number>();
  for (const s of sets) {
    const v = setScore(s, kindOf(s.exercise), bwOn(s.date));
    const k = exerciseKey(s.exercise);
    best.set(k, Math.max(best.get(k) ?? -Infinity, v));
  }
  return best;
}

export type LastPerformance = {
  date: string;
  /**
   * Mejor peso de esa sesión y las reps más altas que hiciste con él. En una
   * asistida, la MENOR asistencia; en las de reps o tiempo, `reps` es lo
   * máximo que hiciste (en segundos, si es de tiempo).
   */
  weight: number;
  reps: number;
  /** Cuántas series hiciste con ese peso. */
  setsAtWeight: number;
  /** Todas las series con ese peso llegaron al tope del rango: toca subir. */
  topped: boolean;
  /**
   * El siguiente escalón REAL de ese ejercicio, sacado de los pesos que ya
   * usaste en él. Sin esto el aviso mandaba a pesos que no existen: 16 kg de
   * mancuerna "suben" a 18,5 (las mancuernas van de 2 en 2) y una placa de 59
   * a 61,5 (la torre salta a 62). Si nunca levantaste más, cae a un escalón
   * genérico por magnitud.
   */
  next: number;
};

/**
 * Tope del rango de un esquema del plan: "4 × 8-10" → 10 reps, "3 × 45-60 s"
 * → 60 segundos. Un esquema en segundos solo tiene tope para un ejercicio de
 * tiempo, y viceversa.
 */
const rangeTop = (scheme: string, kind: ExerciseKind): number | null => {
  const bySeconds = /\d\s*s\b/.test(scheme);
  if (bySeconds !== (kind === "tiempo")) return null;
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
  kind: ExerciseKind = "peso",
): LastPerformance | null {
  let lastDate = "";
  const byName = new Map<string, boolean>();
  const matches = (name: string) => {
    let ok = byName.get(name);
    if (ok === undefined) byName.set(name, (ok = same(name, exercise)));
    return ok;
  };
  // Con peso, una serie en 0 kg es un dato roto o un calentamiento: no sirve
  // de referencia. En los demás tipos el peso no dice nada.
  const counts = (s: StrengthSet) => (kind === "peso" ? s.weight > 0 : s.reps > 0);
  for (const s of sets) {
    if (s.date < before && s.date > lastDate && counts(s) && matches(s.exercise))
      lastDate = s.date;
  }
  if (!lastDate) return null;

  const session = sets.filter((s) => s.date === lastDate && matches(s.exercise));
  const weights = session.map((s) => s.weight);
  // La serie de referencia: la más pesada; en una asistida, la de menos ayuda.
  const weight = kind === "asistido" ? Math.min(...weights) : Math.max(...weights);
  const atWeight =
    kind === "reps" || kind === "tiempo"
      ? session
      : session.filter((s) => s.weight === weight);
  const reps = Math.max(...atWeight.map((s) => s.reps));

  const top = scheme ? rangeTop(scheme, kind) : null;
  const planned = scheme ? plannedSets(scheme) : null;
  // Se pide UNA serie menos de las planificadas (mínimo 2) al peso tope: casi
  // nadie arranca pesado, y exigir las cuatro con una serie de entrada liviana
  // hacía que el aviso no saltara nunca. En un historial real había cinco
  // ejercicios listos para subir hace semanas y ninguno avisaba por esto.
  const necesarias = planned == null ? null : Math.max(2, planned - 1);
  const topped =
    top != null &&
    necesarias != null &&
    atWeight.length >= necesarias &&
    atWeight.every((s) => s.reps >= top);

  // El escalón siguiente, preferentemente uno que ya existió en ese ejercicio:
  // es la única evidencia de qué pesos hay de verdad en ese gimnasio.
  const usados = [
    ...new Set(sets.filter((s) => matches(s.exercise) && s.weight > 0).map((s) => s.weight)),
  ].sort((a, b) => a - b);
  const next =
    kind === "asistido"
      ? // Menos asistencia es progresar: se busca hacia abajo.
        (usados.filter((w) => w < weight).pop() ?? lessAssist(weight))
      : (usados.find((w) => w > weight) ?? nextWeight(weight));

  return {
    date: lastDate,
    weight,
    reps,
    setsAtWeight: atWeight.length,
    topped,
    next,
  };
}

/**
 * El siguiente escalón de peso cuando no hay historial que lo diga.
 *
 * Por magnitud, no uno fijo: con 8 kg, 2,5 es un salto del 30 %; con una
 * mancuerna de 16, el medio kilo de un 18,5 directamente no existe (van de 2
 * en 2). Es solo el respaldo — si ya levantaste más en ese ejercicio, manda
 * ese peso real (ver `LastPerformance.next`).
 */
export const nextWeight = (w: number) =>
  w < 10 ? w + 1 : w < 22 ? w + 2 : w + 2.5;

/**
 * Lo que toca hoy partiendo de la última vez: lo mismo, o el siguiente
 * escalón si topeaste el rango. Más peso, menos asistencia, una rep más o
 * 5 segundos más, según el tipo.
 */
export function nextTarget(
  last: LastPerformance,
  kind: ExerciseKind,
): { reps: number; weight: number } {
  if (!last.topped) return { reps: last.reps, weight: last.weight };
  switch (kind) {
    case "peso":
    case "asistido":
      return { reps: last.reps, weight: last.next };
    case "reps":
      return { reps: last.reps + 1, weight: last.weight };
    case "tiempo":
      return { reps: last.reps + 5, weight: 0 };
  }
}

/**
 * La referencia de la última vez, para mostrar al lado del ejercicio: lo que
 * hiciste o, si topeaste, el siguiente escalón ("↑ 62,5 kg", "↓ asist. 17,5").
 */
export function lastLabel(last: LastPerformance, kind: ExerciseKind): string {
  const t = nextTarget(last, kind);
  switch (kind) {
    case "peso":
      return last.topped ? `↑ ${t.weight} kg` : `${last.weight} kg × ${last.reps}`;
    case "asistido":
      return last.topped
        ? `↓ asist. ${t.weight} kg`
        : `asist. ${last.weight} kg × ${last.reps}`;
    case "reps":
      return last.topped ? `↑ ${t.reps} reps` : `${last.reps} reps`;
    case "tiempo":
      return last.topped ? `↑ ${fmtSeconds(t.reps)}` : fmtSeconds(last.reps);
  }
}
