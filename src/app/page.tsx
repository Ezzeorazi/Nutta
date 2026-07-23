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
import { computeGoals, waterGoalL } from "@/lib/nutrition";
import { dailyScore } from "@/lib/score";
import { buildInsights } from "@/lib/insights";
import { streakFromDates } from "@/lib/achievements";
import { frequentFoodsSummary, weeklySummary } from "@/lib/coachContext";
import { emojiForExercise, emojiForFood } from "@/lib/emoji";
import { dailySupplementProtein } from "@/lib/supplements";
import { useNutta } from "@/lib/useNutta";
import {
  DEFAULT_GOALS,
  localDateFromMs,
  todayISO,
  type ExerciseEntry,
  type FoodEntry,
  type MemoryKind,
} from "@/lib/types";

/** Registros creados en un turno del chat (para poder deshacerlos). */
type ChatBatch = { foods: string[]; exercises: string[]; sets: string[] };
const emptyBatch = (): ChatBatch => ({ foods: [], exercises: [], sets: [] });
const batchSize = (b: ChatBatch) =>
  b.foods.length + b.exercises.length + b.sets.length;

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
    customGoals,
    favorites,
    recipes,
    photos,
    targetWeight,
    profile,
    saveProfile,
    addFood,
    removeFood,
    addFavorite,
    removeFavorite,
    addRecipe,
    removeRecipe,
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
    setSupplementQty,
    addSet,
    removeSet,
    addGoal,
    removeGoal,
    addPhoto,
    removePhoto,
  } = useNutta();

  const [tab, setTab] = useState<Tab>("chat");
  const [sending, setSending] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  // Último lote registrado por el chat (para el botón "Deshacer").
  const [lastBatch, setLastBatch] = useState<ChatBatch | null>(null);
  // Día que se está mirando en el tab Hoy (hoy por defecto; se puede navegar).
  const [viewDate, setViewDate] = useState(today);

  // --- Derivados del día ---
  // El día de un registro se toma del createdAt LOCAL (con fallback a date):
  // así se corrigen registros viejos mal-fechados por el bug de UTC.
  const dayOf = (e: { date: string; createdAt?: number }) =>
    e.createdAt ? localDateFromMs(e.createdAt) : e.date;
  // Registros del día VISTO (tab Hoy).
  const viewFoods = foods.filter((f) => dayOf(f) === viewDate);
  const viewEx = exercises.filter((e) => dayOf(e) === viewDate);
  const viewMetrics = metrics.find((m) => m.date === viewDate);
  // HOY real: el chat siempre registra en el día de hoy.
  const todayMetrics = metrics.find((m) => m.date === today);
  const goals = profile ? computeGoals(profile) : DEFAULT_GOALS;

  // Proteína aportada por suplementos (ej. proteína en polvo, colágeno) el día visto.
  const viewSupplementProtein = useMemo(
    () => dailySupplementProtein(supplements, supplementLogs, viewDate),
    [supplements, supplementLogs, viewDate],
  );

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0, burned: 0 };
    for (const f of viewFoods) {
      t.calories += f.calories;
      t.protein += f.protein;
      t.carbs += f.carbs;
      t.fat += f.fat;
    }
    for (const e of viewEx) t.burned += e.caloriesBurned;
    t.protein += viewSupplementProtein;
    return t;
  }, [viewFoods, viewEx, viewSupplementProtein]);

  const waterGoal = profile ? waterGoalL(profile.weight) : undefined;
  const score = useMemo(
    () =>
      dailyScore(
        viewFoods,
        viewEx,
        goals,
        viewMetrics,
        waterGoal,
        viewSupplementProtein,
      ),
    [viewFoods, viewEx, goals, viewMetrics, waterGoal, viewSupplementProtein],
  );
  const insights = useMemo(
    () => buildInsights(foods, exercises, goals, today, supplements, supplementLogs),
    [foods, exercises, goals, today, supplements, supplementLogs],
  );
  // Racha de entrenamiento (días con cardio o fuerza) para mostrar en Hoy.
  const trainStreak = useMemo(() => {
    const days = new Set<string>();
    for (const e of exercises) days.add(e.date);
    for (const s of strengthSets) days.add(s.date);
    return streakFromDates(days, today).current;
  }, [exercises, strengthSets, today]);

  // --- Coach IA ---

  // Envía un mensaje al coach, persiste los registros que detecta y responde.
  const sendChat = async (text: string) => {
    if (!profile) return;
    addMessage("user", text);
    setLastBatch(null); // el lote anterior deja de ser "deshacible"
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
      const batch = emptyBatch();
      const logged: string[] = []; // líneas del resumen "Registrado"
      for (const f of data.foods ?? []) {
        const fid = addFood({
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
        if (fid) batch.foods.push(fid);
        logged.push(
          `${emojiForFood(f.name)} ${f.name} · ${Math.round(f.calories)} kcal · ${Math.round(f.protein)} g P`,
        );
      }
      for (const e of data.exercises ?? []) {
        const eid = addExercise({
          id: uid(),
          date: today,
          name: e.name,
          minutes: e.minutes,
          caloriesBurned: e.caloriesBurned,
        });
        if (eid) batch.exercises.push(eid);
        logged.push(
          `${emojiForExercise(e.name)} ${e.name} · ${e.minutes} min · ${Math.round(e.caloriesBurned)} kcal`,
        );
      }
      if (typeof data.bodyweight === "number" && data.bodyweight > 0) {
        addWeight(data.bodyweight, today);
        logged.push(`⚖️ Peso · ${data.bodyweight} kg`);
      }
      for (const st of data.strength ?? []) {
        const n = Math.min(20, Math.max(1, Math.round(st.sets) || 1));
        for (let i = 0; i < n; i++) {
          const sid = addSet(st.exercise, st.reps, st.weight, today);
          if (sid) batch.sets.push(sid);
        }
        logged.push(
          `🏋️ ${st.exercise} · ${n}×${st.reps}${st.weight ? ` · ${st.weight} kg` : ""}`,
        );
      }
      // Métricas de bienestar en un solo upsert (evita filas duplicadas).
      const patch: { water?: number; sleepHours?: number; steps?: number } = {};
      if (data.water && data.water > 0) {
        patch.water = (todayMetrics?.water ?? 0) + data.water;
        logged.push(`💧 Agua · +${data.water} L`);
      }
      if (data.sleepHours && data.sleepHours > 0) {
        patch.sleepHours = data.sleepHours;
        logged.push(`😴 Sueño · ${data.sleepHours} h`);
      }
      if (data.steps && data.steps > 0) {
        patch.steps = data.steps;
        logged.push(`👣 Pasos · ${data.steps.toLocaleString("es-AR")}`);
      }
      if (Object.keys(patch).length) setMetric(today, patch);
      for (const r of data.remember ?? []) {
        if (r?.text?.trim()) addMemory(r.kind, r.text);
      }
      const summary = logged.length
        ? `${data.reply || "Listo ✅"}\n\n📝 Registrado:\n${logged.join("\n")}`
        : data.reply || "Listo ✅";
      addMessage("assistant", summary);
      // Solo se puede deshacer lo que tiene id propio (comidas, cardio, series).
      setLastBatch(batchSize(batch) > 0 ? batch : null);
    } catch {
      addMessage(
        "assistant",
        "Uy, no pude procesar eso ahora 😅 Probá de nuevo en un momento.",
      );
    } finally {
      setSending(false);
    }
  };

  // Deshace el último lote que registró el chat.
  const undoLastBatch = () => {
    if (!lastBatch) return;
    for (const id of lastBatch.foods) removeFood(id);
    for (const id of lastBatch.exercises) removeExercise(id);
    for (const id of lastBatch.sets) removeSet(id);
    setLastBatch(null);
    addMessage("assistant", "Listo, deshice ese registro ↩️");
  };

  // Pide al coach un análisis de la última semana y lo publica en el chat.
  const runWeeklyAnalysis = async () => {
    if (!profile || sending) return;
    setTab("chat");
    setLastBatch(null);
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
    <div className="flex flex-1 items-center justify-center">
      <div className="animate-pulse text-3xl font-bold">
        Nut<span className="text-primary">ta</span>
      </div>
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
          canUndo={!!lastBatch}
          onUndo={undoLastBatch}
        />
      ) : tab === "gym" ? (
        <GymTab
          strengthSets={strengthSets}
          exercises={exercises}
          today={today}
          onAddSet={addSet}
          onRemoveSet={removeSet}
        />
      ) : tab === "progreso" ? (
        <ProgresoTab
          weights={weights}
          targetWeight={targetWeight}
          measures={measures}
          photos={photos}
          strengthSets={strengthSets}
          customGoals={customGoals}
          today={today}
          addWeight={addWeight}
          setTargetWeight={setTargetWeight}
          addMeasure={addMeasure}
          addPhoto={addPhoto}
          removePhoto={removePhoto}
          addGoal={addGoal}
          removeGoal={removeGoal}
        />
      ) : tab === "historial" ? (
        <History
          foods={foods}
          exercises={exercises}
          goals={goals}
          strengthSets={strengthSets}
          weights={weights}
          metrics={metrics}
          measures={measures}
          customGoals={customGoals}
          photos={photos}
          supplements={supplements}
          supplementLogs={supplementLogs}
          targetWeight={targetWeight}
          today={today}
        />
      ) : (
        <HoyTab
          weight={profile.weight}
          score={score}
          totals={totals}
          goals={goals}
          todayMetrics={viewMetrics}
          todayFoods={viewFoods}
          todayEx={viewEx}
          foods={foods}
          favorites={favorites}
          recipes={recipes}
          supplements={supplements}
          supplementLogs={supplementLogs}
          insights={insights}
          streak={trainStreak}
          today={today}
          viewDate={viewDate}
          setViewDate={setViewDate}
          onEditProfile={() => setEditProfile(true)}
          onSignOut={() => db.auth.signOut()}
          addFood={addFood}
          removeFood={removeFood}
          addFavorite={addFavorite}
          removeFavorite={removeFavorite}
          addRecipe={addRecipe}
          removeRecipe={removeRecipe}
          addExercise={addExercise}
          removeExercise={removeExercise}
          setMetric={setMetric}
          addSupplement={addSupplement}
          removeSupplement={removeSupplement}
          toggleSupplement={toggleSupplement}
          setSupplementQty={setSupplementQty}
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
