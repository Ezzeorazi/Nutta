/**
 * Estilo y escalas comunes de los gráficos de recharts.
 *
 * Estaba copiado en cuatro archivos (Entreno, Peso, Medidas e Historial), que
 * es como se termina con cuatro gráficos parecidos pero no iguales.
 */

/** Tooltip: hereda la superficie y el radio de tarjeta de la app. */
export const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  fontSize: 12,
  color: "var(--foreground)",
} as const;

/** Ejes sin línea ni ticks: la grilla ya da la referencia, el resto es ruido. */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  stroke: "var(--muted)",
} as const;

/**
 * Margen del gráfico.
 *
 * `left` va en 0 a propósito. Antes era -18 para ganar ancho, pero eso corre
 * TODO el gráfico —incluido el eje Y— hacia afuera del área visible, y como
 * las etiquetas del eje están alineadas a la derecha dentro de su ancho, los
 * primeros píxeles se recortan: "94.9" se leía "4.9", "100.75" se leía ".75" y
 * "103" se leía "03". El ancho del eje ahora se calcula según el texto real
 * (ver `yAxis`), así que no hace falta robarle espacio con un margen negativo.
 */
export const chartMargin = { top: 8, right: 8, left: 0, bottom: 0 } as const;

/**
 * Escalones "lindos" para el eje: los múltiplos que se leen sin pensar.
 * A propósito NO está el 2.5 — mete ticks como 97.5 o 102.5 en medidas
 * corporales, donde lo natural es 95 / 100 / 105.
 */
const NICE_STEPS = [1, 2, 5, 10];

/** Menor escalón "lindo" mayor o igual a `rough`. */
function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  for (const s of NICE_STEPS) {
    if (rough <= s * base * (1 + 1e-9)) return s * base;
  }
  return 10 * base;
}

/** Decimales necesarios para escribir múltiplos de `step` sin arrastre binario. */
const decimalsFor = (step: number) =>
  Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));

export type Scale = {
  domain: [number, number];
  ticks: number[];
  step: number;
  decimals: number;
};

export type ScaleOptions = {
  /** Incluye el 0 en el dominio (barras: una barra tiene que salir del piso). */
  zero?: boolean;
  /** Máximo de marcas del eje. */
  maxTicks?: number;
};

/**
 * Dominio y marcas legibles para un eje numérico.
 *
 * El dominio se ajusta a múltiplos de un escalón redondo (1, 2, 5, 10 × 10ⁿ),
 * así el eje muestra 92 · 94 · 96 en vez de 91.83 · 93.14 · 94.45. Además deja
 * aire arriba y abajo para que la línea no quede pegada al borde.
 */
export function niceScale(
  values: number[],
  opts: ScaleOptions = {},
): Scale {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) {
    return { domain: [0, 1], ticks: [0, 1], step: 1, decimals: 0 };
  }
  const maxTicks = Math.max(2, opts.maxTicks ?? 5);

  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (opts.zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }

  const span = hi - lo;
  if (span < 1e-9) {
    // Serie plana (ej. tres semanas pesando lo mismo): se abre una ventana
    // angosta, si no el eje repetiría el mismo número. Angosta a propósito:
    // para 85 kg quietos sirve ver 84-86, no 80-90.
    const pad = Math.max(Math.abs(hi) * 0.01, 0.5);
    lo -= pad;
    hi += pad;
  } else {
    const pad = span * 0.1;
    hi += pad;
    if (!opts.zero || lo < 0) lo -= pad;
  }

  let step = niceStep((hi - lo) / (maxTicks - 1));
  let min = Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  // Ajustar a múltiplos puede agregar una marca de más: se sube el escalón.
  let guard = 0;
  while ((max - min) / step > maxTicks - 1 + 1e-9 && guard++ < 8) {
    step = niceStep(step * 1.5);
    min = Math.floor(lo / step) * step;
    max = Math.ceil(hi / step) * step;
  }

  const decimals = decimalsFor(step);
  const round = (v: number) => Number(v.toFixed(decimals));
  const count = Math.round((max - min) / step);
  const ticks = Array.from({ length: count + 1 }, (_, i) => round(min + i * step));

  return {
    domain: [round(min), round(max)],
    ticks,
    step,
    decimals,
  };
}

/**
 * Props listas para `<YAxis {...axisProps} {...yAxis(valores)} />`.
 *
 * Calcula el ancho a partir de la etiqueta más larga: sin esto el eje queda
 * con un ancho fijo que no alcanza para números de tres cifras con decimales
 * y el navegador recorta el texto.
 */
export function yAxis(values: number[], opts: ScaleOptions = {}) {
  const { domain, ticks, decimals } = niceScale(values, opts);
  const nf = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const tickFormatter = (v: number) => nf.format(v);
  const longest = ticks.reduce((n, t) => Math.max(n, tickFormatter(t).length), 1);
  return {
    type: "number" as const,
    domain,
    ticks,
    tickFormatter,
    width: Math.ceil(longest * 6.8) + 12,
    interval: 0 as const,
  };
}
