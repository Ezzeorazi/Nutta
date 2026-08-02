"use client";

import { useState } from "react";
import { CookingPot, Plus, User } from "lucide-react";
import Chip from "@/components/ui/Chip";
import AppHeader from "@/components/AppHeader";
import DayNavigator from "@/components/DayNavigator";
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
  dayLabel,
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
import { uid } from "@/lib/uid";
import { useToast } from "@/components/ui/Toast";

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
  // Devuelven el id del registro creado: es lo que permite ofrecer "Deshacer".
  addFood: (e: FoodEntry) => string | null;
  removeFood: (id: string) => void;
  addFavorite: (fav: Omit<FavoriteFood, "id" | "createdAt">) => void;
  removeFavorite: (id: string) => void;
  addRecipe: (name: string, items: RecipeItem[]) => void;
  removeRecipe: (id: string) => void;
  addExercise: (e: ExerciseEntry) => string | null;
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
  const toast = useToast();
  const isToday = viewDate === today;
  const waterGoal = waterGoalL(weight);
  // Timestamp del día que se está viendo: hoy usa el instante real (preserva el
  // orden del timeline); un día pasado se ancla al mediodía para no saltar a hoy.
  const stamp = () => (isToday ? Date.now() : startOfLocalDayMs(viewDate));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <AppHeader
        title={
          <>
            Nut<span className="text-primary">ta</span>
          </>
        }
        actions={
          <>
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
              className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary transition-transform duration-(--duration-fast) active:scale-95"
              aria-label="Editar perfil"
            >
              <User size={20} strokeWidth={2} aria-hidden />
            </button>
          </>
        }
        below={
          <DayNavigator
            viewDate={viewDate}
            today={today}
            onChange={setViewDate}
          />
        }
      />

      {/* El anillo es el dato principal de la pantalla: va primero y sin caja
          propia. No necesita un borde que lo separe de nada — ya es el foco. */}
      <section className="flex flex-col items-center gap-6">
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

      {/* Agregar. Estaba al fondo, debajo de seis tarjetas: la única vía de
          carga manual quedaba a varios scrolls de distancia. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">
          Agregar{isToday ? "" : ` a ${dayLabel(viewDate)}`}
        </h2>
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <Chip key={m.key} onClick={() => setFoodOpen(m.key)}>
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              {m.label}
            </Chip>
          ))}
          <Chip tone="accent" onClick={() => setExOpen(true)}>
            <Plus size={14} strokeWidth={2.5} aria-hidden />
            Ejercicio
          </Chip>
          <Chip onClick={() => setRecipesOpen(true)}>
            <CookingPot size={14} strokeWidth={2} aria-hidden />
            Recetas
          </Chip>
        </div>
      </section>

      <Timeline
        foods={todayFoods}
        exercises={todayEx}
        onRemoveFood={removeFood}
        onRemoveExercise={removeExercise}
      />

      <ScoreCard data={score} />

      {/* Insights: solo el día de hoy (mira el estado actual) */}
      {isToday && <InsightsCard insights={insights} />}

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

      <button
        onClick={onSignOut}
        className="mx-auto min-h-11 text-xs text-muted underline-offset-2 hover:underline"
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
            const fid = addFood({ ...entry, date: viewDate, createdAt: stamp() });
            setFoodOpen(null);
            const meal = MEALS.find((m) => m.key === entry.meal)?.label ?? "";
            toast(
              `${entry.name} · ${meal}`,
              fid ? { label: "Deshacer", onAction: () => removeFood(fid) } : undefined,
            );
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
            const eid = addExercise({
              ...entry,
              date: viewDate,
              createdAt: stamp(),
            });
            setExOpen(false);
            toast(
              `${entry.name} · ${entry.minutes} min`,
              eid
                ? { label: "Deshacer", onAction: () => removeExercise(eid) }
                : undefined,
            );
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
            const added: string[] = [];
            for (const it of items) {
              const fid = addFood({
                id: uid(),
                date: viewDate,
                meal,
                createdAt: stamp(),
                ...it,
              });
              if (fid) added.push(fid);
            }
            const label = MEALS.find((m) => m.key === meal)?.label ?? "";
            toast(
              `${items.length} ${items.length === 1 ? "alimento" : "alimentos"} · ${label}`,
              added.length
                ? {
                    label: "Deshacer",
                    onAction: () => added.forEach(removeFood),
                  }
                : undefined,
            );
          }}
        />
      )}
    </main>
  );
}
