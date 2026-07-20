"use client";

import { useState } from "react";
import type { DailyScore } from "@/lib/score";

/** Color del anillo según el puntaje. */
function scoreColor(score: number) {
  if (score >= 70) return "var(--success)";
  if (score >= 50) return "var(--primary)";
  if (score >= 30) return "var(--accent)";
  return "var(--muted)";
}

export default function ScoreCard({ data }: { data: DailyScore }) {
  const [open, setOpen] = useState(false);
  const { score, label, parts, tips } = data;

  const size = 120;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = scoreColor(score);

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-5">
        <div className="relative grid shrink-0 place-items-center">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <span className="absolute text-3xl font-bold tabular-nums">
            {score}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted">
            Score de hoy
          </p>
          <p className="text-xl font-bold" style={{ color }}>
            {label}
          </p>
          {tips[0] && (
            <p className="mt-1 text-sm text-muted">{tips[0]}</p>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2 text-xs font-medium text-primary active:scale-95"
            aria-expanded={open}
          >
            {open ? "Ocultar detalle" : "Ver detalle"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          {parts.map((p) => (
            <div key={p.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span>{p.label}</span>
                <span className="tabular-nums text-muted">
                  {p.points}
                  {p.max > 0 ? ` / ${p.max}` : ""}
                </span>
              </div>
              {p.max > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{
                      width: `${Math.max(0, (p.points / p.max) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
          {tips.length > 1 && (
            <ul className="mt-1 flex flex-col gap-1">
              {tips.slice(1).map((t, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted">
                  <span className="text-accent">›</span> {t}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-muted">
            Sueño y agua sumarán al score cuando los registres.
          </p>
        </div>
      )}
    </section>
  );
}
