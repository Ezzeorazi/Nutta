import type { WeightEntry } from "@/lib/types";

export type WeightPoint = { date: string; kg: number; t: number };

const dayOf = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00`) / 86400000);

/** Puntos ordenados (uno por día ya garantizado por el upsert). */
export function weightPoints(weights: WeightEntry[]): WeightPoint[] {
  const first = weights.length ? dayOf(weights[0].date) : 0;
  return weights.map((w) => ({
    date: w.date,
    kg: w.kg,
    t: dayOf(w.date) - first, // días desde el primer registro
  }));
}

export type WeightTrend = {
  current: number;
  first: number;
  deltaTotal: number; // kg desde el primer registro
  slopePerWeek: number; // kg por semana (regresión)
  toTarget: number | null; // kg que faltan (con signo) hacia la meta
  etaText: string | null; // "~6 semanas" o mensaje
};

/** Regresión lineal (mínimos cuadrados) sobre kg vs. días. */
function slopePerDay(points: WeightPoint[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.t, 0) / n;
  const my = points.reduce((s, p) => s + p.kg, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.kg - my);
    den += (p.t - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function weightTrend(
  points: WeightPoint[],
  target?: number,
): WeightTrend | null {
  if (points.length === 0) return null;
  const current = points[points.length - 1].kg;
  const first = points[0].kg;
  const perDay = slopePerDay(points);
  const slopePerWeek = perDay * 7;

  let toTarget: number | null = null;
  let etaText: string | null = null;
  if (typeof target === "number" && target > 0) {
    toTarget = target - current;
    if (Math.abs(toTarget) < 0.1) {
      etaText = "¡Estás en tu meta! 🎯";
    } else if (points.length < 2 || Math.abs(perDay) < 0.001) {
      etaText = "Registrá unos días más para estimar cuándo llegás.";
    } else {
      const days = toTarget / perDay; // perDay y toTarget deben ir en el mismo sentido
      if (days > 0 && days < 3650) {
        const weeks = Math.round(days / 7);
        etaText =
          weeks <= 1
            ? "A este ritmo llegás esta semana."
            : `A este ritmo llegás en ~${weeks} semanas.`;
      } else {
        etaText = "A este ritmo te estás alejando de tu meta.";
      }
    }
  }

  return {
    current,
    first,
    deltaTotal: current - first,
    slopePerWeek,
    toTarget,
    etaText,
  };
}
