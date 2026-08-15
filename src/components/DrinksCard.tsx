"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Chip from "@/components/ui/Chip";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import {
  BEERS,
  BEER_SIZES,
  COCKTAILS,
  DEFAULT_BEER_SIZE,
  caloriesFor,
  sortByUsage,
  type DrinkOption,
} from "@/lib/drinks";
import type { DrinkEntry } from "@/lib/types";

/** Cuántas opciones se ven antes de pedir "ver todas". */
const PREVIEW = 8;

/**
 * Fila de botones de un catálogo, ya ordenado por consumo. Muestra las
 * primeras `PREVIEW` y esconde el resto: con 26 cervezas y 34 tragos, verlos
 * todos de una es una pared. Como el orden es por lo que más tomás, lo tuyo
 * queda arriba y casi nunca hace falta abrir.
 */
function DrinkRow({
  title,
  options,
  /** ml de cada opción (fijo en tragos, según presentación en cervezas). */
  mlOf,
  onAdd,
}: {
  title: string;
  options: DrinkOption[];
  mlOf: (opt: DrinkOption) => number;
  onAdd: (opt: DrinkOption, ml: number) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? options : options.slice(0, PREVIEW);
  const hidden = options.length - shown.length;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {shown.map((opt) => {
          const ml = mlOf(opt);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onAdd(opt, ml)}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-left transition-transform duration-(--duration-fast) active:scale-95 hover:border-primary"
            >
              <span className="text-lg leading-none">{opt.emoji}</span>
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {opt.name}
                </span>
                <span className="text-[11px] leading-tight text-muted tabular-nums">
                  {ml} ml · {caloriesFor(opt, ml)} kcal
                </span>
              </span>
            </button>
          );
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="min-h-11 rounded-xl border border-dashed border-border px-3.5 text-sm font-medium text-primary transition-transform duration-(--duration-fast) active:scale-95 hover:border-primary"
          >
            + {hidden} más
          </button>
        )}
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
  onAdd: (opt: DrinkOption, ml: number, date: string) => void;
  onRemove: (id: string) => void;
}) {
  // La presentación elegida se recuerda: quien toma caguama toma caguama, y
  // volver a elegirla en cada carga es la clase de fricción que hace que la
  // gente deje de registrar.
  const [sizeId, setSizeId] = useState(() =>
    typeof window === "undefined"
      ? DEFAULT_BEER_SIZE
      : localStorage.getItem("nutta.beerSize") ?? DEFAULT_BEER_SIZE,
  );
  const size =
    BEER_SIZES.find((s) => s.id === sizeId) ??
    BEER_SIZES.find((s) => s.id === DEFAULT_BEER_SIZE)!;

  const pickSize = (id: string) => {
    setSizeId(id);
    try {
      localStorage.setItem("nutta.beerSize", id);
    } catch {
      // sin localStorage: la preferencia no persiste, pero no rompe nada
    }
  };

  const cervezas = sortByUsage(BEERS, drinks);
  const tragos = sortByUsage(COCKTAILS, drinks);
  const kcalHoy = Math.round(todayDrinks.reduce((s, d) => s + d.calories, 0));
  const summary =
    kcalHoy > 0
      ? `${todayDrinks.length} hoy · ${kcalHoy} kcal`
      : "Cerveza, tequila, mezcal…";

  return (
    <CollapsibleCard icon="🍻" title="Tragos y chelas" summary={summary}>
      {/* Presentación: aplica a la cerveza que toques */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted">Presentación</h3>
        <div className="flex flex-wrap gap-2">
          {BEER_SIZES.map((s) => (
            <Chip
              key={s.id}
              selected={s.id === size.id}
              onClick={() => pickSize(s.id)}
            >
              {s.label}
              <span className="tabular-nums opacity-70">· {s.ml}ml</span>
            </Chip>
          ))}
        </div>
      </div>

      <DrinkRow
        title="Cervezas"
        options={cervezas}
        mlOf={() => size.ml}
        onAdd={(opt, ml) => onAdd(opt, ml, today)}
      />
      <DrinkRow
        title="Tragos"
        options={tragos}
        mlOf={(opt) => opt.ml}
        onAdd={(opt, ml) => onAdd(opt, ml, today)}
      />

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
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {d.ml} ml
                </span>
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
