"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Card retraída: título + resumen SIEMPRE visibles, el detalle completo se
 * abre con un toque. Mismo lenguaje que `EstadoCard`/`ScoreCard` (que ya
 * usaban este patrón para un sub-bloque propio), acá como envoltorio
 * reutilizable para pantallas como Progreso e Historial, que antes apilaban
 * varias cards siempre abiertas de punta a punta.
 */
export default function CollapsibleCard({
  icon,
  title,
  summary,
  defaultOpen = false,
  actions,
  children,
}: {
  icon?: string;
  title: string;
  /** Lo mínimo para no tener que abrir la card (ej. "95,1 kg · meta 92 kg"). */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  /** Acción rápida en el header (ej. "+ Nueva meta"): no togglea, siempre visible. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-card bg-card shadow-e1">
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]"
        >
          {icon && (
            <span className="text-lg leading-none" aria-hidden>
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>
            {summary && (
              <span className="block truncate text-sm text-muted">
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 text-muted transition-transform duration-(--duration-base) ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {actions}
      </div>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {children}
        </div>
      )}
    </section>
  );
}
