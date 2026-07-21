"use client";

import { useState } from "react";
import CalorieRing from "@/components/CalorieRing";
import ExerciseForm from "@/components/ExerciseForm";
import FoodForm from "@/components/FoodForm";
import InsightsCard from "@/components/InsightsCard";
import RecipesSheet from "@/components/RecipesSheet";
import MacroBar from "@/components/MacroBar";
import ScoreCard from "@/components/ScoreCard";
import SupplementsCard from "@/components/SupplementsCard";
import Timeline from "@/components/Timeline";
import WellbeingCard from "@/components/WellbeingCard";
import type { Insight } from "@/lib/insights";
import type { DailyScore } from "@/lib/score";
import {
  MEALS,
  type DailyMetrics,
  type ExerciseEntry,
  type FavoriteFood,
  type FoodEntry,
  type MealType,
  type Recipe,
  type RecipeItem,
  type Supplement,
  type SupplementLog,
} from "@/lib/types";
import { uid } from "@/components/Sheet";

type Totals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  burned: number;
};

/** Corre una fecha YYYY-MM-DD `delta` días (local). */
const shiftISO = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export default function HoyTab({
  weight,
  score,
  totals,
  goals,
  todayMetrics,
  todayFoods,
  todayEx,
  foods,
  favorites,
  recipes,
  supplements,
  supplementLogs,
  insights,
  today,
  viewDate,
  setViewDate,
  onEditProfile,
  onSignOut,
  addFood,
  removeFood,
  addFavorite,
  removeFavorite,
  addRecipe,
  removeRecipe,
  addExercise,
  removeExercise,
  setMetric,
  addSupplement,
  removeSupplement,
  toggleSupplement,
}: {
  weight: number;
  score: DailyScore;
  totals: Totals;
  goals: { calories: number; protein: number; carbs: number; fat: number };
  todayMetrics?: DailyMetrics;
  todayFoods: FoodEntry[];
  todayEx: ExerciseEntry[];
  foods: FoodEntry[];
  favorites: FavoriteFood[];
  recipes: Recipe[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  insights: Insight[];
  today: string;
  viewDate: string;
  setViewDate: (d: string) => void;
  onEditProfile: () => void;
  onSignOut: () => void;
  addFood: (e: FoodEntry) => void;
  removeFood: (id: string) => void;
  addFavorite: (fav: Omit<FavoriteFood, "id" | "createdAt">) => void;
  removeFavorite: (id: string) => void;
  addRecipe: (name: string, items: RecipeItem[]) => void;
  removeRecipe: (id: string) => void;
  addExercise: (e: ExerciseEntry) => void;
  removeExercise: (id: string) => void;
  setMetric: (
    date: string,
    patch: Partial<Pick<DailyMetrics, "water" | "sleepHours" | "steps">>,
  ) => void;
  addSupplement: (name: string, dose?: string, time?: string) => void;
  removeSupplement: (id: string) => void;
  toggleSupplement: (supId: string, date: string) => void;
}) {
  const [foodOpen, setFoodOpen] = useState<MealType | null>(null);
  const [exOpen, setExOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const isToday = viewDate === today;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Nut<span className="text-primary">ta</span>
          </h1>
          {/* Navegador de días: consultar días anteriores */}
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => setViewDate(shiftISO(viewDate, -1))}
              className="rounded-md px-1.5 text-lg leading-none text-muted active:scale-90"
              aria-label="Día anterior"
            >
              ‹
            </button>
            <span className="min-w-26 text-center text-sm capitalize text-muted">
              {isToday ? "Hoy" : dayLabel(viewDate)}
            </span>
            <button
              onClick={() => setViewDate(shiftISO(viewDate, 1))}
              disabled={isToday}
              className="rounded-md px-1.5 text-lg leading-none text-muted active:scale-90 disabled:opacity-30"
              aria-label="Día siguiente"
            >
              ›
            </button>
          </div>
        </div>
        <button
          onClick={onEditProfile}
          className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary active:scale-95"
          aria-label="Editar perfil"
        >
          N
        </button>
      </header>

      <ScoreCard data={score} />

      <section className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card p-6">
        <CalorieRing
          consumed={Math.round(totals.calories)}
          burned={Math.round(totals.burned)}
          goal={goals.calories}
        />
        <div className="flex w-full flex-col gap-3">
          <MacroBar
            label="Proteínas"
            value={totals.protein}
            goal={goals.protein}
            color="var(--primary)"
          />
          <MacroBar
            label="Carbohidratos"
            value={totals.carbs}
            goal={goals.carbs}
            color="var(--accent)"
          />
          <MacroBar
            label="Grasas"
            value={totals.fat}
            goal={goals.fat}
            color="var(--success)"
          />
        </div>
      </section>

      {/* Bienestar, suplementos e insights: solo el día de hoy */}
      {isToday && (
        <>
          <WellbeingCard
            metrics={todayMetrics}
            onSetWater={(l) => setMetric(today, { water: l })}
            onSetSleep={(h) => setMetric(today, { sleepHours: h })}
            onSetSteps={(n) => setMetric(today, { steps: n })}
          />

          <SupplementsCard
            supplements={supplements}
            logs={supplementLogs}
            today={today}
            onAdd={addSupplement}
            onRemove={removeSupplement}
            onToggle={toggleSupplement}
          />

          <InsightsCard insights={insights} />
        </>
      )}

      <Timeline
        foods={todayFoods}
        exercises={todayEx}
        onRemoveFood={removeFood}
        onRemoveExercise={removeExercise}
      />

      {/* Agregar manualmente (solo hoy; el chat es la vía principal) */}
      {isToday && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted">Agregar</h2>
          <div className="flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <button
                key={m.key}
                onClick={() => setFoodOpen(m.key)}
                className="rounded-full border border-border px-3 py-1.5 text-sm transition active:scale-95 hover:border-primary"
              >
                + {m.label}
              </button>
            ))}
            <button
              onClick={() => setExOpen(true)}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-accent transition active:scale-95 hover:border-accent"
            >
              + Ejercicio
            </button>
            <button
              onClick={() => setRecipesOpen(true)}
              className="rounded-full border border-border px-3 py-1.5 text-sm transition active:scale-95 hover:border-primary"
            >
              🍲 Recetas
            </button>
          </div>
        </section>
      )}

      <button
        onClick={onSignOut}
        className="mx-auto text-xs text-muted underline-offset-2 hover:underline"
      >
        Cerrar sesión
      </button>

      {foodOpen && (
        <FoodForm
          meal={foodOpen}
          foods={foods}
          favorites={favorites}
          onClose={() => setFoodOpen(null)}
          onAdd={(entry) => {
            addFood(entry);
            setFoodOpen(null);
          }}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
        />
      )}
      {exOpen && (
        <ExerciseForm
          weight={weight}
          onClose={() => setExOpen(false)}
          onAdd={(entry) => {
            addExercise(entry);
            setExOpen(false);
          }}
        />
      )}
      {recipesOpen && (
        <RecipesSheet
          recipes={recipes}
          onClose={() => setRecipesOpen(false)}
          onCreate={addRecipe}
          onRemove={removeRecipe}
          onLog={(items, meal) => {
            for (const it of items) {
              addFood({ id: uid(), date: today, meal, ...it });
            }
          }}
        />
      )}
    </main>
  );
}
