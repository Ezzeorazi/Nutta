"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/Field";
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
    <Sheet
      title="Recetas"
      description="Tus combos habituales, cargados de un toque."
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        {/* Comida destino */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">Agregar a</p>
          <div className="flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <Chip
                key={m.key}
                selected={meal === m.key}
                onClick={() => setMeal(m.key)}
              >
                {m.label}
              </Chip>
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
                className="flex items-center justify-between gap-2 rounded-control bg-sunken px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.items.length} ingr. · {recipeKcal(r.items)} kcal
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      onLog(r.items, meal);
                      onClose();
                    }}
                  >
                    Agregar
                  </Button>
                  <button
                    type="button"
                    onClick={() => onRemove(r.id)}
                    className="-mr-1.5 grid h-9 w-9 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                    aria-label={`Eliminar receta: ${r.name}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Crear receta */}
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-11 rounded-control border border-dashed border-border text-sm font-semibold text-primary transition-transform duration-(--duration-fast) active:scale-[0.99] hover:border-primary"
          >
            + Nueva receta
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-card bg-sunken p-3.5">
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
                      type="button"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                      className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                      aria-label={`Quitar ingrediente: ${it.name}`}
                    >
                      <Trash2 size={15} aria-hidden />
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
            <Button
              variant="secondary"
              full
              onClick={addIngredient}
              disabled={!draft.name.trim()}
            >
              + Agregar ingrediente
            </Button>

            <Button
              size="lg"
              full
              onClick={saveRecipe}
              disabled={!name.trim() || items.length === 0}
            >
              Guardar receta
            </Button>
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
