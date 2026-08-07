"use client";

import { useMemo, useState } from "react";
import { ChevronDown, PenLine, Search, Sparkles, Star } from "lucide-react";
import type { FoodProduct } from "@/lib/food";
import MacroSplit from "@/components/MacroSplit";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import Stepper from "@/components/ui/Stepper";
import { Field, inputCls } from "@/components/ui/Field";
import { uid } from "@/lib/uid";
import {
  MEALS,
  todayISO,
  type FavoriteFood,
  type FoodEntry,
  type MealType,
} from "@/lib/types";

type Per100 = FoodProduct["per100"];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Escala los valores por 100 g a la cantidad indicada. */
function scale(per100: Per100, qty: number) {
  const k = qty / 100;
  return {
    calories: Math.round(per100.calories * k),
    protein: round1(per100.protein * k),
    carbs: round1(per100.carbs * k),
    fat: round1(per100.fat * k),
  };
}

/**
 * Deriva los valores por 100 g de un registro que ya tiene totales.
 *
 * Es lo que permite que un favorito o un reciente sigan escalando al cambiar la
 * cantidad. Antes se cargaban con sus totales fijos y mover los gramos no
 * recalculaba nada, así que había que corregir los cuatro campos a mano.
 *
 * NO se redondea a propósito: es un valor interno que nadie ve, y redondearlo
 * rompía la edición manual. Con 200 g, escribir "9" kcal guardaba `round(4.5)`
 * = 5 por 100 g, que al volver a escalar daba 10 — el campo te "corregía" el
 * 9 por un 10 en cada tecla y no había forma de escribir 900.
 */
