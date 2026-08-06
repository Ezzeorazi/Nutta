"use client";

import type { BodyReadout } from "@/lib/body";

const toneClasses = {
  good: "border-l-success",
  warn: "border-l-accent",
  info: "border-l-primary",
} as const;

/** Verde cuando el cambio va donde queremos; naranja cuando no. */
function deltaColor(key: string, delta: number) {
  if (key === "cintura") return delta < 0 ? "var(--success)" : "var(--accent)";
  if (key === "peso") return "var(--foreground)"; // el peso solo no es bueno ni malo
  return delta > 0 ? "var(--success)" : "var(--accent)";
}

/**
 * Lectura de la composición corporal.
 *
 * Reemplaza al "+1 kg" pelado: muestra los cambios de peso Y medidas juntos y
 * los interpreta. Subir de peso mientras baja la cintura y crecen los brazos no
 * es un retroceso, y esta tarjeta existe para decirlo.
 */
export default function RecompCard({ body }: { body: BodyReadout }) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-card border-l-4 bg-card p-4 shadow-e1 ${toneClasses[body.tone]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden>
          {body.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{body.headline}</h2>
          <p className="mt-1 text-sm text-muted">{body.detail}</p>
        </div>
      </div>

      {body.deltas.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          {body.deltas.map((d) => (
            <li key={d.key} className="rounded-control bg-sunken px-2 py-2 text-center">
              <p
                className="text-base font-bold tabular-nums"
                style={{ color: deltaColor(d.key, d.delta) }}
              >
                {d.delta > 0 ? "+" : "−"}
                {Math.abs(d.delta).toFixed(1)}
                <span className="text-[11px] font-medium text-muted"> {d.unit}</span>
              </p>
              <p className="truncate text-[11px] text-muted">
                {d.emoji} {d.label}
              </p>
            </li>
          ))}
        </ul>
      )}

      {body.basis && (
        <p className="text-[11px] text-muted">
          {body.basis}
          {body.confidence === "baja" && " Señal todavía preliminar."}
        </p>
      )}
    </section>
  );
}
