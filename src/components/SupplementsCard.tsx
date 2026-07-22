"use client";

import { useState } from "react";
import { inputCls } from "@/components/Sheet";
import {
  COMMON_SUPPLEMENTS,
  type Supplement,
  type SupplementLog,
} from "@/lib/types";

export default function SupplementsCard({
  supplements,
  logs,
  today,
  onAdd,
  onRemove,
  onToggle,
}: {
  supplements: Supplement[];
  logs: SupplementLog[];
  today: string;
  onAdd: (name: string, dose?: string, time?: string) => void;
  onRemove: (id: string) => void;
  onToggle: (supId: string, date: string) => void;
}) {
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("");

  const takenToday = new Set(
    logs.filter((l) => l.date === today).map((l) => l.supId),
  );
  const doneCount = supplements.filter((s) => takenToday.has(s.id)).length;

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name, dose, time);
    setName("");
    setDose("");
    setTime("");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">💊 Suplementos</h2>
          {supplements.length > 0 && (
            <span className="text-xs text-muted tabular-nums">
              {doneCount}/{supplements.length} hoy
            </span>
          )}
        </div>
        <button
          onClick={() => setManaging((m) => !m)}
          className="text-xs font-medium text-primary active:scale-95"
        >
          {managing ? "Listo" : "Gestionar"}
        </button>
      </div>

      {/* Checklist diario */}
      {supplements.length > 0 && (
        <ul className="flex flex-col gap-2">
          {supplements.map((s) => {
            const done = takenToday.has(s.id);
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => onToggle(s.id, today)}
                  className={`flex flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                    done
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs ${
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-medium ${
                        done ? "text-primary" : ""
                      }`}
                    >
                      {s.name}
                    </span>
                    {(s.dose || s.time) && (
                      <span className="ml-2 text-xs text-muted">
                        {s.dose}
                        {s.dose && s.time ? " · " : ""}
                        {s.time ? `🕗 ${s.time}` : ""}
                      </span>
                    )}
                  </span>
                </button>
                {managing && (
                  <button
                    onClick={() => onRemove(s.id)}
                    className="shrink-0 px-1 text-muted hover:text-accent"
                    aria-label={`Eliminar ${s.name}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {supplements.length === 0 && !managing && (
        <p className="text-sm text-muted">
          Agregá tus suplementos con «Gestionar» y marcalos cada día.
        </p>
      )}

      {/* Alta */}
      {managing && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1.5">
            {COMMON_SUPPLEMENTS.filter(
              (c) => !supplements.some((s) => s.name === c),
            ).map((c) => (
              <button
                key={c}
                onClick={() => onAdd(c)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted active:scale-95 hover:border-primary"
              >
                + {c}
              </button>
            ))}
          </div>
          <input
            className={inputCls}
            placeholder="Otro suplemento"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Dosis (ej. 5 g)"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
            />
            <input
              type="time"
              className={`${inputCls} shrink-0`}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Horario (referencia visual)"
            />
            <button
              onClick={submit}
              disabled={!name.trim()}
              className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