function per100From(item: {
  qty: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): Per100 | null {
  if (item.qty <= 0) return null;
  const k = 100 / item.qty;
  return {
    calories: item.calories * k,
    protein: item.protein * k,
    carbs: item.carbs * k,
    fat: item.fat * k,
  };
}

/** Cantidades típicas, para no abrir el teclado por 50 gramos. */
const QUICK_QTY = [50, 100, 150, 200];

/** Normaliza para comparar sin tildes ni mayúsculas. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

type Known = {
  key: string;
  name: string;
  qty: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fav: boolean;
};

export default function FoodForm({
  meal,
  foods,
  favorites,
  onAdd,
  onClose,
  onAddFavorite,
  onRemoveFavorite,
}: {
  meal: MealType;
  foods: FoodEntry[];
  favorites: FavoriteFood[];
  onAdd: (e: FoodEntry) => void;
  onClose: () => void;
  onAddFavorite: (fav: Omit<FavoriteFood, "id" | "createdAt">) => void;
  onRemoveFavorite: (id: string) => void;
}) {
  const mealLabel = MEALS.find((m) => m.key === meal)?.label ?? "";

  // Dos pasos, no seis campos a la vez: primero QUÉ comiste, después CUÁNTO.
  const [step, setStep] = useState<"buscar" | "cantidad">("buscar");

  const [name, setName] = useState("");
  const [qty, setQty] = useState("100");
  // Fuente de verdad de los macros. Todo lo mostrado sale de acá × cantidad,
  // así los números se mueven solos mientras ajustás los gramos.
  const [per100, setPer100] = useState<Per100 | null>(null);
  const [editing, setEditing] = useState(false);
  /**
   * Lo que el usuario está escribiendo en cada campo de macros, tal cual. El
   * valor mostrado no puede ser el recalculado: entre tecla y tecla pasaba por
   * `per100` y volvía distinto, y además "0" o "9." desaparecían al no ser
   * números "válidos" todavía.
   */
  const [draft, setDraft] = useState<Partial<Record<keyof Per100, string>>>({});

  const [query, setQuery] = useState("");
  const q = query.trim();
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const qtyNum = Number(qty) || 0;
  const macros = per100
    ? scale(per100, qtyNum)
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  /**
   * Tus alimentos: favoritos y comidas ya registradas. Es lo único que se
   * "sugiere", porque es lo único que sabemos que comés de verdad. Antes acá
   * se buscaba en Open Food Facts y devolvía productos envasados de otros
   * países que no tenían nada que ver con lo que uno estaba cargando.
   */
  const known = useMemo<Known[]>(() => {
    const seen = new Set<string>();
    const out: Known[] = [];
    for (const fav of favorites) {
      const key = norm(fav.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...fav, key, fav: true });
    }
    for (const item of [...foods].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    )) {
      const key = norm(item.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...item, key, fav: false });
    }
    return out;
  }, [foods, favorites]);

  const matches = useMemo(() => {
    if (q.length < 2) return [];
    const nq = norm(q);
    return known.filter((k) => k.key.includes(nq)).slice(0, 8);
  }, [known, q]);

  /** Pasa al paso de cantidad con un alimento ya elegido. */
  const choose = (
    label: string,
    base: Per100 | null,
    startQty?: number,
  ) => {
    setName(label);
    setPer100(base);
    if (startQty != null) setQty(String(startQty));
    setEditing(base === null);
    setDraft({});
    setQuery("");
    setEstimateError(null);
    setStep("cantidad");
  };

  const fillFrom = (item: Known) =>
    choose(item.name, per100From(item), item.qty);

  const currentFav = favorites.find(
    (x) => norm(x.name) === norm(name),
  );
  const toggleFav = () => {
    if (currentFav) return onRemoveFavorite(currentFav.id);
    if (name.trim())
      onAddFavorite({
        name: name.trim(),
        qty: qtyNum,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      });
  };

  /** Cambiar la cantidad invalida lo que se estaba tipeando a mano. */
  const changeQty = (v: string) => {
    setQty(v);
    setDraft({});
  };

  /**
   * Edición manual de un macro. Se reconstruye `per100` a partir del total
   * escrito y la cantidad actual, para que seguir moviendo los gramos siga
   * escalando bien en vez de pisar lo que acabás de corregir.
   */
  const editMacro = (key: keyof Per100, raw: string) => {
    setDraft((d) => ({ ...d, [key]: raw }));
    const next = { ...macros, [key]: Number(raw) || 0 };
    setPer100(per100From({ qty: qtyNum || 100, ...next }));
  };
  const macroValue = (key: keyof Per100) =>
    draft[key] ?? (macros[key] ? String(macros[key]) : "");

  /** La IA estima los macros por 100 g del alimento escrito. */
  const estimateWithAI = async () => {
    if (!q || estimating) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const r = await fetch("/api/foods/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: q }),
      });
      const data = (await r.json()) as {
        product?: FoodProduct;
        error?: string;
      };
      if (!r.ok || !data.product) {
        throw new Error(data?.error ?? "No pude estimarlo");
      }
      choose(data.product.name, data.product.per100, qtyNum || 100);
    } catch (err) {
      setEstimateError(
        err instanceof Error
          ? err.message
          : "No pude estimarlo. Cargalo a mano.",
      );
    } finally {
      setEstimating(false);
    }
  };

  const canAdd = name.trim() !== "" && qtyNum > 0;
  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: uid(),
      date: todayISO(),
      meal,
      name: name.trim(),
      qty: qtyNum,
      ...macros,
    });
  };

  return (
    <Sheet
      title={step === "buscar" ? `Agregar a ${mealLabel}` : name || "Cantidad"}
      onClose={onClose}
      footer={
        step === "cantidad" ? (
          <Button size="lg" full onClick={submit} disabled={!canAdd}>
            Agregar a {mealLabel}
          </Button>
        ) : undefined
      }
    >
      {step === "buscar" ? (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              className={`${inputCls} pl-11`}
              placeholder="¿Qué comiste?"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setEstimateError(null);
              }}
              aria-label="Nombre del alimento"
            />
          </div>

          {/* Sin búsqueda: acceso directo a lo de siempre. */}
          {q === "" && (
            <>
              {known.filter((k) => k.fav).length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted">Favoritos</h3>
                  <div className="flex flex-wrap gap-2">
                    {known
                      .filter((k) => k.fav)
                      .slice(0, 8)
                      .map((fav) => (
                        <Chip key={fav.key} selected onClick={() => fillFrom(fav)}>
                          <Star size={13} strokeWidth={2.5} aria-hidden />
                          {fav.name}
                        </Chip>
                      ))}
                  </div>
                </section>
              )}
              {known.filter((k) => !k.fav).length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted">Recientes</h3>
                  <div className="flex flex-wrap gap-2">
                    {known
                      .filter((k) => !k.fav)
                      .slice(0, 8)
                      .map((rec) => (
                        <Chip key={rec.key} onClick={() => fillFrom(rec)}>
                          {rec.name}
                        </Chip>
                      ))}
                  </div>
                </section>
              )}
            </>
          )}

          {q.length >= 2 && (
            <div className="flex flex-col gap-4">
              {matches.length > 0 && (
                <section className="flex flex-col">
                  <h3 className="mb-1 text-xs font-medium text-muted">
                    Tus alimentos
                  </h3>
                  {matches.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => fillFrom(k)}
                      className="flex items-center justify-between gap-3 border-b border-border py-3 text-left last:border-0 active:scale-[0.99]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {k.fav && (
                          <Star
                            size={13}
                            strokeWidth={2.5}
                            className="shrink-0 text-primary"
                            aria-hidden
                          />
                        )}
                        <span className="truncate text-sm font-medium">
                          {k.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {k.qty} g · {Math.round(k.calories)} kcal
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {/* La vía principal para algo nuevo. La app ya no inventa una
                  lista de productos envasados que no tienen que ver: o es algo
                  que ya comiste, o lo calcula la IA. */}
              <Button
                variant="primary"
                size="lg"
                full
                onClick={estimateWithAI}
                disabled={estimating}
              >
                <Sparkles size={17} aria-hidden />
                {estimating ? "Calculando…" : `Calcular «${q}» con IA`}
              </Button>
              {estimateError && (
                <p className="-mt-2 text-sm text-accent">{estimateError}</p>
              )}
            </div>
          )}

          {/* Salida siempre disponible: cargar algo con tus propios números. */}
          <button
            type="button"
            onClick={() => choose(q, null, 100)}
            className="flex items-center gap-2 self-start text-sm font-medium text-muted transition-colors hover:text-primary"
          >
            <PenLine size={15} aria-hidden />
            {q ? `Cargar «${q}» a mano` : "Cargar a mano"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep("buscar")}
            >
              Cambiar alimento
            </Button>
            <button
              type="button"
              onClick={toggleFav}
              disabled={!name.trim()}
              aria-pressed={!!currentFav}
              aria-label={
                currentFav ? "Quitar de favoritos" : "Guardar como favorito"
              }
              className={`ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-40 ${
                currentFav ? "bg-primary/10 text-primary" : "bg-sunken text-muted"
              }`}
            >
              <Star
                size={17}
                strokeWidth={2.2}
                fill={currentFav ? "currentColor" : "none"}
                aria-hidden
              />
            </button>
          </div>

          {/* El nombre sigue siendo editable, pero ya no compite con el buscador:
              es un solo campo, no dos como antes. */}
          <Field label="Alimento">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Yogur natural"
            />
          </Field>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-muted">Cantidad</span>
            <div className="flex flex-wrap gap-2">
              {QUICK_QTY.map((g) => (
                <Chip
                  key={g}
                  selected={qtyNum === g}
                  onClick={() => changeQty(String(g))}
                >
                  {g} g
                </Chip>
              ))}
            </div>
            <Stepper
              value={qty}
              onChange={changeQty}
              step={10}
              min={0}
              max={5000}
              suffix="g"
              ariaLabel="Cantidad en gramos"
            />
          </div>

          <MacroSplit
            calories={macros.calories}
            protein={macros.protein}
            carbs={macros.carbs}
            fat={macros.fat}
          />

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              className="flex items-center gap-1.5 self-start text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              <ChevronDown
                size={16}
                aria-hidden
                className={`transition-transform duration-(--duration-base) ${editing ? "rotate-180" : ""}`}
              />
              Editar valores
            </button>

            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Calorías (kcal)">
                  <input
                    type="number"
                    inputMode="numeric"
                    className={inputCls}
                    value={macroValue("calories")}
                    onChange={(e) => editMacro("calories", e.target.value)}
                  />
                </Field>
                <Field label="Proteínas (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputCls}
                    value={macroValue("protein")}
                    onChange={(e) => editMacro("protein", e.target.value)}
                  />
                </Field>
                <Field label="Carbohidratos (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputCls}
                    value={macroValue("carbs")}
                    onChange={(e) => editMacro("carbs", e.target.value)}
                  />
                </Field>
                <Field label="Grasas (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputCls}
                    value={macroValue("fat")}
                    onChange={(e) => editMacro("fat", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
