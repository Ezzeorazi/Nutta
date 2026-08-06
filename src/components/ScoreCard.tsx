"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DailyScore } from "@/lib/score";

/** Color del puntaje. */
function scoreColor(score: number) {
  if (score >= 70) return "var(--success)";
  if (score >= 50) return "var(--primary)";
  if (score >= 30) return "var(--accent)";
  return "var(--muted)";
}

/**
 * Puntaje del día.
 *
 * Antes era un anillo de 120px justo encima del anillo de calorías de 200px:
 * dos gráficos circulares apilados compitiendo por ser el foco. El anillo
 * grande es el dato principal del día, así que acá el puntaje se cuenta con el
 * número y una barra fina.
 *
 * El número nunca va solo: debajo siempre está la frase que explica qué lo
 * sube y qué lo baja, y al desplegar, cada factor dice por qué sacó lo que sacó.
 */
export default function ScoreCard({ data }: { data: DailyScore }) {
  const [open, setOpen] = useState(false);
  const { score, label, summary, parts, tips } = data;
  const color = scoreColor(score);

  return (
    <section className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-e1">
      <div className="flex items-baseline gap-3">
        <span
          className="text-3xl font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs uppercase tracking-wide text-muted">
            Score del día
          </span>
          <span className="block font-semibold" style={{ color }}>
            {label}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={
            open ? "Ocultar detalle del score" : "Ver detalle del score"
          }
          className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-foreground"
        >
          <ChevronDown
            size={18}
            aria-hidden
            className={`transition-transform duration-(--duration-base) ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>

      {/* La explicación va siempre: un número sin motivo no enseña nada. */}
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">{summary}</span>
        {tips[0] ? ` ${tips[0]}` : ""}
      </p>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {parts.map((p) => (
            <div key={p.label} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-xs">
                <span className={p.logged ? "" : "text-muted"}>
                  {p.emoji} {p.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {p.points}
                  {p.max > 0 ? ` / ${p.max}` : ""}
                </span>
              </div>
              {p.max > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{
                      width: `${Math.max(0, (p.points / p.max) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <p className="text-[11px] text-muted">{p.detail}</p>
            </div>
          ))}
          {tips.length > 1 && (
            <ul className="flex flex-col gap-1 border-t border-border pt-3">
              {tips.slice(1).map((t, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted">
                  <span className="text-accent">›</span> {t}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted">
            Reparto: entrenamiento 30 · proteína 25 · sueño 20 · agua 10 · pasos
            10 · calorías 5. Lo que no registrás no cuenta (ni suma ni resta).
          </p>
        </div>
      )}
    </section>
  );
}
