/**
 * Estilo común de los gráficos de recharts.
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

/** Margen que alinea el gráfico con el borde de la tarjeta. */
export const chartMargin = { top: 8, right: 8, left: -18, bottom: 0 } as const;
