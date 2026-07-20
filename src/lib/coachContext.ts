import type { FoodEntry } from "@/lib/types";

/**
 * Resume los alimentos que el usuario repite por comida (histórico), para dar
 * contexto a la IA y resolver "lo de siempre". Solo cuenta los repetidos (≥2).
 * Es una función pura y client-safe (no importa el AI SDK).
 */
export function frequentFoodsSummary(foods: FoodEntry[]): string {
  const byMeal = new Map<string, Map<string, number>>();
  for (const f of foods) {
    const key = f.name.trim().toLowerCase();
    if (!key) continue;
    const m = byMeal.get(f.meal) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + 1);
    byMeal.set(f.meal, m);
  }

  const parts: string[] = [];
  for (const [meal, counts] of byMeal) {
    const top = [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
    if (top.length) parts.push(`${meal}: ${top.join(", ")}`);
  }
  return parts.join(" | ");
}
