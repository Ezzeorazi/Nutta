/**
 * Modo vacaciones: el tramo de días en que la app deja de exigir el plan.
 *
 * No es un interruptor de "apagar Nutta". Es un modo FLEXIBLE, con fechas, en
 * el que se sostiene lo poco que de verdad importa fuera de casa —proteína
 * suficiente para no perder músculo y moverse un rato— y se suelta todo lo
 * demás: el déficit, el split del gimnasio, los retos de la noche y la racha.
 *
 * Existe porque la alternativa real no es "cumplir el plan de viaje": es dejar
 * de registrar una semana y volver con un agujero en los datos y la sensación
 * de haber fallado. Un tramo declarado como vacaciones se lee distinto —los
 * días sin gimnasio son descanso, no olvidos— y eso mantiene el historial
 * limpio y la racha viva.
 *
 * Todo acá es puro: se usa igual en el cliente y en el cron de los avisos.
 */

import { WEEKLY_PLAN, type PlanDay } from "@/lib/plan";
import {
  dayLabel,
  shiftISO,
  type Goals,
  type PlanPick,
  type Vacation,
} from "@/lib/types";

/** Duración por defecto al abrir el modo (días, incluyendo hoy). */
export const DEFAULT_VACATION_DAYS = 7;

/** Opciones de duración del alta rápida. */
export const VACATION_PRESETS = [3, 5, 7, 10, 14];

/** `true` si esa fecha cae dentro del tramo (extremos incluidos). */
export function coversDate(v: Vacation, date: string): boolean {
  return date >= v.start && date <= v.end;
}

/** El tramo de vacaciones que cubre esa fecha, o `null`. */
export function vacationOn(
  vacations: Vacation[],
  date: string,
): Vacation | null {
  return vacations.find((v) => coversDate(v, date)) ?? null;
}

/** Días (YYYY-MM-DD) cubiertos por algún tramo. Se usa como set de descanso. */
export function vacationDays(vacations: Vacation[]): Set<string> {
  const days = new Set<string>();
  for (const v of vacations) {
    // Tope de seguridad: un tramo mal cargado (o de un año entero) no puede
    // hacer explotar el set que después se recorre día por día.
    for (let d = v.start, i = 0; d <= v.end && i < 400; d = shiftISO(d, 1), i++) {
      days.add(d);
    }
  }
  return days;
}

