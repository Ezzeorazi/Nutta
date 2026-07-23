/**
 * Base de ejercicios (dataset RepDB, adelgazado en src/data/exercises.json).
 *
 * Provee un matcher determinístico para "snapear" nombres libres (los que
 * escribe el usuario o extrae la IA) contra los 400 ejercicios canónicos,
 * más helpers de grupo muscular y MET. Es 100% código nuestro: el dataset
 * NUNCA entra al prompt de la IA (respeta la licencia RepDB, que prohíbe
 * su uso dentro de modelos generativos).
 *
 * Atribución obligatoria: "Exercise data by RepDB (repdb.co)".
 */
import raw from "@/data/exercises.json";

export type DbExercise = {
  id: string;
  name_es: string;
  name_en: string;
  category: string; // strength | cardio | stretching | plyometrics | olympic | strongman
  met: number | null;
  equipment: string;
  body_part: string;
  mechanic: string; // compound | isolation
  is_bodyweight: boolean;
  primary_muscles: string[];
  secondary_muscles: string[];
  image?: string | null; // archivo en /public/exercises (o null si no hay)
};

export const EXERCISES: DbExercise[] = (
  raw as unknown as { exercises: DbExercise[] }
).exercises;

/** Grupos musculares que usa la app (alineados con gym.ts + "core"). */
export type MuscleGroup =
  | "pecho"
  | "espalda"
  | "piernas"
  | "hombros"
  | "brazos"
  | "core";

/** Código de músculo del dataset → grupo de la app. */
const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  // Pecho
  pectoralis_major: "pecho",
  serratus_anterior: "pecho",
  // Espalda
  latissimus_dorsi: "espalda",
  trapezius: "espalda",
  rhomboids: "espalda",
  erector_spinae: "espalda",
  quadratus_lumborum: "espalda",
  // Piernas
  quadriceps: "piernas",
  hamstrings: "piernas",
  gluteus_maximus: "piernas",
  gluteus_medius: "piernas",
  abductors: "piernas",
  adductors: "piernas",
  hip_flexors: "piernas",
  gastrocnemius: "piernas",
  soleus: "piernas",
  // Hombros
  anterior_deltoid: "hombros",
  lateral_deltoid: "hombros",
  posterior_deltoid: "hombros",
  // Brazos
  biceps_brachii: "brazos",
  triceps_brachii: "brazos",
  brachialis: "brazos",
  brachioradialis: "brazos",
  forearms: "brazos",
  forearm_flexors: "brazos",
  forearm_extensors: "brazos",
  // Core
  rectus_abdominis: "core",
  transverse_abdominis: "core",
  obliques: "core",
};

/** Grupo muscular dominante a partir de los músculos primarios. */
export function groupOfMuscles(muscles: string[]): MuscleGroup | null {
  for (const m of muscles) {
    const g = MUSCLE_TO_GROUP[m];
    if (g) return g;
  }
  return null;
}

/**
 * Palabras genéricas (músculos / "entrené" / cardio suelto). Si la consulta se
 * compone SOLO de estas, no matcheamos: "entrené espalda" es una sesión, no un
 * ejercicio puntual, y snapearla a uno específico sería un falso positivo.
 */
const GENERIC = new Set([
  "entrene",
  "entrenar",
  "entrenamiento",
  "entreno",
  "gym",
  "gimnasio",
  "ejercicio",
  "ejercicios",
  "pesas",
  "musculacion",
  "cardio",
  "pecho",
  "pectoral",
  "espalda",
  "dorsal",
  "pierna",
  "piernas",
  "gluteo",
  "gluteos",
  "hombro",
  "hombros",
  "brazo",
  "brazos",
  "biceps",
  "triceps",
  "abdomen",
  "abdominal",
  "abdominales",
  "core",
]);

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "con",
  "en",
  "a",
  "y",
  "the",
  "of",
  "with",
]);

/** minúsculas + sin tildes + solo alfanumérico. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** tokens significativos (sin stopwords ni tokens de 1 char). */
function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

type Indexed = {
  ex: DbExercise;
  normEs: string;
  normEn: string;
  tokEs: string[];
  tokEn: string[];
};

const INDEX: Indexed[] = EXERCISES.map((ex) => ({
  ex,
  normEs: norm(ex.name_es),
  normEn: norm(ex.name_en),
  tokEs: tokens(ex.name_es),
  tokEn: tokens(ex.name_en),
}));

const EXACT = new Map<string, DbExercise>();
for (const it of INDEX) {
  if (it.normEs) EXACT.set(it.normEs, it.ex);
  if (it.normEn && !EXACT.has(it.normEn)) EXACT.set(it.normEn, it.ex);
}

/** Similitud de tokens (Jaccard) entre consulta y candidato. */
function tokenScore(q: string[], cand: string[]): number {
  if (q.length === 0 || cand.length === 0) return 0;
  const setC = new Set(cand);
  let common = 0;
  for (const t of q) if (setC.has(t)) common++;
  return common / Math.max(q.length, cand.length);
}

const MATCH_THRESHOLD = 0.5;

/**
 * Busca el ejercicio canónico que mejor matchea un nombre libre.
 * Devuelve null si no hay una coincidencia razonable.
 */
