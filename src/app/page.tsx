"use client";

import { useMemo, useState } from "react";
import BottomNav, { type Tab } from "@/components/BottomNav";
import Chat from "@/components/Chat";
import GymTab from "@/components/GymTab";
import History from "@/components/History";
import HoyTab from "@/components/HoyTab";
import MemorySheet from "@/components/MemorySheet";
import ProgresoTab from "@/components/ProgresoTab";
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
  todayISO,
  type ExerciseEntry,
  type FoodEntry,
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
    measures,
    supplements,
    supplementLogs,
    strengthSets,
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
    addMeasure,
    addSupplement,
    removeSupplement,
    toggleSupplement,
    addSet,
    removeSet,
  } = useNutta();

  const [tab, setTab] = useState<Tab>("chat");
  const [sending, setSending] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  // --- Derivados del día ---
  const todayFoods = foods.filter((f) => f.date === today);
  const todayEx = exercises.filter((e) => e.date === today);
  const todayMetrics = metrics.find((m) => m.date === today);
  const goals = profile ? computeGoals(profile) : DEFAULT_GOALS;

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

  const score = useMemo(
    () => dailyScore(todayFoods, todayEx, goals, todayMetrics),
    [todayFoods, todayEx, goals, todayMetrics],
  );
  const insights = useMemo(
    () => buildInsights(foods, exercises, goals, today),
    [foods, exercises, goals, today],
  );

  // --- Coach IA ---

  // Envía un mensaje al coach, persiste los registros que detecta y responde.
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
        strength?: {
          exercise: string;
          sets: number;
          reps: number;
          weight: number;
        }[];
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
      for (const st of data.strength ?? []) {
        const n = Math.min(20, Math.max(1, Math.round(st.sets) || 1));
        for (let i = 0; i < n; i++) {
          addSet(st.exercise, st.reps, st.weight, today);
        }
      }
      // Métricas de bienestar en un solo upsert (evita filas duplicadas).
      const patch: { water?: number; sleepHours?: number; steps?: number } = {};
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

  // Pide al coach un análisis de la última semana y lo publica en el chat.
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
      addMessage(
        "assistant",
        data.analysis || "No tengo suficientes datos aún.",
      );
    } catch {
      addMessage(
        "assistant",
        "Uy, no pude generar el análisis ahora 😅 Probá de nuevo en un momento.",
      );
    } finally {
      setSending(false);
    }
  };

  const splash = (
    <div className="flex flex-1 items-center justify-center text-3xl font-bold">
      Nut<span className="text-primary">ta</span>
    </div>
  );

  if (authLoading) return splash;
  if (!user) return <Login />;
  if (dataLoading) return splash;

  // Primera vez: sin perfil → onboarding a pantalla completa.
  if (!profile) return <Onboarding onDone={saveProfile} />;
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
      ) : tab === "gym" ? (
        <GymTab
          strengthSets={strengthSets}
          today={today}
          onAddSet={addSet}
          onRemoveSet={removeSet}
        />
      ) : tab === "progreso" ? (
        <ProgresoTab
          weights={weights}
          targetWeight={targetWeight}
          measures={measures}
          today={today}
          addWeight={addWeight}
          setTargetWeight={setTargetWeight}
          addMeasure={addMeasure}
        />
      ) : tab === "historial" ? (
        <History foods={foods} exercises={exercises} goals={goals} />
      ) : (
        <HoyTab
          weight={profile.weight}
          score={score}
          totals={totals}
          goals={goals}
          todayMetrics={todayMetrics}
          todayFoods={todayFoods}
          todayEx={todayEx}
          supplements={supplements}
          supplementLogs={supplementLogs}
          insights={insights}
          today={today}
          onEditProfile={() => setEditProfile(true)}
          onSignOut={() => db.auth.signOut()}
          addFood={addFood}
          removeFood={removeFood}
          addExercise={addExercise}
          removeExercise={removeExercise}
          setMetric={setMetric}
          addSupplement={addSupplement}
          removeSupplement={removeSupplement}
          toggleSupplement={toggleSupplement}
        />
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
