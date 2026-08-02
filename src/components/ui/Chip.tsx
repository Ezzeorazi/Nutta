"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /** Tono del estado seleccionado: verde para nutrición, naranja para ejercicio. */
  tone?: "primary" | "accent";
};

/**
 * Píldora para elegir rápido: cantidades típicas, favoritos, recientes, filtros.
 *
 * El estado elegido se marca con fondo Y con peso tipográfico, no solo con
 * color: quien no distingue el verde del gris igual ve cuál está activo.
 */
export default function Chip({
  selected = false,
  tone = "primary",
  className = "",
  type = "button",
  ...rest
}: Props) {
  const on =
    tone === "accent"
      ? "border-accent bg-accent/10 font-semibold text-accent"
      : "border-primary bg-primary/10 font-semibold text-primary";

  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-transform duration-(--duration-fast) active:scale-95 ${
        selected ? on : "border-border text-muted hover:border-primary"
      } ${className}`}
      {...rest}
    />
  );
}
