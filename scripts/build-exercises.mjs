// Descarga el dataset de ejercicios de RepDB y genera una versión adelgazada
// en src/data/exercises.json (solo los campos que la app usa).
//
// Uso: npm run data:exercises
//
// Licencia RepDB (free): uso comercial permitido; NO redistribuir como dataset
// ni API; atribución obligatoria "Exercise data by RepDB (repdb.co)".
// El JSON generado se usa SOLO dentro de la app (no se expone crudo).

import { writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC =
  "https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/exercises.json";
// Base para resolver los paths relativos de las imágenes (images/flat/*.webp).
const IMG_BASE =
  "https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "data");
const OUT_FILE = join(OUT_DIR, "exercises.json");
// Imágenes de los ejercicios (una .webp por ejercicio), bundleadas para uso
// offline. Se sirven estáticas desde /exercises/<id>.webp.
const IMG_DIR = join(__dirname, "..", "public", "exercises");
// Solo los nombres en español (para el autocompletado del Gym, sin cargar
// el dataset entero en el bundle del cliente).
const NAMES_FILE = join(OUT_DIR, "exercise-names.json");
// Mapa nombre_normalizado → grupo muscular (para la recomendación del Gym sin
// cargar los 181KB del dataset completo en el cliente).
const GROUPS_FILE = join(OUT_DIR, "exercise-groups.json");
// Mapa grupo → ejercicios priorizados (para sugerir en la rutina del Gym).
const BYGROUP_FILE = join(OUT_DIR, "exercise-by-group.json");

// body_part del dataset → grupo de la app (más limpio que el primer músculo).
const BODYPART_TO_GROUP = {
  chest: "pecho",
  back: "espalda",
  shoulders: "hombros",
  upper_arms: "brazos",
  lower_arms: "brazos",
  upper_legs: "piernas",
  lower_legs: "piernas",
  core: "core",
  // full_body: se omite en las sugerencias por grupo.
};

// Puntaje del equipo (favorece pesos libres y máquinas comunes; penaliza
// bandas/cuerdas/pelotas/exóticos).
const EQUIP_SCORE = {
  barbell: 3,
  dumbbell: 3,
  cable: 2,
  ez_bar: 2,
  trap_bar: 2,
  kettlebell: 2,
  pull_up_bar: 2,
  smith_machine: 1.5,
  dip_station: 1.5,
  leg_press: 1.5,
  hack_squat: 1.5,
  lat_pulldown_machine: 1.5,
  leg_curl: 1.5,
  leg_extension: 1.5,
  pec_deck: 1.5,
  chest_press_machine: 1.5,
  shoulder_press_machine: 1.5,
  preacher_curl_machine: 1.5,
  bicep_curl_machine: 1.5,
  standing_calf_raise_machine: 1.5,
  seated_calf_raise_machine: 1.5,
  "": 1, // peso corporal
  flat_bench: 1,
  plates: 1,
};

// Ejercicios "icónicos" (el dataset no trae popularidad): les damos un empujón
// para que asomen en el top de cada grupo.
const STAPLE_RE =
  /(sentadilla|press de banca|press banca|peso muerto|dominad|remo|press militar|press de hombro|jal[oó]n|hip thrust|prensa|zancada|curl de b[ií]ceps|fondos|elevaciones laterales|plancha)/;

// Puntaje para ordenar por "primero los básicos/populares".
const rankExercise = (ex) => {
  let s = 0;
  if (ex.mechanic === "compound") s += 4;
  const eq = EQUIP_SCORE[ex.equipment || ""];
  s += eq === undefined ? -1 : eq; // equipo exótico penaliza
  if (ex.difficulty === "intermediate") s += 1.5;
  else if (ex.difficulty === "beginner") s += 1;
  else if (ex.difficulty === "advanced") s -= 1.5;
  else s += 1;
  if (STAPLE_RE.test(norm(ex.name_es || ""))) s += 3;
  return s;
};

// Código de músculo → grupo de la app (espejo de MUSCLE_TO_GROUP en
// src/lib/exerciseDb.ts; mantener ambos en sync).
const MUSCLE_TO_GROUP = {
  pectoralis_major: "pecho",
  serratus_anterior: "pecho",
  latissimus_dorsi: "espalda",
  trapezius: "espalda",
  rhomboids: "espalda",
  erector_spinae: "espalda",
  quadratus_lumborum: "espalda",
  quadriceps: "piernas",
  hamstrings: "piernas",
  gluteus_maximus: "piernas",
  gluteus_medius: "piernas",
  abductors: "piernas",
  adductors: "piernas",
  hip_flexors: "piernas",
  gastrocnemius: "piernas",
  soleus: "piernas",
  anterior_deltoid: "hombros",
  lateral_deltoid: "hombros",
  posterior_deltoid: "hombros",
  biceps_brachii: "brazos",
  triceps_brachii: "brazos",
  brachialis: "brazos",
  brachioradialis: "brazos",
  forearms: "brazos",
  forearm_flexors: "brazos",
  forearm_extensors: "brazos",
  rectus_abdominis: "core",
  transverse_abdominis: "core",
  obliques: "core",
};

const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const groupOfMuscles = (muscles) => {
  for (const m of muscles) {
    const g = MUSCLE_TO_GROUP[m];
    if (g) return g;
  }
  return null;
};

// Campos que conservamos de cada ejercicio. `image` se completa luego de bajar
// el binario (queda null si el ejercicio no trae imagen o si falla la descarga).
function slim(ex) {
  return {
    id: ex.id,
    name_es: ex.name_es || ex.name_en || ex.id,
    name_en: ex.name_en || "",
    category: ex.category || "",
    met: typeof ex.met === "number" ? ex.met : null,
    equipment: ex.equipment || "",
    body_part: ex.body_part || "",
    mechanic: ex.mechanic || "",
    is_bodyweight: Boolean(ex.is_bodyweight),
    primary_muscles: Array.isArray(ex.primary_muscles) ? ex.primary_muscles : [],
    secondary_muscles: Array.isArray(ex.secondary_muscles)
      ? ex.secondary_muscles
      : [],
    image: null,
  };
}

// Elige un path de imagen representativo del ejercicio: prioriza el pico del
// movimiento (peak) → imagen única (main) → posición inicial (start) → cualquiera.
// La estructura del dataset es images.<angulo>.<fase> = "images/flat/xxx.webp".
function pickImagePath(images) {
  if (!images || typeof images !== "object") return null;
  const angle = images.flat ?? Object.values(images)[0];
  if (!angle || typeof angle !== "object") return null;
  return (
    angle.peak ??
    angle.main ??
    angle.start ??
    Object.values(angle).find((v) => typeof v === "string" && v.endsWith(".webp")) ??
    null
  );
}

const fileExists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

// Descarga (idempotente) una imagen a public/exercises/<id>.webp.
// Devuelve el nombre del archivo si quedó disponible, o null si falló.
async function fetchImage(id, relPath) {
  const fileName = `${id}.webp`;
  const dest = join(IMG_DIR, fileName);
  if (await fileExists(dest)) return fileName; // ya bajada
  try {
    const res = await fetch(IMG_BASE + relPath);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    await writeFile(dest, buf);
    return fileName;
  } catch {
    return null;
  }
}

// Baja las imágenes en paralelo con un pool acotado (evita 400 fetch en serie).
async function downloadImages(rawList, slimById) {
  await mkdir(IMG_DIR, { recursive: true });
  const jobs = [];
  for (const ex of rawList) {
    const rel = pickImagePath(ex.images);
    if (rel) jobs.push({ id: ex.id, rel });
  }
  let ok = 0;
  let fail = 0;
  const POOL = 12;
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const { id, rel } = jobs[i++];
      const fileName = await fetchImage(id, rel);
      if (fileName) {
        const slim = slimById.get(id);
        if (slim) slim.image = fileName;
        ok++;
      } else {
        fail++;
      }
    }
  }
  await Promise.all(Array.from({ length: POOL }, worker));
  return { ok, fail, total: jobs.length };
}

