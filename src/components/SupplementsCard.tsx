"use client";

import { useState } from "react";
import { inputCls } from "@/components/Sheet";
import { dailySupplementProtein, supplementLogProtein } from "@/lib/supplements";
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
  onSetQty,
}: {
  supplements: Supplement[];
  logs: SupplementLog[];
  today: string;
  onAdd: (
    name: string,
    dose?: string,
    time?: string,
    defaultQty?: number,
    unit?: string,
    protein?: number,
  ) => void;
  onRemove: (id: string) => void;
  onToggle: (supId: string, date: string) => void;
  onSetQty: (supId: string, date: string, qty: number) => void;
}) {
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [protein, setProtein] = useState("");

  const todayLogs = logs.filter((l) => l.date === today);
  const logBySupId = new Map(todayLogs.map((l) => [l.supId, l]));
  const doneCount = supplements.filter((s) => logBySupId.has(s.id)).length;
  const proteinToday = dailySupplementProtein(supplements, logs, today);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(
      name,
      dose,
      time,
      qty ? Number(qty) : undefined,
      unit,
      protein ? Number(protein) : undefined,
    );
    setName("");
    setDose("");
    setTime("");
    setQty("");
    setUnit("");
    setProtein("");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">💊 Suplementos</h2>
          {supplements.length > 0 && (
            <span className="text-xs text-muted tabular-nums">
              {doneCount}/{supplements.length}
              {proteinToday > 0 && ` · 🥩 +${Math.round(proteinToday)} g`}
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
            const log = logBySupId.get(s.id);
            const done = !!log;
            const loggedQty = log?.qty ?? s.defaultQty;
            return (
              <li key={s.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
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
                </div>

                {/* Cantidad real tomada (ej. 2 o 3 cápsulas), solo si el suplemento la trackea */}
                {done && s.defaultQty != null && (
                  <div className="ml-8 flex items-center gap-2 text-xs text-muted">
                    <button
                      onClick={() => onSetQty(s.id, today, (loggedQty ?? s.defaultQty!) - 1)}
                      className="grid h-6 w-6 place-items-center rounded-full border border-border active:scale-90"
                      aria-label={`Restar ${s.unit || "unidad"}`}
                    >
                      −
                    </button>
                    <span className="min-w-14 text-center tabular-nums">
                      {loggedQty} {s.unit || ""}
                    </span>
                    <button
                      onClick={() => onSetQty(s.id, today, (loggedQty ?? s.defaultQty!) + 1)}
                      className="grid h-6 w-6 place-items-center rounded-full border border-border active:scale-90"
                      aria-label={`Sumar ${s.unit || "unidad"}`}
                    >
                      +
                    </button>
                    {s.protein ? (
                      <span>
                        · 🥩 {Math.round(supplementLogProtein(s, { qty: loggedQty }))} g
                      </span>
                    ) : null}
                  </div>
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
                onClick={() => setName(c)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted active:scale-95 hover:border-primary"
              >
                + {c}
              </button>
            ))}
          </div>
          <input
            className={inputCls}
            placeholder="Nombre (ej. Colágeno)"
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
          </div>
          <p className="text-xs text-muted">
            Opcional: para llevar la cantidad tomada por día (ej. cápsulas variables) y
            sumar proteína al total.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              placeholder="Cantidad (ej. 30)"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Unidad (ej. g, cápsulas)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              placeholder="Proteína que aporta esa cantidad (g)"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
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
