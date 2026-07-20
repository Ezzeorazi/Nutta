"use client";

import { useEffect } from "react";
import { db, id } from "@/lib/db";
import type { Profile } from "@/lib/nutrition";
import type {
  ChatMessage,
  ExerciseEntry,
  FoodEntry,
  MemoryFact,
  MemoryKind,
  WeightEntry,
} from "@/lib/types";

/**
 * Capa de datos de Nutta sobre InstantDB.
 *
 * Centraliza auth, la query de las entidades del usuario, el filtrado por
 * `owner` (se consulta sin `where` y se filtra en cliente, ver db.ts) y las
 * mutaciones. Antes vivía todo dentro de page.tsx; extraerlo permite crecer
 * sin volver frágil la pantalla principal.
 */
export function useNutta() {
  const { isLoading: authLoading, user } = db.useAuth();
  const { isLoading: dataLoading, data } = db.useQuery(
    user
      ? {
          profiles: {},
          foods: {},
          exercises: {},
          messages: {},
          memories: {},
          weights: {},
        }
      : null,
  );

  const owner = user?.id;

  const foods = (
    (data?.foods ?? []) as unknown as (FoodEntry & { owner: string })[]
  ).filter((f) => f.owner === owner);
  const exercises = (
    (data?.exercises ?? []) as unknown as (ExerciseEntry & { owner: string })[]
  ).filter((e) => e.owner === owner);
  const messages = (
    (data?.messages ?? []) as unknown as (ChatMessage & { owner: string })[]
  )
    .filter((m) => m.owner === owner)
    .sort((a, b) => a.createdAt - b.createdAt);
  const memories = (
    (data?.memories ?? []) as unknown as (MemoryFact & { owner: string })[]
  )
    .filter((m) => m.owner === owner)
    .sort((a, b) => b.createdAt - a.createdAt);
  const weights = (
    (data?.weights ?? []) as unknown as (WeightEntry & { owner: string })[]
  )
    .filter((w) => w.owner === owner)
    .sort((a, b) => a.date.localeCompare(b.date));
  const profileRec = (
    (data?.profiles ?? []) as unknown as (Profile & {
      id: string;
      owner: string;
    })[]
  ).find((p) => p.owner === owner);
  const profileId = profileRec?.id;
  const profile = (profileRec
    ? {
        sex: profileRec.sex,
        age: profileRec.age,
        weight: profileRec.weight,
        height: profileRec.height,
        activity: profileRec.activity,
        objective: profileRec.objective,
      }
    : null) as Profile | null;

  // Migración única de los datos locales (localStorage) a la cuenta.
  useEffect(() => {
    if (!user || dataLoading) return;
    if (localStorage.getItem("nutta.migrated")) return;
    try {
      const lsFoods = JSON.parse(localStorage.getItem("nutta.foods") || "[]");
      const lsEx = JSON.parse(localStorage.getItem("nutta.exercises") || "[]");
      const lsProfile = JSON.parse(
        localStorage.getItem("nutta.profile") || "null",
      );
      const txns = [];
      for (const f of lsFoods) {
        txns.push(
          db.tx.foods[id()].update({
            owner: user.id,
            date: f.date,
            meal: f.meal,
            name: f.name,
            qty: f.qty,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
          }),
        );
      }
      for (const e of lsEx) {
        txns.push(
          db.tx.exercises[id()].update({
            owner: user.id,
            date: e.date,
            name: e.name,
            minutes: e.minutes,
            caloriesBurned: e.caloriesBurned,
          }),
        );
      }
      if (lsProfile && !profileId) {
        txns.push(
          db.tx.profiles[id()].update({
            owner: user.id,
            sex: lsProfile.sex,
            age: lsProfile.age,
            weight: lsProfile.weight,
            height: lsProfile.height,
            activity: lsProfile.activity,
            objective: lsProfile.objective,
          }),
        );
      }
      localStorage.setItem("nutta.migrated", "1");
      if (txns.length) db.transact(txns);
    } catch {
      // si algo falla, no bloquea la app
    }
  }, [user, dataLoading, profileId]);

  const saveProfile = (p: Profile) => {
    if (!user) return;
    if (profileId) db.transact(db.tx.profiles[profileId].update(p));
    else db.transact(db.tx.profiles[id()].update({ owner: user.id, ...p }));
  };

  const addFood = (entry: FoodEntry) => {
    if (!user) return;
    db.transact(
      db.tx.foods[id()].update({
        owner: user.id,
        date: entry.date,
        meal: entry.meal,
        name: entry.name,
        qty: entry.qty,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        createdAt: entry.createdAt ?? Date.now(),
      }),
    );
  };
  const removeFood = (fid: string) => db.transact(db.tx.foods[fid].delete());

  const addExercise = (entry: ExerciseEntry) => {
    if (!user) return;
    db.transact(
      db.tx.exercises[id()].update({
        owner: user.id,
        date: entry.date,
        name: entry.name,
        minutes: entry.minutes,
        caloriesBurned: entry.caloriesBurned,
        createdAt: entry.createdAt ?? Date.now(),
      }),
    );
  };
  const removeExercise = (eid: string) =>
    db.transact(db.tx.exercises[eid].delete());

  /** Agrega un mensaje al historial del chat. Devuelve su id. */
  const addMessage = (role: ChatMessage["role"], text: string) => {
    if (!user) return null;
    const mid = id();
    db.transact(
      db.tx.messages[mid].update({
        owner: user.id,
        role,
        text,
        createdAt: Date.now(),
      }),
    );
    return mid;
  };
  const removeMessage = (mid: string) =>
    db.transact(db.tx.messages[mid].delete());

  /** Guarda un hecho en la memoria del usuario (evita duplicar textos iguales). */
  const addMemory = (kind: MemoryKind, text: string) => {
    if (!user) return null;
    const clean = text.trim();
    if (!clean) return null;
    const dup = memories.find(
      (m) => m.kind === kind && m.text.toLowerCase() === clean.toLowerCase(),
    );
    if (dup) return dup.id;
    const mid = id();
    db.transact(
      db.tx.memories[mid].update({
        owner: user.id,
        kind,
        text: clean,
        createdAt: Date.now(),
      }),
    );
    return mid;
  };
  const removeMemory = (mid: string) =>
    db.transact(db.tx.memories[mid].delete());

  const targetWeight = (
    profileRec as unknown as { targetWeight?: number } | undefined
  )?.targetWeight;
  const setTargetWeight = (kg: number) => {
    if (!profileId) return;
    db.transact(db.tx.profiles[profileId].update({ targetWeight: kg }));
  };

  /** Registra el peso del día (upsert: si ya hay uno ese día, lo actualiza). */
  const addWeight = (kg: number, date: string) => {
    if (!user || !(kg > 0)) return;
    const existing = weights.find((w) => w.date === date) as
      | (WeightEntry & { id: string })
      | undefined;
    const wid = existing?.id ?? id();
    db.transact(
      db.tx.weights[wid].update({
        owner: user.id,
        date,
        kg,
        createdAt: Date.now(),
      }),
    );
  };
  const removeWeight = (wid: string) =>
    db.transact(db.tx.weights[wid].delete());

  return {
    authLoading,
    dataLoading,
    user,
    foods,
    exercises,
    messages,
    memories,
    weights,
    targetWeight,
    profile,
    profileId,
    saveProfile,
    addFood,
    removeFood,
    addExercise,
    removeExercise,
    addMessage,
    removeMessage,
    addMemory,
    removeMemory,
    addWeight,
    removeWeight,
    setTargetWeight,
  };
}
