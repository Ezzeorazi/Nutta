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
 * Cómo le decimos acá a lo que el dataset llama de otra forma.
 *
 * El catálogo dice "Elevación de Talones" y "Aducción de Cadera"; en cualquier
 * gimnasio de acá eso es "pantorrillas" y "aductor". Sin esto, ejercicios del
 * propio plan del usuario no matcheaban con nada y quedaban sin grupo muscular
 * —ni para el reemplazo, ni para saber qué se entrenó—.
 *
 * Se aplican SOLO si el nombre no matcheó por las suyas: los nombres canónicos
 * que ya contienen estas palabras no se tocan.
 */
const ALIASES: [RegExp, string][] = [
  [/\bpantorrillas?\b/g, "elevacion de talones"],
  [/\bgemelos?\b/g, "elevacion de talones"],
  // El "en maquina" se consume a propósito: dejarlo empujaba "aductor en
  // maquina" hacia "Abducción de Cadera en Máquina" —el músculo opuesto—
  // porque compartía dos tokens en vez de uno.
  [/\baductor(?:es)?(?: en maquina)?\b/g, "aduccion de cadera"],
  [/\babductor(?:es)?(?: en maquina)?\b/g, "abduccion de cadera"],
  [/\bfemoral(?:es)?\b/g, "curl de piernas"],
];

/** Reescribe el nombre con los sinónimos de arriba (ya normalizado). */
function expandAliases(normalized: string): string {
  let out = normalized;
  for (const [re, to] of ALIASES) out = out.replace(re, to);
  return out.trim();
}

/**
 * Mejor candidato del catálogo, más cuántos empataron con él.
 *
 * Se expone en dos sabores porque no es lo mismo IDENTIFICAR que RENOMBRAR:
 * todas las variantes de sentadilla gastan calorías parecido y trabajan el
 * mismo grupo, así que para MET o músculo alcanza con una aproximación; para
 * reescribir el nombre que guardó el usuario, no.
 */
function findMatch(name: string): { ex: DbExercise | null; tied: number } {
  const q = norm(name);
  const direct = matchNormalized(q);
  if (direct.ex) return direct;

  // Segunda pasada con sinónimos: "pantorrillas de pie" → "elevacion de
  // talones de pie", que sí existe en el catálogo.
  //
  // Se descarta primero la consulta puramente genérica: si no, un alias podría
  // rescatar justo lo que el umbral está para frenar —"entrené femorales" es
  // una sesión de pierna, y snapearla a un ejercicio sería un dato falso—.
  const qt = q.split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t));
  if (qt.length === 0 || qt.every((t) => GENERIC.has(t))) return direct;

  const alias = expandAliases(q);
  return alias === q ? direct : matchNormalized(alias);
}

function matchNormalized(q: string): { ex: DbExercise | null; tied: number } {
  if (!q) return { ex: null, tied: 0 };

  // 1) match exacto (es/en)
  const exact = EXACT.get(q);
  if (exact) return { ex: exact, tied: 1 };

  // 2) mejor puntaje por tokens
  const qt = q.split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t));
  if (qt.length === 0) return { ex: null, tied: 0 };
  // Consulta solo de palabras genéricas (músculo/sesión) → no matchear.
  if (qt.every((t) => GENERIC.has(t))) return { ex: null, tied: 0 };

  let best: DbExercise | null = null;
  let bestScore = 0;
  let bestLenDiff = Infinity;
  let tied = 0; // cuántos candidatos comparten el mejor puntaje Y longitud

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
      tied = 1;
    } else if (score === bestScore && lenDiff === bestLenDiff) {
      tied++;
    }
  }

  return { ex: best, tied };
}

/**
 * Ejercicio canónico de un nombre libre, SOLO si es inequívoco.
 *
 * "sentadilla" saca exactamente 0.5 (el umbral) contra decenas de variantes
 * —Sentadilla con Banda, Sentadilla Búlgara, Sentadilla Frontal…— y ninguna es
 * más "correcta" que otra: el desempate por longitud las deja iguales y ganaba
 * la primera del índice, que es un orden arbitrario. Así, decir "hice
 * sentadillas" guardaba "Sentadilla con Banda" y "dominadas" guardaba
 * "Dominadas Arquero", reescribiendo el historial con ejercicios que el usuario
 * nunca hizo. Si no se puede distinguir, se respeta lo que escribió: un nombre
 * libre molesta menos que un dato falso.
 */
