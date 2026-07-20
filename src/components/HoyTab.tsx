"use client";

import { useState } from "react";
import CalorieRing from "@/components/CalorieRing";
import ExerciseForm from "@/components/ExerciseForm";
import FoodForm from "@/components/FoodForm";
import InsightsCard from "@/components/InsightsCard";
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
  type Supplement,
  type SupplementLog,
} from "@/lib/types";

type Totals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  burned: number;
};

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
  supplements,
  supplementLogs,
  insights,
  today,
  onEditProfile,
  onSignOut,
  addFood,
  removeFood,
  addFavorite,
  removeFavorite,
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
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  insights: Insight[];
  today: string;
  onEditProfile: () => void;
  onSignOut: () => void;
  addFood: (e: FoodEntry) => void;
  removeFood: (id: string) => void;
  addFavorite: (fav: Omit<FavoriteFood, "id" | "createdAt">) => void;
  removeFavorite: (id: string) => void;
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Nut<span className="text-primary">ta</span>
          </h1>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
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

      <Timeline
        foods={todayFoods}
        exercises={todayEx}
        onRemoveFood={removeFood}
        onRemoveExercise={removeExercise}
      />

      {/* Agregar manualmente (el chat es la vía principal) */}
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
    </main>
  );
}