/** Cuántos días dura el tramo (extremos incluidos). */
export function vacationLength(v: Vacation): number {
  const from = new Date(`${v.start}T00:00:00`).getTime();
  const to = new Date(`${v.end}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000) + 1;
}

/** "Día 3 de 7" para una fecha dentro del tramo. */
export function vacationProgress(
  v: Vacation,
  date: string,
): { day: number; total: number } {
  const from = new Date(`${v.start}T00:00:00`).getTime();
  const on = new Date(`${date}T00:00:00`).getTime();
  const total = vacationLength(v);
  const day = Math.min(total, Math.max(1, Math.round((on - from) / 86_400_000) + 1));
  return { day, total };
}

/** "hasta el mar, 12 ago" — el rango en una línea, para las tarjetas. */
export function vacationRangeLabel(v: Vacation): string {
  return `${dayLabel(v.start)} → ${dayLabel(v.end)}`;
}

/**
 * Las metas del modo flexible, derivadas de las de siempre.
 *
 * Tres decisiones, y las tres son sobre qué se puede sostener comiendo afuera:
 *
 * - **Calorías: se sale del déficit.** +15% deja el día cerca del
 *   mantenimiento. Pedir un déficit en un viaje es pedir que se abandone el
 *   registro el segundo día; sin déficit, el peor caso de la semana es no
 *   moverse en la balanza, que es exactamente el objetivo.
 * - **Proteína: piso, no meta.** 75% de la habitual sigue siendo suficiente
 *   para proteger el músculo y es alcanzable sin cocinar. La proteína es lo
 *   único que no se suelta: es lo que se pierde si se suelta.
 * - **Carbos y grasas: lo que sobra**, repartido en la misma proporción que ya
 *   tenían. No hay nada que optimizar ahí durante una semana.
 */
export function vacationGoals(base: Goals): Goals {
  const calories = Math.round((base.calories * 1.15) / 50) * 50;
  const protein = Math.round((base.protein * 0.75) / 5) * 5;

  // Lo que queda después de la proteína se reparte manteniendo la relación
  // carbos:grasas del plan, en kcal (no en gramos: 1 g de grasa no es 1 g de
  // carbo).
  const rest = Math.max(0, calories - protein * 4);
  const baseCarbKcal = base.carbs * 4;
  const baseFatKcal = base.fat * 9;
  const share =
    baseCarbKcal + baseFatKcal > 0
      ? baseCarbKcal / (baseCarbKcal + baseFatKcal)
      : 0.6;

  return {
    calories,
    protein,
    carbs: Math.round((rest * share) / 4 / 5) * 5,
    fat: Math.round((rest * (1 - share)) / 9 / 5) * 5,
  };
}

/**
 * La rutina de vacaciones: una sola sesión de cuerpo entero, sin equipamiento,
 * que se puede hacer en la habitación en 20 minutos.
 *
 * Es la MISMA todos los días a propósito. El split de seis días existe para
 * acumular volumen semana a semana; en una semana de viaje no hay volumen que
 * acumular, hay músculo que mantener, y para eso alcanza con estimularlo cada
 * tanto. Elegir qué toca hoy sería una decisión más en un día que justamente
 * no debería tener decisiones de gimnasio.
 */
export const VACATION_DAY: PlanDay = {
  dow: -1,
  label: "Modo vacaciones",
  emoji: "🏖️",
  exercises: [
    { name: "Push-Up", sets: "3 × 10-15", weight: "peso corporal" },
    { name: "Sentadilla con Peso Corporal", sets: "3 × 15-20", weight: "peso corporal" },
    { name: "Zancada", sets: "3 × 10 por pierna", weight: "peso corporal" },
    { name: "Puente de Glúteos", sets: "3 × 15", weight: "peso corporal" },
    { name: "Remo invertido", sets: "3 × 8-12", weight: "una mesa firme" },
    { name: "Plancha", sets: "3 × 30-45 s", weight: "peso corporal" },
  ],
  cardio: "Caminá todo lo que puedas: turistear cuenta. Con 8-10 mil pasos ya está.",
};

/** `dow` de la rutina de vacaciones: no es ningún día de la semana. */
export const VACATION_DOW = -1;

/**
 * Los días entre los que se puede elegir estando de viaje: la rutina corta
 * primero (es el default) y después los días de gimnasio del plan.
 *
 * El día de descanso del plan queda afuera: de vacaciones, un día sin elegir
 * nada YA es descanso, así que ofrecerlo sería ofrecer lo que ya está puesto.
 */
export const VACATION_OPTIONS: PlanDay[] = [
  VACATION_DAY,
  ...WEEKLY_PLAN.filter((d) => !d.rest).sort((a, b) => a.dow - b.dow),
];

/** El `dow` elegido a mano para esa fecha, o `null` si no elegiste nada. */
export function pickedDow(picks: PlanPick[], date: string): number | null {
  const pick = picks.find((p) => p.date === date);
  return pick ? pick.dow : null;
}

/**
 * El día que toca.
 *
 * Fuera de vacaciones manda el calendario del plan, sin más. De viaje, la
 * rutina corta es el default y tu elección la pisa: no estás siguiendo el
 * split, así que qué entrenar hoy es una decisión tuya y no del almanaque.
 */
export function planDayFor(
  date: string,
  vacations: Vacation[],
  fallback: (iso: string) => PlanDay,
  picks: PlanPick[] = [],
): PlanDay {
  if (!vacationOn(vacations, date)) return fallback(date);
  const dow = pickedDow(picks, date);
  if (dow == null || dow === VACATION_DOW) return VACATION_DAY;
  return WEEKLY_PLAN.find((d) => d.dow === dow) ?? VACATION_DAY;
}

/** Lo que dice la app cuando el día cae en vacaciones. */
export function vacationHeadline(
  v: Vacation,
  date: string,
  proteinLeft: number,
): string {
  const { day, total } = vacationProgress(v, date);
  const falta =
    proteinLeft > 25
      ? ` Te faltan ${Math.round(proteinLeft)} g de proteína: es lo único que conviene no soltar.`
      : " La proteína ya está: disfrutá.";
  return `Vacaciones, día ${day} de ${total} 🏖️ Movete un rato y comé sin cuentas.${falta}`;
}
