"use client";

import { useEffect, useState } from "react";
import { normalizeProduct, type FoodProduct, type OffProduct } from "@/lib/off";
import BarcodeScanner from "@/components/BarcodeScanner";
import Sheet, { Field, inputCls, uid } from "@/components/Sheet";
import { MEALS, todayISO, type FoodEntry, type MealType } from "@/lib/types";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Escala los valores por 100 g a la cantidad indicada. */
function scale(per100: FoodProduct["per100"], qty: number) {
  const k = qty / 100;
  return {
    calories: String(Math.round(per100.calories * k)),
    protein: String(round1(per100.protein * k)),
    carbs: String(round1(per100.carbs * k)),
    fat: String(round1(per100.fat * k)),
  };
}

export default function FoodForm({
  meal,
  onAdd,
  onClose,
}: {
  meal: MealType;
  onAdd: (e: FoodEntry) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: "",
    qty: "100",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  // per100 del producto elegido; si es null, los macros son manuales.
  const [base, setBase] = useState<FoodProduct["per100"] | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const label = MEALS.find((m) => m.key === meal)?.label ?? "";

  // Búsqueda con debounce contra Open Food Facts.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
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
        const res = await fetch(url, { signal: ctrl.signal });
        const data = (await res.json()) as { products?: OffProduct[] };
        const products = (data.products ?? [])
          .map(normalizeProduct)
          .filter((p): p is FoodProduct => p !== null)
          .slice(0, 15);
        setResults(products);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const selectProduct = (p: FoodProduct) => {
    const qty = Number(f.qty) || 100;
    setBase(p.per100);
    setF({ name: p.name, qty: String(qty), ...scale(p.per100, qty) });
    setQuery("");
    setResults([]);
  };

  const lookupBarcode = async (code: string) => {
    setScanning(false);
    setScanMsg("Buscando producto…");
    try {
      const res = await fetch(`/api/foods/barcode?code=${code}`);
      const data = (await res.json()) as {
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

  const changeQty = (qty: string) => {
    if (base) {
      setF({ ...f, qty, ...scale(base, Number(qty) || 0) });
    } else {
      setF({ ...f, qty });
    }
  };

  return (
    <Sheet title={`Agregar a ${label}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!f.name.trim()) return;
          onAdd({
            id: uid(),
            date: todayISO(),
            meal,
            name: f.name.trim(),
            qty: Number(f.qty) || 0,
            calories: Number(f.calories) || 0,
            protein: Number(f.protein) || 0,
            carbs: Number(f.carbs) || 0,
            fat: Number(f.fat) || 0,
          });
        }}
      >
        {/* Buscador Open Food Facts + escaneo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className={inputCls}
              placeholder="🔍 Buscar alimento (ej. yogur, banana...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {(loading || results.length > 0) && (
              <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                {loading && (
                  <p className="px-3 py-2 text-sm text-muted">Buscando…</p>
                )}
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-primary/5"
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
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setScanMsg(null);
              setScanning(true);
            }}
            className="shrink-0 rounded-xl border border-border px-3 text-xl active:scale-95"
            aria-label="Escanear código de barras"
          >
            📷
          </button>
        </div>
        {scanMsg && <p className="-mt-2 text-xs text-accent">{scanMsg}</p>}

        <input
          className={inputCls}
          placeholder="Alimento (ej. Yogur natural)"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad (g)">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              value={f.qty}
              onChange={(e) => changeQty(e.target.value)}
            />
          </Field>
          <Field label="Calorías (kcal)">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              value={f.calories}
              onChange={(e) => setF({ ...f, calories: e.target.value })}
            />
          </Field>
          <Field label="Proteínas (g)">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={f.protein}
              onChange={(e) => setF({ ...f, protein: e.target.value })}
            />
          </Field>
          <Field label="Carbohidratos (g)">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={f.carbs}
              onChange={(e) => setF({ ...f, carbs: e.target.value })}
            />
          </Field>
          <Field label="Grasas (g)">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={f.fat}
              onChange={(e) => setF({ ...f, fat: e.target.value })}
            />
          </Field>
        </div>
        <button
          type="submit"
          className="mt-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground active:scale-[0.99]"
        >
          Agregar
        </button>
      </form>
      {scanning && (
        <BarcodeScanner
          onDetected={lookupBarcode}
          onClose={() => setScanning(false)}
        />
      )}
    </Sheet>
  );
}
