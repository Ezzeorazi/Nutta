"use client";

import { useMemo, useState } from "react";
import BottomNav, { type Tab } from "@/components/BottomNav";
import CalorieRing from "@/components/CalorieRing";
import Chat from "@/components/Chat";
import ExerciseForm from "@/components/ExerciseForm";
import FoodForm from "@/components/FoodForm";
import History from "@/components/History";
import InsightsCard from "@/components/InsightsCard";
import MacroBar from "@/components/MacroBar";
import MemorySheet from "@/components/MemorySheet";
import ScoreCard from "@/components/ScoreCard";
import Timeline from "@/components/Timeline";
import WeightPanel from "@/components/WeightPanel";
import WellbeingCard from "@/components/WellbeingCard";
import Login from "@/components/Login";
import Onboarding from "@/components/Onboarding";
import { uid } from "@/components/Sheet";
import { db } from "@/lib/db";
import { computeGoals } from "@/lib/nutrition";
import { dailyScore } from "@/lib/score";
import { buildInsights } from "@/lib/insights";
import { frequentFoodsSummary, weeklySummary } from "@/lib/coachContext";
import { useNutta } from "@/lib/useNutta";
import {
  DEFAULT_GOALS,
  MEALS,
  todayISO,
  type ExerciseEntry,
  type FoodEntry,
  type MealType,
  type MemoryKind,
} from "@/lib/types";

export default function Home() {
  const today = todayISO();

  const {
    authLoading,
    dataLoading,
    user,
    foods,
    exercises,
    messages,
    memories,
    weights,
    metrics,
    targetWeight,
    profile,
    saveProfile,
    addFood,
    removeFood,
    addExercise,
    removeExercise,
    addMessage,
    addMemory,
    removeMemory,
    addWeight,
    setTargetWeight,
    setMetric,
  } = useNutta();

  const [foodOpen, setFoodOpen] = useState<MealType | null>(null);
  const [exOpen, setExOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [sending, setSending] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  // Envía un mensaje al coach IA, persiste los registros y responde.
  const sendChat = async (text: string) => {
    if (!profile) return;
    addMessage("user", text);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          weight: profile.weight,
          hour: new Date().getHours(),
          memories: memories.map((m) => ({ kind: m.kind, text: m.text })),
          frequent: frequentFoodsSummary(foods),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        foods?: FoodEntry[];
        exercises?: ExerciseEntry[];
        bodyweight?: number;
        water?: number;
        sleepHours?: number;
        steps?: number;
        remember?: { kind: MemoryKind; text: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? "error");
      for (const f of data.foods ?? []) {
        addFood({
          id: uid(),
          date: today,
          meal: f.meal,
          name: f.name,
          qty: f.qty,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
        });
      }
      for (const e of data.exercises ?? []) {
        addExercise({
          id: uid(),
          date: today,
          name: e.name,
          minutes: e.minutes,
          caloriesBurned: e.caloriesBurned,
        });
      }
      if (typeof data.bodyweight === "number" && data.bodyweight > 0) {
        addWeight(data.bodyweight, today);
      }
      // Métricas de bienestar en un solo upsert (evita filas duplicadas).
      const patch: {
        water?: number;
        sleepHours?: number;
        steps?: number;
      } = {};
      if (data.water && data.water > 0)
        patch.water = (todayMetrics?.water ?? 0) + data.water;
      if (data.sleepHours && data.sleepHours > 0)
        patch.sleepHours = data.sleepHours;
      if (data.steps && data.steps > 0) patch.steps = data.steps;
      if (Object.keys(patch).length) setMetric(today, patch);
      for (const r of data.remember ?? []) {
        if (r?.text?.trim()) addMemory(r.kind, r.text);
      }
      addMessage("assistant", data.reply || "Listo ✅");
    } catch {
      addMessage(
        "assistant",
        "Uy, no pude procesar eso ahora 😅 Probá de nuevo en un momento.",
      );
    } finally {
      setSending(false);
    }
  };

  // Pide al Coach IA un análisis de la última semana y lo publica en el chat.
  const runWeeklyAnalysis = async () => {
    if (!profile || sending) return;
    setTab("chat");
    addMessage("user", "📊 Analizá mi semana");
    setSending(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: weeklySummary(foods, exercises, goals, today),
          memories: memories.map((m) => ({ kind: m.kind, text: m.text })),
        }),
      });
      const data = (await res.json()) as { analysis?: string; error?: string };
      if (!res.ok) throw new Error(data?.error ?? "error");
      addMessage("assistant", data.analysis || "No tengo suficientes datos aún.");
    } catch {
      addMessage(
        "assistant",
        "Uy, no pude generar el análisis ahora 😅 Probá de nuevo en un momento.",
      );
    } finally {
      setSending(false);
    }
  };

  const todayFoods = foods.filter((f) => f.date === today);
  const todayEx = exercises.filter((e) => e.date === today);
  const todayMetrics = metrics.find((m) => m.date === today);

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
  const score = useMemo(
    () => dailyScore(todayFoods, todayEx, goals, todayMetrics),
    [todayFoods, todayEx, goals, todayMetrics],
  );
  const insights = useMemo(
    () => buildInsights(foods, exercises, goals, today),
    [foods, exercises, goals, today],
  );

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
      {tab === "chat" ? (
        <Chat
          messages={messages}
          onSend={sendChat}
          sending={sending}
          onOpenMemory={() => setMemoryOpen(true)}
          onAnalyze={runWeeklyAnalysis}
        />
      ) : tab === "progreso" ? (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
          <header>
            <h1 className="text-2xl font-bold">Progreso</h1>
            <p className="text-sm text-muted">Tu peso y su evolución</p>
          </header>
          <WeightPanel
            weights={weights}
            targetWeight={targetWeight}
            onAdd={addWeight}
            onSetTarget={setTargetWeight}
            today={today}
          />
        </main>
      ) : tab === "historial" ? (
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
          />

          <InsightsCard insights={insights} />

          {/* Timeline cronológico del día */}
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
      {memoryOpen && (
        <MemorySheet
          memories={memories}
          onAdd={addMemory}
          onRemove={removeMemory}
          onClose={() => setMemoryOpen(false)}
        />
      )}
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}
