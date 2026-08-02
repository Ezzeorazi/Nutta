"use client";

import { Minus, Plus } from "lucide-react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Cuánto suma o resta cada toque. En el gym, 2.5 kg = el disco más chico. */
  step?: number;
  min?: number;
  max?: number;
  /** Unidad mostrada dentro del campo (g, kg, min…). */
  suffix?: string;
  ariaLabel: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Número con − y + a los costados.
 *
 * Existe porque en el gym y en la cocina se carga con una mano, mirando otra
 * cosa: acertarle a un botón de 44px es mucho más fácil que a un campo de
 * texto, y evita abrir el teclado numérico para sumar 10 gramos. El campo sigue
 * siendo editable a mano para los saltos grandes.
 */
export default function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
  ariaLabel,
}: Props) {
  const nudge = (delta: number) => {
    const next = round((Number(value) || 0) + delta);
    if (next < min) return onChange(String(min));
    if (max != null && next > max) return onChange(String(max));
    onChange(String(next));
  };

  const atMin = (Number(value) || 0) <= min;
  const atMax = max != null && (Number(value) || 0) >= max;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => nudge(-step)}
        disabled={atMin}
        aria-label={`Restar ${step}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-foreground transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-30"
      >
        <Minus size={18} strokeWidth={2.5} aria-hidden />
      </button>

      <div className="relative flex-1">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          placeholder="0"
          className={`w-full rounded-control border border-border bg-background py-2.5 text-center text-lg font-semibold tabular-nums outline-none transition-colors placeholder:text-muted placeholder:font-normal focus:border-primary ${suffix ? "pl-3.5 pr-9" : "px-3.5"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => nudge(step)}
        disabled={atMax}
        aria-label={`Sumar ${step}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-foreground transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-30"
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
