"use client";

import { useState } from "react";
import Sheet, { inputCls } from "@/components/Sheet";
import {
  MEALS,
  type MealType,
  type Recipe,
  type RecipeItem,
} from "@/lib/types";

const num = (s: string) => Number(s) || 0;
const recipeKcal = (items: RecipeItem[]) =>
  Math.round(items.reduce((s, i) => s + i.calories, 0));

/** Comida sugerida según la hora. */
function mealByHour(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "desayuno";
  if (h >= 11 && h < 15) return "almuerzo";
  if (h >= 15 && h < 19) return "merienda";
  if (h >= 19) return "cena";
  return "snack";
}

const emptyItem = { name: "", qty: "100", calories: "", protein: "", carbs: "", fat: "" };

export default function RecipesSheet({
  recipes,
  onClose,
  onCreate,
  onRemove,
  onLog,
}: {
  recipes: Recipe[];
  onClose: () => void;
  onCreate: (name: string, items: RecipeItem[]) => void;
  onRemove: (id: string) => void;
  onLog: (items: RecipeItem[], meal: MealType) => void;
}) {
  const [meal, setMeal] = useState<MealType>(mealByHour());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [draft, setDraft] = useState({ ...emptyItem });

  const addIngredient = () => {
    if (!draft.name.trim()) return;
    setItems([
      ...items,
      {
        name: draft.name.trim(),
        qty: num(draft.qty),
        calories: num(draft.calories),
        protein: num(draft.protein),
        carbs: num(draft.carbs),
        fat: num(draft.fat),
      },
    ]);
    setDraft({ ...emptyItem });
  };

  const saveRecipe = () => {
    if (!name.trim() || items.length === 0) return;
    onCreate(name.trim(), items);
    setName("");
    setItems([]);
    setCreating(false);
  };

  return (
    <Sheet title="🍲 Recetas" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Comida destino */}
        <div>
          <p className="mb-1.5 text-xs text-muted">Agregar a:</p>
          <div className="flex flex-wrap gap-1.5">
            {MEALS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMeal(m.key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                  meal === m.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de recetas */}
        {recipes.length === 0 && !creating && (
          <p className="py-2 text-center text-sm text-muted">
            Creá una receta con tus combos habituales y cargala en un toque.
          </p>
        )}
        {recipes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.items.length} ingr. · {recipeKcal(r.items)} kcal
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => {
                      onLog(r.items, meal);
                      onClose();
                    }}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"
                  >
                    + Agregar
                  </button>
                  <button
                    onClick={() => onRemove(r.id)}
                    className="text-muted hover:text-accent"
                    aria-label="Eliminar receta"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Crear receta */}
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-primary active:scale-[0.99]"
          >
            + Nueva receta
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3">
            <input
              className={inputCls}
              placeholder="Nombre de la receta (ej. Tostada con palta)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {items.length > 0 && (
              <ul className="flex flex-col gap-1">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {it.name}{" "}
                      <span className="text-muted">
                        · {it.qty} g · {Math.round(it.calories)} kcal
                      </span>
                    </span>
                    <button
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                      className="text-muted hover:text-accent"
                      aria-label="Quitar ingrediente"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Alta de ingrediente */}
            <input
              className={inputCls}
              placeholder="Ingrediente"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div className="grid grid-cols-5 gap-1.5">
              <IngInput label="g" value={draft.qty} onChange={(v) => setDraft({ ...draft, qty: v })} />
              <IngInput label="kcal" value={draft.calories} onChange={(v) => setDraft({ ...draft, calories: v })} />
              <IngInput label="P" value={draft.protein} onChange={(v) => setDraft({ ...draft, protein: v })} />
              <IngInput label="C" value={draft.carbs} onChange={(v) => setDraft({ ...draft, carbs: v })} />
              <IngInput label="G" value={draft.fat} onChange={(v) => setDraft({ ...draft, fat: v })} />
            </div>
            <button
              onClick={addIngredient}
              disabled={!draft.name.trim()}
              className="rounded-lg border border-border py-1.5 text-xs text-muted active:scale-95 disabled:opacity-40"
            >
              + Agregar ingrediente
            </button>

            <button
              onClick={saveRecipe}
              disabled={!name.trim() || items.length === 0}
              className="mt-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-40"
            >
              Guardar receta
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function IngInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-muted">
      {label}
      <input
        type="number"
        inputMode="decimal"
        className="w-full rounded-lg border border-border bg-background px-1.5 py-1.5 text-center text-sm outline-none focus:border-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
