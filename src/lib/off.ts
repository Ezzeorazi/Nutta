/** Utilidades para normalizar productos de Open Food Facts. */

export type FoodProduct = {
  id: string;
  name: string;
  brand: string | null;
  /** valores nutricionales por 100 g */
  per100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const num = (v: number | string | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
};

/** Convierte un producto de OFF al formato de la app, o null si no sirve. */
export function normalizeProduct(p: OffProduct): FoodProduct | null {
  const name = (p.product_name_es || p.product_name || "").trim();
  const n = p.nutriments ?? {};
  const calories = num(n["energy-kcal_100g"]);
  if (!name || calories <= 0) return null;
  return {
    id: p.code ?? name,
    name,
    brand: p.brands?.split(",")[0]?.trim() || null,
    per100: {
      calories: Math.round(calories),
      protein: Math.round(num(n["proteins_100g"]) * 10) / 10,
      carbs: Math.round(num(n["carbohydrates_100g"]) * 10) / 10,
      fat: Math.round(num(n["fat_100g"]) * 10) / 10,
    },
  };
}