export function matchExercise(name: string): DbExercise | null {
  const q = norm(name);
  if (!q) return null;

  // 1) match exacto (es/en)
  const exact = EXACT.get(q);
  if (exact) return exact;

  // 2) mejor puntaje por tokens
  const qt = tokens(name);
  if (qt.length === 0) return null;
  // Consulta solo de palabras genéricas (músculo/sesión) → no matchear.
  if (qt.every((t) => GENERIC.has(t))) return null;

  let best: DbExercise | null = null;
  let bestScore = 0;
  let bestLenDiff = Infinity;

  for (const it of INDEX) {
    const score = Math.max(tokenScore(qt, it.tokEs), tokenScore(qt, it.tokEn));
    if (score < MATCH_THRESHOLD) continue;
    const lenDiff = Math.min(
      Math.abs(qt.length - it.tokEs.length),
      Math.abs(qt.length - it.tokEn.length),
    );
    // mejor puntaje; a igual puntaje, el de longitud más parecida
    if (score > bestScore || (score === bestScore && lenDiff < bestLenDiff)) {
      best = it.ex;
      bestScore = score;
      bestLenDiff = lenDiff;
    }
  }
  return best;
}

/** Nombre canónico en español (o el original si no hay match). */
export function canonicalName(name: string): string {
  return matchExercise(name)?.name_es ?? name;
}

/** MET real del ejercicio matcheado (o null). */
export function metOf(name: string): number | null {
  return matchExercise(name)?.met ?? null;
}

/** Grupo muscular del ejercicio matcheado (o null). */
export function groupOf(name: string): MuscleGroup | null {
  const ex = matchExercise(name);
  return ex ? groupOfMuscles(ex.primary_muscles) : null;
}

/** Nombres en español de todos los ejercicios (para autocompletar). */
export function allNamesEs(): string[] {
  return EXERCISES.map((e) => e.name_es);
}

/** Grupos musculares en orden de UI, con etiqueta y emoji. */
export const MUSCLE_GROUPS: { key: MuscleGroup; label: string; emoji: string }[] =
  [
    { key: "pecho", label: "Pecho", emoji: "🫀" },
    { key: "espalda", label: "Espalda", emoji: "🔙" },
    { key: "piernas", label: "Piernas", emoji: "🦵" },
    { key: "hombros", label: "Hombros", emoji: "🎽" },
    { key: "brazos", label: "Brazos", emoji: "💪" },
    { key: "core", label: "Core", emoji: "🎯" },
  ];

/**
 * Todos los ejercicios agrupados por grupo muscular (según su músculo primario).
 * Dentro de cada grupo: compuestos primero, luego alfabético por nombre_es.
 */
export function exercisesByGroup(): Record<MuscleGroup, DbExercise[]> {
  const out = {
    pecho: [],
    espalda: [],
    piernas: [],
    hombros: [],
    brazos: [],
    core: [],
  } as Record<MuscleGroup, DbExercise[]>;
  for (const ex of EXERCISES) {
    const g = groupOfMuscles(ex.primary_muscles);
    if (g) out[g].push(ex);
  }
  const rank = (e: DbExercise) => (e.mechanic === "compound" ? 0 : 1);
  for (const g of Object.keys(out) as MuscleGroup[]) {
    out[g].sort(
      (a, b) => rank(a) - rank(b) || a.name_es.localeCompare(b.name_es, "es"),
    );
  }
  return out;
}

/** Filtra ejercicios por nombre (es/en), sin distinguir tildes ni mayúsculas. */
export function searchExercises(query: string, limit = 40): DbExercise[] {
  const q = norm(query);
  if (!q) return [];
  const out: DbExercise[] = [];
  for (const it of INDEX) {
    if (it.normEs.includes(q) || it.normEn.includes(q)) {
      out.push(it.ex);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Etiquetas en español para el equipo del dataset (fallback: capitalizar). */
const EQUIPMENT_ES: Record<string, string> = {
  "": "Peso corporal",
  barbell: "Barra",
  dumbbell: "Mancuernas",
  cable: "Polea",
  machine: "Máquina",
  kettlebell: "Kettlebell",
  ez_bar: "Barra Z",
  trap_bar: "Barra trap",
  smith_machine: "Máquina Smith",
  pull_up_bar: "Barra de dominadas",
  dip_station: "Paralelas",
  ab_wheel: "Rueda abdominal",
  resistance_band: "Banda elástica",
  medicine_ball: "Balón medicinal",
  stability_ball: "Pelota de estabilidad",
  bosu_ball: "Bosu",
  foam_roller: "Foam roller",
  bench: "Banco",
  flat_bench: "Banco plano",
  plates: "Discos",
  plate: "Disco",
  box: "Cajón",
  bodyweight: "Peso corporal",
  none: "Peso corporal",
};

const capitalize = (s: string) =>
  s
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

/** Nombre legible en español del equipo de un ejercicio. */
export function equipmentLabel(equipment: string): string {
  return EQUIPMENT_ES[equipment] ?? capitalize(equipment);
}

/** "Compuesto" / "Aislado" (o "" si el dato no viene). */
export function mechanicLabel(mechanic: string): string {
  if (mechanic === "compound") return "Compuesto";
  if (mechanic === "isolation") return "Aislado";
  return "";
}