async function main() {
  console.log(`Descargando ${SRC} ...`);
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar el dataset`);
  const data = await res.json();

  const list = Array.isArray(data.exercises) ? data.exercises : [];
  if (list.length === 0) throw new Error("El dataset vino vacío o mal formado");

  const slimmed = list.map(slim);
  const slimById = new Map(slimmed.map((e) => [e.id, e]));

  // Baja las imágenes (una por ejercicio) y completa el campo `image` de cada uno.
  console.log("Descargando imágenes de ejercicios ...");
  const img = await downloadImages(list, slimById);
  console.log(
    `OK: ${img.ok}/${img.total} imágenes en public/exercises (${img.fail} fallidas)`,
  );

  const out = {
    source: "RepDB (repdb.co)",
    attribution: "Exercise data by RepDB (repdb.co)",
    schema_version: data.schema_version ?? null,
    count: slimmed.length,
    exercises: slimmed,
  };

  const names = [...new Set(slimmed.map((e) => e.name_es))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  // { nombre_es_normalizado: grupo } — solo los que tienen grupo detectable.
  const groups = {};
  for (const e of slimmed) {
    const g = groupOfMuscles(e.primary_muscles);
    if (g) groups[norm(e.name_es)] = g;
  }

  // { grupo: [name_es, ...] } — solo ejercicios de fuerza, agrupados por
  // body_part y priorizados; hasta 8 por grupo (raw `list` trae `difficulty`).
  const byGroupRaw = {};
  for (const ex of list) {
    if (ex.category !== "strength") continue;
    const g = BODYPART_TO_GROUP[ex.body_part];
    if (!g) continue;
    (byGroupRaw[g] ??= []).push(ex);
  }
  const STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "en", "a", "y", "una", "un"]);
  // "movimiento base" = primeras 2 palabras significativas (para dar variedad).
  const stem = (name) =>
    norm(name)
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
      .slice(0, 2)
      .join(" ");

  const byGroup = {};
  for (const [g, arr] of Object.entries(byGroupRaw)) {
    const sorted = arr.sort(
      (a, b) =>
        rankExercise(b) - rankExercise(a) ||
        (a.name_es || "").localeCompare(b.name_es || "", "es"),
    );
    // dedupe por movimiento base: un solo representante por stem.
    const seen = new Set();
    const picked = [];
    for (const e of sorted) {
      const s = stem(e.name_es || e.name_en || e.id);
      if (seen.has(s)) continue;
      seen.add(s);
      picked.push(e.name_es || e.name_en || e.id);
      if (picked.length >= 8) break;
    }
    byGroup[g] = picked;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  await writeFile(NAMES_FILE, JSON.stringify(names, null, 2) + "\n", "utf8");
  await writeFile(GROUPS_FILE, JSON.stringify(groups, null, 2) + "\n", "utf8");
  await writeFile(BYGROUP_FILE, JSON.stringify(byGroup, null, 2) + "\n", "utf8");
  console.log(`OK: ${slimmed.length} ejercicios → ${OUT_FILE}`);
  console.log(`OK: ${names.length} nombres → ${NAMES_FILE}`);
  console.log(`OK: ${Object.keys(groups).length} grupos → ${GROUPS_FILE}`);
  console.log(`OK: ${Object.keys(byGroup).length} listas → ${BYGROUP_FILE}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
