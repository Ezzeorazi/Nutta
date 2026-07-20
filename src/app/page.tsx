"use client";

import { useMemo, useState } from "react";
import BottomNav, { type Tab } from "@/components/BottomNav";
import CalorieRing from "@/components/CalorieRing";
import ExerciseForm from "@/components/ExerciseForm";
import FoodForm from "@/components/FoodForm";
import History from "@/components/History";
import MacroBar from "@/components/MacroBar";
import Login from "@/components/Login";
import Onboarding from "@/components/Onboarding";
import { db } from "@/lib/db";
import { computeGoals } from "@/lib/nutrition";
import { useNutta } from "@/lib/useNutta";
import { DEFAULT_GOALS, MEALS, todayISO, type MealType } from "@/lib/types";

export default function Home() {
  const today = todayISO();

  const {
    authLoading,
    dataLoading,
    user,
    foods,
    exercises,
    profile,
    saveProfile,
    addFood,
    removeFood,
    addExercise,
    removeExercise,
  } = useNutta();

  const [foodOpen, setFoodOpen] = useState<MealType | null>(null);
  const [exOpen, setExOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [tab, setTab] = useState<Tab>("hoy");

  const todayFoods = foods.filter((f) => f.date === today);
  const todayEx = exercises.filter((e) => e.date === today);

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0, burned: 0 };
    for (const f of todayFoods) {
      t.calories += f.calories;
      t.protein += f.protein;
      t.carbs += f.carbs;
      t.fat += f.fat;
    }
    for (const e of todayEx) t.burned += e.caloriesBurned;
    return t;
  }, [todayFoods, todayEx]);

  const goals = profile ? computeGoals(profile) : DEFAULT_GOALS;

  const splash = (
    <div className="flex flex-1 items-center justify-center text-3xl font-bold">
      Nut<span className="text-primary">ta</span>
    </div>
  );

  if (authLoading) return splash;
  if (!user) return <Login />;
  if (dataLoading) return splash;

  // Primera vez: sin perfil → onboarding a pantalla completa.
  if (!profile) {
    return <Onboarding onDone={saveProfile} />;
  }
  if (editProfile) {
    return (
      <Onboarding
        initial={profile}
        onDone={(p) => {
          saveProfile(p);
          setEditProfile(false);
        }}
        onCancel={() => setEditProfile(false)}
      />
    );
  }

  return (
    <>
      {tab === "historial" ? (
        <History foods={foods} exercises={exercises} goals={goals} />
      ) : (
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
              onClick={() => setEditProfile(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary active:scale-95"
              aria-label="Editar perfil"
            >
              N
            </button>
          </header>

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

          {/* Comidas */}
          <section className="flex flex-col gap-3">
            {MEALS.map((m) => {
              const items = todayFoods.filter((f) => f.meal === m.key);
              const kcal = Math.round(
                items.reduce((s, f) => s + f.calories, 0),
              );
              return (
                <div
                  key={m.key}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">{m.label}</h2>
                      <span className="text-xs text-muted tabular-nums">
                        {kcal} kcal
                      </span>
                    </div>
                    <button
                      onClick={() => setFoodOpen(m.key)}
                      className="grid h-8 w-8 place-items-center rounded-full bg-primary text-lg leading-none text-primary-foreground active:scale-95"
                      aria-label={`Agregar a ${m.label}`}
                    >
                      +
                    </button>
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {items.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {f.name}{" "}
                            <span className="text-muted">· {f.qty} g</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="tabular-nums text-muted">
                              {Math.round(f.calories)} kcal
                            </span>
                            <button
                              onClick={() => removeFood(f.id)}
                              className="text-muted hover:text-accent"
                              aria-label="Eliminar"
                            >
                              ×
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>

          {/* Ejercicio */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Ejercicio</h2>
                <span className="text-xs text-muted tabular-nums">
                  {Math.round(totals.burned)} kcal quemadas
                </span>
              </div>
              <button
                onClick={() => setExOpen(true)}
                className="grid h-8 w-8 place-items-center rounded-full bg-accent text-lg leading-none text-accent-foreground active:scale-95"
                aria-label="Agregar ejercicio"
              >
                +
              </button>
            </div>
            {todayEx.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {todayEx.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {e.name}{" "}
                      <span className="text-muted">· {e.minutes} min</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums text-muted">
                        {Math.round(e.caloriesBurned)} kcal
                      </span>
                      <button
                        onClick={() => removeExercise(e.id)}
                        className="text-muted hover:text-accent"
                        aria-label="Eliminar"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button
            onClick={() => db.auth.signOut()}
            className="mx-auto text-xs text-muted underline-offset-2 hover:underline"
          >
            Cerrar sesión
          </button>

          {foodOpen && (
            <FoodForm
              meal={foodOpen}
              onClose={() => setFoodOpen(null)}
              onAdd={(entry) => {
                addFood(entry);
                setFoodOpen(null);
              }}
            />
          )}
          {exOpen && (
            <ExerciseForm
              weight={profile.weight}
              onClose={() => setExOpen(false)}
              onAdd={(entry) => {
                addExercise(entry);
                setExOpen(false);
              }}
            />
          )}
        </main>
      )}
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}
