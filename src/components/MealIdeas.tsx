"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { frequentFoodsSummary } from "@/lib/coachContext";
import { mealTarget, nextMeal } from "@/lib/mealIdeas";
import type { FoodEntry, Goals, MemoryFact } from "@/lib/types";

type Idea = {
  title: string;
  items: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Cached = { date: string; meal: string; ideas: Idea[] };

const KEY = "nutta.mealIdeas";

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

/**
 * "Dame ideas": la IA arma 3 opciones para la próxima comida con lo que comés
 * de verdad y lo que te falta del día. A pedido, nunca automático (cuesta una
 * llamada), y cacheado por día y comida: volver a la pestaña no regenera.
 */
export default function MealIdeas({
  today,
  remaining,
  foods,
  memories,
}: {
  today: string;
  remaining: Goals;
  foods: FoodEntry[];
  memories: MemoryFact[];
}) {
  const meal = nextMeal(new Date().getHours());
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El cache se lee después de montar: localStorage no existe en el server.
  useEffect(() => {
    const c = readCache();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde localStorage
    if (c && c.date === today && c.meal === meal.key) setIdeas(c.ideas);
  }, [today, meal.key]);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const hour = new Date().getHours();
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal: meal.label,
          target: mealTarget(remaining, hour),
          remaining,
          frequent: frequentFoodsSummary(foods),
          memories: memories.map((m) => ({ kind: m.kind, text: m.text })),
        }),
      });
      const data = (await res.json()) as { ideas?: Idea[]; error?: string };
      if (!res.ok || !data.ideas) throw new Error(data.error ?? "Error");
      setIdeas(data.ideas);
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ date: today, meal: meal.key, ideas: data.ideas }),
        );
      } catch {
        // Sin storage las ideas se ven igual, solo no sobreviven al recargar.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude armar ideas ahora.");
    } finally {
      setBusy(false);
    }
  };

  const nada = remaining.calories < 150 && remaining.protein < 10;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted">
          Ideas para: {meal.label.toLowerCase()}
        </h3>
        <button
          type="button"
          onClick={ask}
          disabled={busy || nada}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 text-xs font-semibold text-primary active:scale-95 disabled:opacity-50"
        >
          <Sparkles size={14} aria-hidden />
          {busy ? "Pensando…" : ideas ? "Otras ideas" : "Dame ideas"}
        </button>
      </div>
      {nada && !ideas && (
        <p className="text-xs text-muted">Ya cerraste el día: no hace falta comer más.</p>
      )}
      {error && <p className="text-xs text-accent">{error}</p>}
      {ideas && (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <li key={idea.title} className="rounded-xl bg-sunken p-3">
              <p className="text-sm font-semibold">{idea.title}</p>
              <p className="mt-0.5 text-xs text-muted">{idea.items}</p>
              <p className="mt-1 text-[11px] text-muted tabular-nums">
                {Math.round(idea.calories)} kcal · {Math.round(idea.protein)} P ·{" "}
                {Math.round(idea.carbs)} C · {Math.round(idea.fat)} G
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
