/**
 * Un solo aviso por día, el que más importa a esa hora: no queremos una app
 * que manda cinco notificaciones y termina silenciada.
 */

import type { AthleteState } from "@/lib/athlete";
import type { PlanDay } from "@/lib/plan";

export type Reminder = { key: string; title: string; body: string };

/** A partir de qué hora local tiene sentido avisar (no de mañana). */
const REMIND_FROM_HOUR = 19;

export function eveningReminder(params: {
  date: string;
  hour: number;
  state: AthleteState;
  planDay: PlanDay;
}): Reminder | null {
  const { date, hour, state, planDay } = params;
  if (hour < REMIND_FROM_HOUR) return null;

  const missingWorkout = !planDay.rest && !state.training.trained;
  const missingProtein = state.nutrition.remaining.protein > 25;

  if (missingWorkout && missingProtein) {
    return {
      key: `${date}:both`,
      title: "⏰ Nutta",
      body: `Hoy tocaba ${planDay.label} y te faltan ${Math.round(
        state.nutrition.remaining.protein,
      )} g de proteína. Todavía llegás.`,
    };
  }
  if (missingWorkout) {
    return {
      key: `${date}:workout`,
      title: "🏋️ Nutta",
      body: `Hoy tocaba ${planDay.label}${planDay.warning ? " — " + planDay.warning.replace(/\.$/, "") : ""}. ¿Lo cargás?`,
    };
  }
  if (missingProtein) {
    return {
      key: `${date}:protein`,
      title: "🥩 Nutta",
      body: `Te faltan ${Math.round(state.nutrition.remaining.protein)} g de proteína para llegar a tu meta de hoy.`,
    };
  }
  if (
    (planDay.rest || state.training.trained) &&
    Math.abs(state.nutrition.remaining.protein) <= 15
  ) {
    return {
      key: `${date}:done`,
      title: "🔥 Nutta",
      body: "Día redondo: cumpliste el plan de hoy. Seguí así 💪",
    };
  }
  return null;
}
