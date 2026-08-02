"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronDown, PenLine, Search, Sparkles, Star } from "lucide-react";
import { normalizeProduct, type FoodProduct, type OffProduct } from "@/lib/off";
import BarcodeScanner from "@/components/BarcodeScanner";
import MacroSplit from "@/components/MacroSplit";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import Skeleton from "@/components/ui/Skeleton";
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
    calories: Math.round(item.calories * k),
    protein: round1(item.protein * k),
    carbs: round1(item.carbs * k),
    fat: round1(item.fat * k),
  };
}

/** Cantidades típicas, para no abrir el teclado por 50 gramos. */
const QUICK_QTY = [50, 100, 150, 200];

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
  const [brand, setBrand] = useState<string | null>(null);
  const [qty, setQty] = useState("100");
  // Fuente de verdad de los macros. Todo lo mostrado sale de acá × cantidad,
  // así los números se mueven solos mientras ajustás los gramos.
  const [per100, setPer100] = useState<Per100 | null>(null);
  const [editing, setEditing] = useState(false);

  const [query, setQuery] = useState("");
  const q = query.trim();
  // Los resultados se guardan junto a la búsqueda que los produjo: así nunca se
  // muestran los de una consulta anterior mientras llega la nueva.
  const [res, setRes] = useState<{ q: string; items: FoodProduct[] }>({
    q: "",
    items: [],
  });
  const items = res.q === q ? res.items : [];
  const [loading, setLoading] = useState(false);
  const [down, setDown] = useState(false); // OFF no respondió (503/HTML)
  const [estimating, setEstimating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const qtyNum = Number(qty) || 0;
  const macros = per100
    ? scale(per100, qtyNum)
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  // Comidas recientes (únicas por nombre, más nuevas primero).
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: FoodEntry[] = [];
    for (const item of [...foods].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    )) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 8) break;
    }
    return out;
  }, [foods]);

  /** Pasa al paso de cantidad con un alimento ya elegido. */
  const choose = (
    label: string,
    productBrand: string | null,
    base: Per100 | null,
    startQty?: number,
  ) => {
    setName(label);
    setBrand(productBrand);
    setPer100(base);
    if (startQty != null) setQty(String(startQty));
    setEditing(base === null);
    setQuery("");
    setStep("cantidad");
  };

  const selectProduct = (p: FoodProduct) =>
    choose(p.name, p.brand, p.per100, qtyNum || 100);

  const fillFrom = (item: {
    name: string;
    qty: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => choose(item.name, null, per100From(item), item.qty);

  const currentFav = favorites.find(
    (x) => x.name.toLowerCase() === name.trim().toLowerCase(),
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

  /**
   * Edición manual de un macro. Se reconstruye `per100` a partir del total
   * escrito y la cantidad actual, para que seguir moviendo los gramos siga
   * escalando bien en vez de pisar lo que acabás de corregir.
   */
  const editMacro = (key: keyof Per100, value: string) => {
    const next = { ...macros, [key]: Number(value) || 0 };
    setPer100(per100From({ qty: qtyNum || 100, ...next }));
  };

  // Búsqueda con debounce contra Open Food Facts.
  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Se consulta OFF directo desde el navegador: usa la IP del usuario
        // (las IPs de datacenter de Vercel suelen ser bloqueadas por OFF).
        const url =
          "https://world.openfoodfacts.org/api/v2/search?" +
          new URLSearchParams({
            search_terms: q,
            page_size: "40",
            sort_by: "popularity_key",
            fields: "code,product_name,product_name_es,brands,nutriments",
          }).toString();
        const r = await fetch(url, { signal: ctrl.signal });
        const ct = r.headers.get("content-type") ?? "";
        // OFF suele responder 503/HTML cuando está saturado: no es "sin
        // resultados", es que el servicio no está disponible.
        if (!r.ok || !ct.includes("json")) throw new Error("OFF no disponible");
        const data = (await r.json()) as { products?: OffProduct[] };
        const products = (data.products ?? [])
          .map(normalizeProduct)
          .filter((p): p is FoodProduct => p !== null)
          .slice(0, 15);
        setRes({ q, items: products });
        setDown(false);
      } catch {
        if (!ctrl.signal.aborted) {
          setRes({ q, items: [] });
          setDown(true);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [q]);

  // Fallback cuando OFF no tiene (o está caído): la IA estima los macros/100g.
  const estimateWithAI = async () => {
    if (!q || estimating) return;
    setEstimating(true);
    try {
      const r = await fetch("/api/foods/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: q }),
      });
      const data = (await r.json()) as { product?: FoodProduct };
      if (data.product) selectProduct(data.product);
    } catch {
      // silencioso: siempre queda la carga manual
    } finally {
      setEstimating(false);
    }
  };

  const lookupBarcode = async (code: string) => {
    setScanning(false);
    setScanMsg("Buscando producto…");
    try {
      const r = await fetch(`/api/foods/barcode?code=${code}`);
      const data = (await r.json()) as {
        product?: FoodProduct | null;
        error?: string;
      };
      if (data.product) {
        selectProduct(data.product);
        setScanMsg(null);
      } else {
        setScanMsg(data.error ?? "Producto no encontrado");
      }
    } catch {
      setScanMsg("No se pudo consultar el código");
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
      description={step === "cantidad" ? (brand ?? undefined) : undefined}
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                className={`${inputCls} pl-11`}
                placeholder="Buscar alimento…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar alimento"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setScanMsg(null);
                setScanning(true);
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-foreground transition-transform duration-(--duration-fast) active:scale-90"
              aria-label="Escanear código de barras"
            >
              <Camera size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
          {scanMsg && <p className="-mt-2 text-sm text-accent">{scanMsg}</p>}

          {/* Sin búsqueda: acceso directo a lo de siempre. */}
          {q === "" && (
            <>
              {favorites.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted">Favoritos</h3>
                  <div className="flex flex-wrap gap-2">
                    {favorites.slice(0, 8).map((fav) => (
                      <Chip key={fav.id} selected onClick={() => fillFrom(fav)}>
                        <Star size={13} strokeWidth={2.5} aria-hidden />
                        {fav.name}
                      </Chip>
                    ))}
                  </div>
                </section>
              )}
              {recents.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted">Recientes</h3>
                  <div className="flex flex-wrap gap-2">
                    {recents.map((rec) => (
                      <Chip key={rec.id} onClick={() => fillFrom(rec)}>
                        {rec.name}
                      </Chip>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Resultados en lista, no en un desplegable que tapa el formulario. */}
          {q.length >= 2 && (
            <div className="flex flex-col">
              {loading && items.length === 0 && (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              )}

              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="flex items-center justify-between gap-3 border-b border-border py-3 text-left last:border-0 active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {p.name}
                    </span>
                    {p.brand && (
                      <span className="block truncate text-xs text-muted">
                        {p.brand}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {p.per100.calories} kcal/100g
                  </span>
                </button>
              ))}

              {!loading && items.length === 0 && (
                <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border p-4">
                  <p className="text-sm text-muted">
                    {down
                      ? "Open Food Facts no responde ahora."
                      : `Sin resultados para «${q}».`}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={estimateWithAI}
                    disabled={estimating}
                  >
                    <Sparkles size={16} aria-hidden />
                    {estimating ? "Estimando…" : "Estimar con IA"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Salida siempre disponible: cargar algo que no está en ningún lado. */}
          <button
            type="button"
            onClick={() => choose(q, null, null, 100)}
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
              autoFocus={!name}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-muted">Cantidad</span>
            <div className="flex flex-wrap gap-2">
              {QUICK_QTY.map((g) => (
                <Chip
                  key={g}
                  selected={qtyNum === g}
                  onClick={() => setQty(String(g))}
                >
                  {g} g
                </Chip>
              ))}
            </div>
            <Stepper
              value={qty}
              onChange={setQty}
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
                    value={macros.calories || ""}
                    onChange={(e) => editMacro("calories", e.target.value)}
                  />
                </Field>
                <Field label="Proteínas (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputCls}
                    value={macros.protein || ""}
                    onChange={(e) => editMacro("protein", e.target.value)}
                  />
                </Field>
                <Field label="Carbohidratos (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputCls}
                    value={macros.carbs || ""}
                    onChange={(e) => editMacro("carbs", e.target.value)}
                  />
                </Field>
                <Field label="Grasas (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputCls}
                    value={macros.fat || ""}
                    onChange={(e) => editMacro("fat", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onDetected={lookupBarcode}
          onClose={() => setScanning(false)}
        />
      )}
    </Sheet>
  );
}
