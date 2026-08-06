"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { rate, type AthleteState } from "@/lib/athlete";

/** Color de un 0-1. Es el mismo semáforo que usa el score, a propósito. */
function ratioColor(ratio: number, logged = true) {
  if (!logged) return "var(--muted)";
  if (ratio >= 0.85) return "var(--success)";
  if (ratio >= 0.65) return "var(--primary)";
  if (ratio >= 0.4) return "var(--accent)";
  return "var(--muted)";
}

const toneClasses = {
  good: "border-l-success",
  warn: "border-l-accent",
  info: "border-l-primary",
} as const;

/**
 * Panel "Estado actual": cómo venís hoy, en una sola mirada.
 *
 * Es la pieza que convierte a Nutta en entrenador en vez de contador. Arriba,
 * la recuperación y las cinco señales del día; en el medio, LA cosa que hay que
 * hacer ahora; abajo, la lectura del entrenamiento cruzada con lo que comiste y
 * —si falta proteína o carbos— comida concreta para cerrarlo.
 */
export default function EstadoCard({ state }: { state: AthleteState }) {
  const [open, setOpen] = useState(false);
  const { recovery, status, headline, coach, ideas, nutrition } = state;
  const recColor = ratioColor((recovery.score ?? 0) / 100, recovery.score != null);

  const faltaProteina = Math.round(nutrition.remaining.protein);
  const faltaCarbos = Math.round(nutrition.remaining.carbs);
  const ideasTitle =
    faltaProteina >= 15
      ? `Te faltan ${faltaProteina} g de proteína. Lo cerrás con:`
      : `Te faltan ${faltaCarbos} g de carbohidratos. Lo cerrás con:`;

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-4 shadow-e1">
      {/* Recuperación */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <span
            className="text-3xl font-bold leading-none tabular-nums"
            style={{ color: recColor }}
          >
            {recovery.score != null ? `${recovery.score}%` : "—"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs uppercase tracking-wide text-muted">
              Recuperación
            </span>
            <span className="block font-semibold" style={{ color: recColor }}>
              {recovery.label}
            </span>
          </span>
          {recovery.factors.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={
                open
                  ? "Ocultar detalle de la recuperación"
                  : "Ver detalle de la recuperación"
              }
              className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-foreground"
            >
              <ChevronDown
                size={18}
                aria-hidden
                className={`transition-transform duration-(--duration-base) ${open ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${recovery.score ?? 0}%`,
              backgroundColor: recColor,
            }}
          />
        </div>
        {open && (
          <ul className="flex flex-col gap-1 pt-1">
            {recovery.factors.map((f) => (
              <li
                key={f.label}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="text-muted">{f.label}</span>
                <span className="min-w-0 flex-1 truncate text-right text-muted">
                  {f.note}
                </span>
                <span
                  className="w-16 shrink-0 text-right font-semibold tabular-nums"
                  style={{ color: ratioColor(f.ratio) }}
                >
                  {rate(f.ratio)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Las cinco señales del día */}
      <ul className="flex flex-col gap-2 border-t border-border pt-3">
        {status.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span className="w-5 shrink-0 text-center leading-none" aria-hidden>
              {s.emoji}
            </span>
            <span className="w-28 shrink-0 truncate">{s.label}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-sunken">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(s.logged ? s.ratio : 0) * 100}%`,
                  backgroundColor: ratioColor(s.ratio, s.logged),
                }}
              />
            </span>
            <span
              className="w-20 shrink-0 truncate text-right text-xs tabular-nums"
              style={{ color: ratioColor(s.ratio, s.logged) }}
              title={s.value}
            >
              {s.logged ? rate(s.ratio) : "—"}
            </span>
          </li>
        ))}
      </ul>

      {/* La recomendación principal: una sola, la que más mueve la aguja */}
      <p className="rounded-control bg-sunken px-3.5 py-3 text-sm font-medium">
        {headline}
      </p>

      {/* Lectura del entrenamiento y su cruce con la nutrición */}
      {coach.length > 0 && (
        <ul className="flex flex-col gap-2">
          {coach.map((c, i) => (
            <li
              key={i}
              className={`flex items-start gap-2.5 border-l-4 pl-2.5 text-sm ${toneClasses[c.tone]}`}
            >
              <span className="leading-snug" aria-hidden>
                {c.emoji}
              </span>
              <span className="min-w-0">{c.text}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Comida concreta para cerrar lo que falta */}
      {ideas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted">{ideasTitle}</p>
          <ul className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <li
                key={idea}
                className="rounded-full bg-sunken px-3 py-1.5 text-xs font-medium"
              >
                {idea}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
