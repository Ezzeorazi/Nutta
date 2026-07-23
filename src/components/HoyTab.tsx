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
  startOfLocalDayMs,
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
import { waterGoalL } from "@/lib/nutrition";
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
  streak,
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
  setSupplementQty,
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
  streak: number;
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
  addSupplement: (
    name: string,
    dose?: string,
    time?: string,
    defaultQty?: number,
    unit?: string,
    protein?: number,
  ) => void;
  removeSupplement: (id: string) => void;
  toggleSupplement: (supId: string, date: string) => void;
  setSupplementQty: (supId: string, date: string, qty: number) => void;
}) {
  const [foodOpen, setFoodOpen] = useState<MealType | null>(null);
  const [exOpen, setExOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const isToday = viewDate === today;
  const waterGoal = waterGoalL(weight);
  // Timestamp del día que se está viendo: hoy usa el instante real (preserva el
  // orden del timeline); un día pasado se ancla al mediodía para no saltar a hoy.
  const stamp = () => (isToday ? Date.now() : startOfLocalDayMs(viewDate));

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
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span
              className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-sm font-semibold text-accent tabular-nums"
              title={`Racha de entrenamiento: ${streak} ${streak === 1 ? "día" : "días"}`}
            >
              🔥 {streak}
            </span>
          )}
          <button
            onClick={onEditProfile}
            className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary active:scale-95"
            aria-label="Editar perfil"
          >
            N
          </button>
        </div>
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

      {/* Bienestar: cualquier día (permite completar/corregir días pasados) */}
      <WellbeingCard
        key={viewDate}
        metrics={todayMetrics}
        waterGoal={waterGoal}
        onSetWater={(l) => setMetric(viewDate, { water: l })}
        onSetSleep={(h) => setMetric(viewDate, { sleepHours: h })}
        onSetSteps={(n) => setMetric(viewDate, { steps: n })}
      />

      {/* Suplementos: cualquier día (permite completar/corregir días pasados) */}
      <SupplementsCard
        supplements={supplements}
        logs={supplementLogs}
        today={viewDate}
        onAdd={addSupplement}
        onRemove={removeSupplement}
        onToggle={toggleSupplement}
        onSetQty={setSupplementQty}
      />

      {/* Insights: solo el día de hoy (mira el estado actual) */}
      {isToday && <InsightsCard insights={insights} />}

      <Timeline
        foods={todayFoods}
        exercises={todayEx}
        onRemoveFood={removeFood}
        onRemoveExercise={removeExercise}
      />

      {/* Agregar manualmente (cualquier día; el chat es la vía principal para hoy) */}
      <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            Agregar{isToday ? "" : ` a ${dayLabel(viewDate)}`}
          </h2>
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
            addFood({ ...entry, date: viewDate, createdAt: stamp() });
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
            addExercise({ ...entry, date: viewDate, createdAt: stamp() });
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
              addFood({
                id: uid(),
                date: viewDate,
                meal,
                createdAt: stamp(),
                ...it,
              });
            }
          }}
        />
      )}
    </main>
  );
}