export function matchExercise(name: string): DbExercise | null {
  const { ex, tied } = findMatch(name);
  return tied === 1 ? ex : null;
}

/**
 * Mejor aproximación aunque haya empate. Vale para MET y grupo muscular —donde
 * cualquier variante cercana da lo mismo— y NUNCA para renombrar.
 */
export function approxExercise(name: string): DbExercise | null {
  return findMatch(name).ex;
}

/** Nombre canónico en español (o el original si no hay match). */
export function canonicalName(name: string): string {
  return matchExercise(name)?.name_es ?? name;
}

/** MET del ejercicio (aproximado: las variantes cercanas gastan parecido). */
export function metOf(name: string): number | null {
  return approxExercise(name)?.met ?? null;
}

/** Grupo muscular del ejercicio (aproximado, por el mismo motivo). */
export function groupOf(name: string): MuscleGroup | null {
  const ex = approxExercise(name);
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
  loop_band: "Banda circular",
  suspension_trainer: "TRX",
  rings: "Anillas",
  leg_curl: "Máquina de femoral",
  leg_extension: "Máquina de cuádriceps",
  leg_press: "Prensa",
  hack_squat: "Hack squat",
  lat_pulldown_machine: "Máquina de jalón",
  assisted_pullup_machine: "Máquina de dominadas asistidas",
  chest_press_machine: "Máquina de press de pecho",
  shoulder_press_machine: "Máquina de press de hombro",
  bicep_curl_machine: "Máquina de bíceps",
  preacher_curl_machine: "Banco Scott",
  hip_abduction_machine: "Máquina de abductores",
  hip_adduction_machine: "Máquina de aductores",
  standing_calf_raise_machine: "Máquina de gemelos de pie",
  seated_calf_raise_machine: "Máquina de gemelos sentado",
  glute_ham_developer: "Banco de femoral (GHD)",
  dip_machine: "Máquina de fondos",
  pec_deck: "Pec Deck",
  air_bike: "Bicicleta de aire",
  battle_rope: "Cuerda de batalla",
  climbing_rope: "Cuerda de trepar",
  jump_rope: "Soga",
  plyo_box: "Cajón pliométrico",
  slam_ball: "Balón de golpeo",
  sled: "Trineo",
  wrist_roller: "Rodillo de muñeca",
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

// ---------------------------------------------------------------------------
// Qué músculos compromete cada ejercicio
// ---------------------------------------------------------------------------

/**
 * Nombre en español de cada músculo del dataset (los 29 que aparecen).
 *
 * El grupo ("piernas") sirve para agrupar y para el calendario; el músculo
 * ("isquiotibiales") es lo que hace falta para reemplazar un ejercicio por otro
 * sin que se te escape la mitad del estímulo: prensa y curl femoral son los dos
 * "piernas" y no se sustituyen entre sí.
 */
const MUSCLE_ES: Record<string, string> = {
  pectoralis_major: "pectoral",
  serratus_anterior: "serrato",
  latissimus_dorsi: "dorsal ancho",
  trapezius: "trapecio",
  rhomboids: "romboides",
  erector_spinae: "lumbares",
  quadratus_lumborum: "cuadrado lumbar",
  quadriceps: "cuádriceps",
  hamstrings: "isquiotibiales",
  gluteus_maximus: "glúteo mayor",
  gluteus_medius: "glúteo medio",
  abductors: "abductores",
  adductors: "aductores",
  hip_flexors: "flexores de cadera",
  gastrocnemius: "gemelos",
  soleus: "sóleo",
  anterior_deltoid: "deltoides anterior",
  lateral_deltoid: "deltoides lateral",
  posterior_deltoid: "deltoides posterior",
  biceps_brachii: "bíceps",
  triceps_brachii: "tríceps",
  brachialis: "braquial",
  brachioradialis: "braquiorradial",
  forearms: "antebrazos",
  forearm_flexors: "flexores del antebrazo",
  forearm_extensors: "extensores del antebrazo",
  rectus_abdominis: "recto abdominal",
  transverse_abdominis: "transverso",
  obliques: "oblicuos",
};

/** Nombre legible de un músculo (o el código con guiones bajos como fallback). */
export function muscleLabel(code: string): string {
  return MUSCLE_ES[code] ?? code.replace(/_/g, " ");
}

/** TODOS los grupos que tocan esos músculos, sin repetir y en orden de UI. */
export function groupsOfMuscles(muscles: string[]): MuscleGroup[] {
  const found = new Set<MuscleGroup>();
  for (const m of muscles) {
    const g = MUSCLE_TO_GROUP[m];
    if (g) found.add(g);
  }
  return MUSCLE_GROUPS.map((g) => g.key).filter((k) => found.has(k));
}

export type MuscleWork = {
  /** El ejercicio del catálogo que se usó para responder (null si no matcheó). */
  match: DbExercise | null;
  /** Grupo dominante: el del primer músculo primario. */
  group: MuscleGroup | null;
  /** Grupos que trabaja de lleno. */
  groups: MuscleGroup[];
  /** Grupos que asisten (los secundarios que no son ya primarios). */
  secondaryGroups: MuscleGroup[];
  /** Músculos primarios en español ("cuádriceps", "glúteo mayor"). */
  primary: string[];
  /** Músculos secundarios en español. */
  secondary: string[];
};

const EMPTY_WORK: MuscleWork = {
  match: null,
  group: null,
  groups: [],
  secondaryGroups: [],
  primary: [],
  secondary: [],
};

/**
 * Qué compromete un ejercicio, a partir de su nombre (libre o canónico).
 *
 * Usa `approxExercise` a propósito: para saber qué músculo se trabaja, todas
 * las variantes de sentadilla dan la misma respuesta, así que un match
 * aproximado alcanza. Renombrar sí exige `matchExercise`.
 */
export function muscleWork(name: string): MuscleWork {
  const ex = approxExercise(name);
  if (!ex) return EMPTY_WORK;
  const groups = groupsOfMuscles(ex.primary_muscles);
  return {
    match: ex,
    group: groupOfMuscles(ex.primary_muscles),
    groups,
    secondaryGroups: groupsOfMuscles(ex.secondary_muscles).filter(
      (g) => !groups.includes(g),
    ),
    primary: ex.primary_muscles.map(muscleLabel),
    secondary: ex.secondary_muscles.map(muscleLabel),
  };
}

// ---------------------------------------------------------------------------
// Reemplazos
// ---------------------------------------------------------------------------

export type Alternative = {
  exercise: DbExercise;
  /** Músculos primarios que comparte con el original, en español. */
  shared: string[];
  /** Usa otro equipo: es lo que sirve cuando la máquina está ocupada. */
  otherEquipment: boolean;
};

/** Cuánto se solapan dos listas de músculos (0-1). */
function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const common = a.filter((m) => setB.has(m)).length;
  return common / Math.max(a.length, b.length);
}

