"use client";

import { Trash2 } from "lucide-react";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import { DRINKS, sortByUsage, type DrinkOption } from "@/lib/drinks";
import type { DrinkEntry } from "@/lib/types";

/** Fila de botones de un catálogo (cervezas o tragos), ya ordenado por consumo. */
function DrinkRow({
  title,
  options,
  onAdd,
}: {
  title: string;
  options: DrinkOption[];
  onAdd: (opt: DrinkOption) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onAdd(opt)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-left transition-transform duration-(--duration-fast) active:scale-95 hover:border-primary"
          >
            <span className="text-lg leading-none">{opt.emoji}</span>
            <span className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{opt.name}</span>
              <span className="text-[11px] leading-tight text-muted tabular-nums">
                {opt.ml} ml · {opt.calories} kcal
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DrinksCard({
  drinks,
  todayDrinks,
  today,
  onAdd,
  onRemove,
}: {
  /** Historial completo (para el ranking por consumo). */
  drinks: DrinkEntry[];
  /** Tragos del día que se está viendo. */
  todayDrinks: DrinkEntry[];
  today: string;
  onAdd: (opt: DrinkOption, date: string) => void;
  onRemove: (id: string) => void;
}) {
  const cervezas = sortByUsage(
    DRINKS.filter((d) => d.category === "cerveza"),
    drinks,
  );
  const tragos = sortByUsage(
    DRINKS.filter((d) => d.category === "trago"),
    drinks,
  );
  const kcalHoy = Math.round(todayDrinks.reduce((s, d) => s + d.calories, 0));
  const summary =
    kcalHoy > 0
      ? `${todayDrinks.length} hoy · ${kcalHoy} kcal`
      : "Cerveza, tequila, mezcal…";

  return (
    <CollapsibleCard icon="🍻" title="Tragos y chelas" summary={summary}>
      <DrinkRow title="Cervezas" options={cervezas} onAdd={(opt) => onAdd(opt, today)} />
      <DrinkRow title="Tragos" options={tragos} onAdd={(opt) => onAdd(opt, today)} />

      {todayDrinks.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
          {todayDrinks.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-base leading-none">{d.emoji}</span>
                <span className="truncate">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                <span className="tabular-nums">{Math.round(d.calories)} kcal</span>
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                  aria-label={`Eliminar ${d.name}`}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleCard>
  );
}
