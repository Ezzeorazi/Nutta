"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import BottomNav, { type Tab } from "@/components/BottomNav";
import AppProviders from "@/components/ui/AppProviders";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import Chat from "@/components/Chat";
import GymTab from "@/components/GymTab";
import History from "@/components/History";
import HoyTab from "@/components/HoyTab";
import MemorySheet from "@/components/MemorySheet";
import ProgresoTab from "@/components/ProgresoTab";
import Login from "@/components/Login";
import Onboarding from "@/components/Onboarding";
import { uid } from "@/lib/uid";
import { formatLog } from "@/lib/chatLog";
import { db } from "@/lib/db";
import { computeGoals, effectiveWeight, waterGoalL } from "@/lib/nutrition";
import { buildAthleteState } from "@/lib/athlete";
import { dailyScore } from "@/lib/score";
import { buildInsights } from "@/lib/insights";
import { frequentFoodsSummary, weeklySummary } from "@/lib/coachContext";
import { emojiForExercise, emojiForFood } from "@/lib/emoji";
import { PLAN_GOALS, PLAN_TARGET_WEIGHT } from "@/lib/plan";
import { usePlanReminders } from "@/lib/usePlanReminders";
import { useNutta } from "@/lib/useNutta";
import {
  DEFAULT_GOALS,
  localDateFromMs,
  shiftISO,
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
    drinks,
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
    addDrink,
    removeDrink,
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
    updateSet,
    addGoal,
    removeGoal,
    addPhoto,
    removePhoto,
  } = useNutta();

  const [tab, setTab] = useState<Tab>("chat");
  // Posición de scroll de cada tab. Como cada pantalla se desmonta al cambiar,
  // sin esto volver a un tab te dejaba arriba de todo, perdiendo dónde estabas.
  const scrollByTab = useRef<Partial<Record<Tab, number>>>({});

  const changeTab = (next: Tab) => {
    if (next === tab) return;
    scrollByTab.current[tab] = window.scrollY;
    setTab(next);
  };

  useEffect(() => {
    // El chat se auto-scrollea al último mensaje; restaurarle la posición
    // pelearía con eso y lo dejaría a mitad de la conversación.
    if (tab === "chat") return;
    window.scrollTo(0, scrollByTab.current[tab] ?? 0);
  }, [tab]);

  const [sending, setSending] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  // Último lote registrado por el chat (para el botón "Deshacer").
  const [lastBatch, setLastBatch] = useState<ChatBatch | null>(null);
  // Día que se está mirando en el tab Hoy (hoy por defecto; se puede navegar).
  const [viewDate, setViewDate] = useState(today);

  // Metas del plan de agosto activas por defecto (pisan a las calculadas del
  // perfil). Preferencia local, como el descarte de sugerencia de rutina: no
  // hace falta sincronizarla entre dispositivos para un solo usuario.
  const [planActive, setPlanActive] = useState(() =>
    typeof window === "undefined"
      ? true
      : localStorage.getItem("nutta.planActive") !== "0",
  );
  const togglePlan = () =>
    setPlanActive((p) => {
      const next = !p;
      try {
        localStorage.setItem("nutta.planActive", next ? "1" : "0");
      } catch {
        // sin localStorage: la preferencia no persiste, pero no rompe nada
      }
      return next;
    });

  // --- Derivados del día ---
  // El día de un registro se toma del createdAt LOCAL (con fallback a date):
  // así se corrigen registros viejos mal-fechados por el bug de UTC.
  const dayOf = (e: { date: string; createdAt?: number }) =>
    e.createdAt ? localDateFromMs(e.createdAt) : e.date;
  // Registros del día VISTO (tab Hoy).
  const viewFoods = foods.filter((f) => dayOf(f) === viewDate);
  const viewDrinks = drinks.filter((d) => dayOf(d) === viewDate);
  const viewEx = exercises.filter((e) => dayOf(e) === viewDate);
  const viewMetrics = metrics.find((m) => m.date === viewDate);
  // HOY real: el chat siempre registra en el día de hoy.
  const todayMetrics = metrics.find((m) => m.date === today);

  // El peso que manda es el de la BALANZA, no el del formulario del onboarding
  // (que se completa una vez y queda viejo). De él dependen las metas, el agua
  // y las calorías de todo el ejercicio.
  const bodyWeight = effectiveWeight(profile?.weight ?? 0, weights, today);
  const goals = !profile
    ? DEFAULT_GOALS
    : planActive
      ? PLAN_GOALS
      : computeGoals({ ...profile, weight: bodyWeight });

  const waterGoal = bodyWeight > 0 ? waterGoalL(bodyWeight) : undefined;

  // Semilla única de la meta de peso del plan: solo si el usuario todavía no
  // cargó una propia (no la pisa si ya la eligió en Progreso).
  useEffect(() => {
    if (profile && targetWeight == null) setTargetWeight(PLAN_TARGET_WEIGHT);
  }, [profile, targetWeight, setTargetWeight]);

  // --- Estado del atleta ---
  // Todo lo que se sabe del usuario, cruzado en un solo lugar (lib/athlete.ts).
  // De acá salen el score, el panel de estado, las metas dinámicas y la
  // recomendación pre-entreno: antes cada módulo veía su rebanada y por eso el
  // score ignoraba las series de fuerza y la rutina ignoraba el sueño.
  // Hora local, para que la capa pura (que no mira el reloj) sepa si el día
  // sigue abierto: a las 15 h "faltan 1.100 kcal" no es un déficit, es un día
  // sin terminar. Se recalcula en cada render; solo cambia el estado al pasar
  // de hora.
  const hour = new Date().getHours();
  const objective = profile?.objective;
  const athleteBase = useMemo(
    () => ({
      foods,
      drinks,
      exercises,
      strengthSets,
      metrics,
      supplements,
      supplementLogs,
      goals,
      bodyWeight,
      today,
      objective,
      hour,
    }),
    [
      foods,
      drinks,
      exercises,
      strengthSets,
      metrics,
      supplements,
      supplementLogs,
      goals,
      bodyWeight,
      today,
      objective,
      hour,
    ],
  );
  // El estado de HOY manda la rutina del Gym; el del día VISTO, el tab Hoy.
  const todayState = useMemo(
    () => buildAthleteState({ ...athleteBase, date: today }),
    [athleteBase, today],
  );
  const viewState = useMemo(
    () =>
      viewDate === today
        ? todayState
        : buildAthleteState({ ...athleteBase, date: viewDate }),
    [athleteBase, todayState, viewDate, today],
  );

  // Avisos del plan: se calculan siempre sobre HOY (no el día que se está
  // navegando en el tab Hoy), y el hook decide cuándo dispararlos de verdad.
  const {
    permission: notifPermission,
    requestPermission: requestNotifPermission,
    sendTest: sendTestNotif,
  } = usePlanReminders(todayState, today);

  const score = useMemo(
    () => dailyScore(viewState, viewFoods),
    [viewState, viewFoods],
  );
  const insights = useMemo(
    () =>
      buildInsights({
        foods,
        exercises,
        strengthSets,
        metrics,
        supplements,
        supplementLogs,
        goals,
        today,
        waterGoal,
        profile,
      }),
    [
      foods,
      exercises,
      strengthSets,
      metrics,
      supplements,
      supplementLogs,
      goals,
      today,
      waterGoal,
      profile,
    ],
  );
  // Racha de entrenamiento (días con cardio o fuerza) para mostrar en Hoy. Un
  // día marcado como descanso no suma —no entrenaste— pero tampoco la corta:
  // descansar cuando toca es seguir el plan, no abandonarlo. Por eso no alcanza
  // con `streakFromDates`, que solo sabe de días presentes o ausentes.
  const trainStreak = useMemo(() => {
    const trained = new Set<string>();
    for (const e of exercises) trained.add(e.date);
    for (const s of strengthSets) trained.add(s.date);
    const rest = new Set(metrics.filter((m) => m.restDay).map((m) => m.date));
    const counts = (d: string) => trained.has(d) && !rest.has(d);
    // Se permite que hoy todavía no tenga nada: la racha viene de ayer.
    let cursor = trained.has(today) || rest.has(today) ? today : shiftISO(today, -1);
    let n = 0;
    while (trained.has(cursor) || rest.has(cursor)) {
      if (counts(cursor)) n++;
      cursor = shiftISO(cursor, -1);
    }
    return n;
  }, [exercises, strengthSets, metrics, today]);

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
          weight: bodyWeight,
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
      addMessage("assistant", formatLog(data.reply || "Listo ✅", logged));
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
    changeTab("chat");
    setLastBatch(null);
    addMessage("user", "📊 Analizá mi semana");
    setSending(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: weeklySummary({
            foods,
            exercises,
            strengthSets,
            metrics,
            weights,
            measures,
            goals,
            objective: profile.objective,
            today,
          }),
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
  // Ya sabemos que hay sesión: en vez de texto pulsando, se dibuja la forma de
  // lo que viene, así la pantalla no salta cuando llegan los datos.
  if (dataLoading) return <ScreenSkeleton />;

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
    <AppProviders>
      {/* Crossfade al cambiar de tab. Se anima solo la opacidad, a propósito:
          un `transform` acá convertiría al contenedor en bloque contenedor de
          sus descendientes `fixed` y descolocaría la barra de entrada del chat.
          La dirección del movimiento la comunica la píldora de la nav. */}
      <motion.div
        key={tab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.21, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-1 flex-col"
      >
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
          metrics={metrics}
          today={today}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onEditSet={updateSet}
          onAddExercise={addExercise}
          onRemoveExercise={removeExercise}
          onSetRestDay={(date, rest) => setMetric(date, { restDay: rest })}
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
          weight={bodyWeight}
          state={viewState}
          score={score}
          todayMetrics={viewMetrics}
          todayFoods={viewFoods}
          todayEx={viewEx}
          todayDrinks={viewDrinks}
          foods={foods}
          drinks={drinks}
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
          addDrink={addDrink}
          removeDrink={removeDrink}
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
          planActive={planActive}
          onTogglePlan={togglePlan}
          notifPermission={notifPermission}
          onRequestNotifPermission={requestNotifPermission}
          onTestNotif={sendTestNotif}
        />
        )}
      </motion.div>
      {memoryOpen && (
        <MemorySheet
          memories={memories}
          onAdd={addMemory}
          onRemove={removeMemory}
          onClose={() => setMemoryOpen(false)}
        />
      )}
      <BottomNav tab={tab} onChange={changeTab} />
    </AppProviders>
  );
}
