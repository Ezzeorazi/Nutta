/**
 * Qué dice el aviso que empuja el servidor.
 *
 * La versión anterior tenía su propia lógica de cuatro ramas —entrenaste sí/no,
 * proteína sí/no— escrita antes de que existiera la capa del coach. Ahora lee
 * el mismo `AthleteState` que la pantalla: recuperación, tipo de día real,
 * balance energético y la comida concreta que cierra lo que falta.
 *
 * Sigue siendo un aviso por franja: dos al día es un recordatorio, cinco es una
 * app silenciada.
 */

import {
  DAY_KIND_EMOJI,
  isTrainingKind,
  type AthleteState,
} from "@/lib/athlete";
import type { PlanDay } from "@/lib/plan";

export type Slot = "manana" | "noche";

export type Reminder = {
  /** Identifica el aviso: dos del mismo tag se reemplazan, no se apilan. */
  tag: string;
  title: string;
  body: string;
  requireInteraction?: boolean;
};

/** Franjas horarias LOCALES en las que cada aviso tiene sentido. */
export const SLOT_HOURS: Record<Slot, [number, number]> = {
  manana: [6, 12],
  noche: [18, 23],
};

/** `true` si a esa hora local corresponde mandar el aviso de esa franja. */
export function inSlot(slot: Slot, localHour: number): boolean {
  const [from, to] = SLOT_HOURS[slot];
  return localHour >= from && localHour <= to;
}

/** El nombre del entrenamiento del día, sin la coletilla entre paréntesis. */
const shortLabel = (planDay: PlanDay) => planDay.label.replace(/\s*\(.*\)$/, "");

/** Las partes se unen con ". ", así que ninguna puede traer su propio punto. */
const noDot = (s: string) => s.replace(/\.\s*$/, "");

/**
 * Aviso de la mañana: qué toca hoy y cómo llegás. No juzga nada todavía —a las
 * 8 de la mañana no hay nada que juzgar—, orienta el día.
 */
function morning(date: string, state: AthleteState, planDay: PlanDay): Reminder {
  const rec = state.recovery.score;
  const partes: string[] = [];

  if (planDay.rest) {
    partes.push("Hoy toca descanso 🧘");
    if (planDay.cardio) partes.push(noDot(planDay.cardio));
  } else {
    partes.push(`Hoy toca ${shortLabel(planDay)} ${planDay.emoji}`);
    if (planDay.warning) partes.push(noDot(planDay.warning));
  }

  // La recuperación es lo que cambia la decisión del día: con 40% conviene
  // bajar la carga, con 85% es el día para ir a buscar un PR.
  if (rec != null) {
    partes.push(
      rec >= 80
        ? `Venís ${rec}% recuperado: buen día para ir por un PR`
        : rec < 45
          ? `Venís ${rec}% recuperado: bajá la carga o descansá`
          : `Recuperación ${rec}%`,
    );
  }

  return {
    tag: `${date}:manana`,
    title: "☀️ Tu plan de hoy",
    body: partes.join(". ") + ".",
  };
}

/**
 * Aviso de la noche: lo que todavía se puede corregir. El `headline` del coach
 * ya es "la única cosa que hay que hacer ahora", así que se usa ese y solo se
 * antepone lo que el aviso necesita para entenderse fuera de la app.
 */
function evening(
  date: string,
  state: AthleteState,
  planDay: PlanDay,
): Reminder | null {
  const { training, nutrition, meal } = state;
  const faltaProteina = Math.round(nutrition.remaining.protein);
  // Un día "ligera" (12.000 pasos) no es no haber hecho nada: solo se reclama
  // el entreno cuando de verdad no hubo ni fuerza ni cardio.
  const sinEntrenar = !planDay.rest && !isTrainingKind(training.kind);

  const partes: string[] = [];
  if (sinEntrenar) {
    partes.push(`Hoy tocaba ${shortLabel(planDay)} y todavía no lo cargaste`);
  }
  if (faltaProteina > 20) {
    partes.push(`te faltan ${faltaProteina} g de proteína`);
    // La idea concreta es lo que convierte el aviso en algo accionable.
    const idea = meal?.macro === "proteína" ? meal.plan.ideas[0] : undefined;
    if (idea) partes.push(`lo cerrás con ${idea}`);
  }

  if (partes.length === 0) {
    // Nada que reclamar: se felicita solo si de verdad cumplió, y una vez.
    const cumplio =
      (planDay.rest || isTrainingKind(training.kind)) &&
      Math.abs(nutrition.remaining.protein) <= 20;
    if (!cumplio) return null;
    return {
      tag: `${date}:noche`,
      title: "🔥 Día redondo",
      body: `${DAY_KIND_EMOJI[training.kind]} Cumpliste el plan de hoy: ${
        nutrition.consumed.protein
      } g de proteína. Seguí así 💪`,
    };
  }

  const body = capFirst(partes.join(", ")) + ".";
  return {
    tag: `${date}:noche`,
    title: "⏰ Todavía llegás",
    body,
    // De noche el teléfono está en el bolsillo: si se descarta solo, no existió.
    requireInteraction: true,
  };
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** El aviso de una franja, o `null` si no hay nada que valga interrumpir. */
export function planReminder(params: {
  slot: Slot;
  date: string;
  state: AthleteState;
  planDay: PlanDay;
}): Reminder | null {
  const { slot, date, state, planDay } = params;
  return slot === "manana"
    ? morning(date, state, planDay)
    : evening(date, state, planDay);
}
