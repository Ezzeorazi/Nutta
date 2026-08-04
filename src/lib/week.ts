/**
 * Utilidades de agrupación semanal (semana que arranca el lunes, en local).
 *
 * El progreso de peso, medidas y fotos se mira "por semana": suaviza el ruido
 * día a día y hace más legible la evolución a lo largo del tiempo.
 */

/** Lunes (YYYY-MM-DD, local) de la semana a la que pertenece una fecha. */
export function weekStartISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes … 6 = domingo
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Cantidad de semanas entre dos lunes (`b - a`, redondeado). */
export function weeksBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00`).getTime();
  const b = new Date(`${bISO}T00:00:00`).getTime();
  return Math.round((b - a) / (7 * 24 * 3600 * 1000));
}

export type WeeklyPoint = { weekStart: string; value: number; count: number };

/**
 * Promedia una serie de registros por semana. Devuelve un punto por semana
 * (lunes), ordenado cronológicamente, con el valor redondeado a 0.1.
 */
export function weeklyAverages<T>(
  items: T[],
  getDate: (t: T) => string,
  getValue: (t: T) => number,
): WeeklyPoint[] {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const it of items) {
    const w = weekStartISO(getDate(it));
    const b = buckets.get(w) ?? { sum: 0, n: 0 };
    b.sum += getValue(it);
    b.n += 1;
    buckets.set(w, b);
  }
  return [...buckets.entries()]
    .map(([weekStart, { sum, n }]) => ({
      weekStart,
      value: Math.round((sum / n) * 10) / 10,
      count: n,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Índice 1-based de la semana de `iso` relativo a la primera semana `firstISO`
 * (para etiquetar "Sem. N" en las fotos de progreso).
 */
export function weekIndexFrom(firstISO: string, iso: string): number {
  return weeksBetween(weekStartISO(firstISO), weekStartISO(iso)) + 1;
}
