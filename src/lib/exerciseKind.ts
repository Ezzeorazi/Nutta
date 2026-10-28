/**
 * Cómo se mide cada ejercicio, y qué significa eso para volumen, PR y progreso.
 *
 * Todas las series se guardan igual (`reps` + `weight`), así que el tipo del
 * ejercicio es lo que dice cómo leerlas. Sin esto, 20 kg de asistencia en
 * dominadas contaban como MÁS que 27 (cuando es al revés) y una plancha de 60 s
 * entraba como 60 repeticiones de nada.
 *
 * Funciones puras: el tipo sale del catálogo, del nombre, o del override que el
 * usuario haya guardado en `customExercises`.
 */

import { canonicalName, matchExercise } from "@/lib/exerciseDb";
import type { CustomExercise, ExerciseKind, StrengthSet } from "@/lib/types";

export const KINDS: { key: ExerciseKind; label: string; hint: string }[] = [
  { key: "peso", label: "Peso", hint: "Reps × kg" },
  {
    key: "asistido",
    label: "Asistido",
    hint: "La máquina te ayuda: menos kg es más difícil",
  },
  { key: "reps", label: "Repeticiones", hint: "Peso corporal: cuenta la cantidad" },
  { key: "tiempo", label: "Tiempo", hint: "Se mide en segundos" },
];

export type KindOf = (name: string) => ExerciseKind;
/** Peso corporal en una fecha (0 = no se sabe). */
export type BodyweightOn = (date: string) => number;

const key = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Isométricos del catálogo: se sostienen, no se repiten. */
const TIME_IDS = new Set([
  "plank",
  "high-plank",
  "side-plank",
  "reverse-plank",
  "trx-plank",
  "trx-side-plank",
  "wall-sit",
  "dead-hang",
  "ring-dead-hang",
  "bird-dog-hold",
  "chin-tuck-hold",
]);
const TIME_RE =
  /plancha|isom[eé]tric|sostenid|sentadilla en pared|wall sit|colgado pasivo|cuelgue est|l-sit|front lever/i;
/**
 * Equipamiento que no lleva carga: el catálogo no marca como "peso corporal"
 * a una dominada en barra o un remo en TRX, pero se cuentan por cantidad igual.
 */
const NO_LOAD_EQUIPMENT = new Set([
  "pull_up_bar",
  "rings",
  "suspension_trainer",
  "dip_station",
  "ab_wheel",
  "stability_ball",
]);
const ASSIST_RE = /asistid/i;
const REPS_RE = /flexiones|abdominales|crunch(?! con)|burpee|dominadas?$/i;
/** Sin carga aunque el catálogo los empareje con una variante con barra. */
const ALWAYS_REPS_RE = /remo invertido|flexiones de brazos/i;

/** El tipo que corresponde por catálogo y nombre, sin overrides del usuario. */
export function defaultKind(name: string): ExerciseKind {
  if (ASSIST_RE.test(name)) return "asistido";
  if (ALWAYS_REPS_RE.test(name)) return "reps";
  const ex = matchExercise(name);
  if (TIME_RE.test(name) || (ex && TIME_IDS.has(ex.id))) return "tiempo";
  if (ex) return ex.is_bodyweight || NO_LOAD_EQUIPMENT.has(ex.equipment) ? "reps" : "peso";
  return REPS_RE.test(name.trim()) ? "reps" : "peso";
}

/**
 * El ejercicio propio que corresponde a un nombre: por nombre exacto o por el
 * canónico ("Abductor" encuentra el override de "Abducción de Cadera…").
 */
export function customFinder(custom: CustomExercise[]) {
  const byKey = new Map(custom.map((c) => [key(c.name), c]));
  return (name: string): CustomExercise | undefined =>
    byKey.get(key(name)) ?? byKey.get(key(canonicalName(name)));
}

/** Resolutor de tipo con los overrides del usuario encima. Cachea por nombre. */
export function kindResolver(custom: CustomExercise[]): KindOf {
  const find = customFinder(custom);
  const cache = new Map<string, ExerciseKind>();
  return (name) => {
    let k = cache.get(name);
    if (k === undefined) {
      k = find(name)?.kind ?? defaultKind(name);
      cache.set(name, k);
    }
    return k;
  };
}