/**
 * Con qué otro ejercicio reemplazar a este cuando no lo podés hacer.
 *
 * El criterio, en orden: que trabaje los MISMOS músculos primarios, que use
 * OTRO equipo (si la máquina está ocupada, otra variante de la misma máquina
 * no te sirve) y que sea del mismo tipo —compuesto o aislado—, porque cambiar
 * un press por una elevación lateral no es el mismo trabajo aunque compartan
 * el hombro.
 */
export function alternativesFor(name: string, limit = 8): Alternative[] {
  const ref = approxExercise(name);
  if (!ref) return [];
  const group = groupOfMuscles(ref.primary_muscles);
  if (!group) return [];

  return EXERCISES.filter(
    (ex) =>
      ex.id !== ref.id &&
      ex.category === ref.category &&
      groupOfMuscles(ex.primary_muscles) === group,
  )
    .map((ex) => {
      const sharedCodes = ex.primary_muscles.filter((m) =>
        ref.primary_muscles.includes(m),
      );
      const otherEquipment = ex.equipment !== ref.equipment;
      const score =
        overlap(ex.primary_muscles, ref.primary_muscles) * 3 +
        overlap(ex.secondary_muscles, ref.secondary_muscles) +
        (ex.mechanic === ref.mechanic ? 1 : 0) +
        (otherEquipment ? 0.25 : 0);
      return {
        alt: {
          exercise: ex,
          shared: sharedCodes.map(muscleLabel),
          otherEquipment,
        },
        score,
      };
    })
    // Sin un solo músculo primario en común no es un reemplazo, es otro
    // ejercicio del mismo grupo: sirve para el catálogo, no para sustituir.
    .filter((c) => c.alt.shared.length > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.alt.exercise.name_es.localeCompare(b.alt.exercise.name_es, "es"),
    )
    .slice(0, limit)
    .map((c) => c.alt);
}