/** La foto de un ejercicio: la elegida por el usuario o la del catálogo. */
export function imageResolver(custom: CustomExercise[]) {
  const find = customFinder(custom);
  return (name: string): string | null => {
    const c = find(name);
    if (c) return c.image || null;
    return matchExercise(name)?.image ?? null;
  };
}

/** Asistencia que queda al bajar un escalón (lo mismo que `nextWeight`, al revés). */
export const lessAssist = (w: number) =>
  Math.max(0, w < 15 ? w - 1 : w - 2.5);

/** "45 s", "1:30 min". */
export function fmtSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")} min` : `${m} min`;
}

/**
 * Carga real de una serie en kg: lo que movió el cuerpo. En asistidas es tu
 * peso menos la ayuda (94 kg con 20 de asistencia = 74 kg); en las de tiempo
 * no hay kg que mover.
 */
export function setLoad(
  s: Pick<StrengthSet, "weight">,
  kind: ExerciseKind,
  bw: number,
): number {
  if (kind === "asistido") return bw > 0 ? Math.max(0, bw - s.weight) : 0;
  if (kind === "tiempo") return 0;
  return s.weight;
}

/**
 * Las series con `weight` = carga real, para todo lo que suma volumen o busca
 * PR por peso (`lib/athlete.ts`). Así esa capa no necesita saber de tipos: una
 * asistida con menos ayuda sale como más peso, que es lo que es.
 */
export function loadSets<T extends StrengthSet>(
  sets: T[],
  kindOf: KindOf,
  bwOn: BodyweightOn,
): T[] {
  return sets.map((s) => {
    const kind = kindOf(s.exercise);
    if (kind === "peso" || kind === "reps") return s;
    return { ...s, weight: setLoad(s, kind, bwOn(s.date)) };
  });
}

/** Volumen de una serie en kg (reps × carga real). */
export const loadVolume = (
  s: Pick<StrengthSet, "reps" | "weight">,
  kind: ExerciseKind,
  bw: number,
) => (kind === "tiempo" ? 0 : s.reps * setLoad(s, kind, bw));

/**
 * Qué tan buena fue una serie, en un número donde más es mejor. Es lo que
 * define el PR y la línea de progreso de cada tipo.
 */
export function setScore(
  s: Pick<StrengthSet, "reps" | "weight">,
  kind: ExerciseKind,
  bw: number,
): number {
  switch (kind) {
    case "peso":
      return s.weight;
    case "asistido":
      // Con peso corporal: kg netos. Sin él, igual tiene que ganar la menor
      // ayuda, así que va en negativo.
      return bw > 0 ? bw - s.weight : -s.weight;
    case "reps":
    case "tiempo":
      return s.reps;
  }
}

/** Un puntaje de `setScore`, para mostrar. */
export function fmtScore(v: number, kind: ExerciseKind, hasBw: boolean): string {
  switch (kind) {
    case "peso":
      return `${v} kg`;
    case "asistido":
      return hasBw ? `${round1(v)} kg netos` : `asist. ${-v} kg`;
    case "reps":
      return `${v} reps`;
    case "tiempo":
      return fmtSeconds(v);
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Una serie, para mostrar: "8 × 60 kg", "8 × asist. 20 kg", "15 reps", "45 s". */
export function fmtSet(
  s: Pick<StrengthSet, "reps" | "weight">,
  kind: ExerciseKind,
): string {
  switch (kind) {
    case "peso":
      return `${s.reps} × ${s.weight} kg`;
    case "asistido":
      return `${s.reps} × asist. ${s.weight} kg`;
    case "reps":
      return s.weight > 0 ? `${s.reps} reps + ${s.weight} kg` : `${s.reps} reps`;
    case "tiempo":
      return fmtSeconds(s.reps);
  }
}

/** El esquema que se propone al sumar un ejercicio a la rutina. */
export const defaultScheme = (kind: ExerciseKind) =>
  kind === "tiempo" ? "3 × 30-45 s" : kind === "reps" ? "3 × 10-15" : "3 × 8-12";
