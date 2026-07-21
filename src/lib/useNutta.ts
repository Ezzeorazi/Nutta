"use client";

import { useEffect, useState } from "react";
import { db, id } from "@/lib/db";
import { downscaleImage } from "@/lib/image";
import type { Profile } from "@/lib/nutrition";
import type {
  BodyPart,
  ChatMessage,
  CustomGoal,
  DailyMetrics,
  ExerciseEntry,
  FavoriteFood,
  FoodEntry,
  GoalKind,
  MeasureEntry,
  MemoryFact,
  MemoryKind,
  PhotoEntry,
  Recipe,
  RecipeItem,
  StrengthSet,
  Supplement,
  SupplementLog,
  WeightEntry,
} from "@/lib/types";

/** Foto de progreso con la URL ya resuelta desde $files. */
export type ResolvedPhoto = PhotoEntry & { url?: string };

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
          metrics: {},
          measures: {},
          supplements: {},
          supplementLogs: {},
          strengthSets: {},
          customGoals: {},
          favorites: {},
          recipes: {},
          photos: {},
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
  const metrics = (
    (data?.metrics ?? []) as unknown as (DailyMetrics & { owner: string })[]
  ).filter((m) => m.owner === owner);
  const measures = (
    (data?.measures ?? []) as unknown as (MeasureEntry & { owner: string })[]
  )
    .filter((m) => m.owner === owner)
    .sort((a, b) => a.date.localeCompare(b.date));
  const supplements = (
    (data?.supplements ?? []) as unknown as (Supplement & { owner: string })[]
  )
    .filter((s) => s.owner === owner)
    .sort((a, b) => a.createdAt - b.createdAt);
  const supplementLogs = (
    (data?.supplementLogs ?? []) as unknown as (SupplementLog & {
      owner: string;
    })[]
  ).filter((s) => s.owner === owner);
  const strengthSets = (
    (data?.strengthSets ?? []) as unknown as (StrengthSet & {
      owner: string;
    })[]
  )
    .filter((s) => s.owner === owner)
    .sort((a, b) => a.createdAt - b.createdAt);
  const customGoals = (
    (data?.customGoals ?? []) as unknown as (CustomGoal & { owner: string })[]
  )
    .filter((g) => g.owner === owner)
    .sort((a, b) => a.createdAt - b.createdAt);
  const favorites = (
    (data?.favorites ?? []) as unknown as (FavoriteFood & { owner: string })[]
  )
    .filter((f) => f.owner === owner)
    .sort((a, b) => b.createdAt - a.createdAt);
  const recipes: Recipe[] = (
    (data?.recipes ?? []) as unknown as {
      id: string;
      owner: string;
      name: string;
      items: string;
      createdAt: number;
    }[]
  )
    .filter((r) => r.owner === owner)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => {
      let items: RecipeItem[] = [];
      try {
        const parsed = JSON.parse(r.items);
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        // receta sin items válidos → lista vacía
      }
      return { id: r.id, name: r.name, items, createdAt: r.createdAt };
    });
  const photoRecords = (
    (data?.photos ?? []) as unknown as (PhotoEntry & { owner: string })[]
  )
    .filter((p) => p.owner === owner)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Las URLs de storage se resuelven por path con la API de storage (no se
  // puede consultar $files como entidad porque no está en el esquema).
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoKey = photoRecords.map((p) => p.path).join("|");
  useEffect(() => {
    let cancelled = false;
    const missing = photoRecords.filter((p) => !photoUrls[p.path]);
    if (missing.length === 0) return;
    (async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        missing.map(async (p) => {
          try {
            const url = await db.storage.getDownloadUrl(p.path);
            if (url) resolved[p.path] = String(url);
          } catch {
            // sin URL: la foto simplemente no se muestra
          }
        }),
      );
      if (!cancelled && Object.keys(resolved).length) {
        setPhotoUrls((prev) => ({ ...prev, ...resolved }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  const photos: ResolvedPhoto[] = photoRecords.map((p) => ({
    ...p,
    url: photoUrls[p.path],
  }));
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

  const addFavorite = (fav: Omit<FavoriteFood, "id" | "createdAt">) => {
    if (!user || !fav.name.trim()) return;
    const dup = favorites.find(
      (f) => f.name.toLowerCase() === fav.name.trim().toLowerCase(),
    );
    if (dup) return;
    db.transact(
      db.tx.favorites[id()].update({
        owner: user.id,
        name: fav.name.trim(),
        qty: fav.qty,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fat: fav.fat,
        createdAt: Date.now(),
      }),
    );
  };
  const removeFavorite = (fid: string) =>
    db.transact(db.tx.favorites[fid].delete());

  const addRecipe = (name: string, items: RecipeItem[]) => {
    if (!user || !name.trim() || items.length === 0) return;
    db.transact(
      db.tx.recipes[id()].update({
        owner: user.id,
        name: name.trim(),
        items: JSON.stringify(items),
        createdAt: Date.now(),
      }),
    );
  };
  const removeRecipe = (rid: string) =>
    db.transact(db.tx.recipes[rid].delete());

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

  /** Registra una medida corporal del día (upsert por parte + día). */
  const addMeasure = (part: BodyPart, cm: number, date: string) => {
    if (!user || !(cm > 0)) return;
    const existing = measures.find(
      (m) => m.part === part && m.date === date,
    ) as (MeasureEntry & { id: string }) | undefined;
    const mid = existing?.id ?? id();
    db.transact(
      db.tx.measures[mid].update({
        owner: user.id,
        date,
        part,
        cm,
        createdAt: Date.now(),
      }),
    );
  };
  const removeMeasure = (mid: string) =>
    db.transact(db.tx.measures[mid].delete());

  const addSupplement = (name: string, dose?: string, time?: string) => {
    if (!user || !name.trim()) return;
    db.transact(
      db.tx.supplements[id()].update({
        owner: user.id,
        name: name.trim(),
        ...(dose?.trim() ? { dose: dose.trim() } : {}),
        ...(time?.trim() ? { time: time.trim() } : {}),
        createdAt: Date.now(),
      }),
    );
  };
  const removeSupplement = (sid: string) =>
    db.transact(db.tx.supplements[sid].delete());

  /** Registra una serie de fuerza. */
  const addSet = (
    exercise: string,
    reps: number,
    weight: number,
    date: string,
  ) => {
    if (!user || !exercise.trim() || !(reps > 0)) return;
    db.transact(
      db.tx.strengthSets[id()].update({
        owner: user.id,
        date,
        exercise: exercise.trim(),
        reps,
        weight: weight || 0,
        createdAt: Date.now(),
      }),
    );
  };
  const removeSet = (sid: string) =>
    db.transact(db.tx.strengthSets[sid].delete());

  const addGoal = (
    kind: GoalKind,
    label: string,
    target: number,
    ref?: string,
  ) => {
    if (!user || !label.trim() || !(target > 0)) return;
    db.transact(
      db.tx.customGoals[id()].update({
        owner: user.id,
        kind,
        label: label.trim(),
        target,
        ...(ref?.trim() ? { ref: ref.trim() } : {}),
        createdAt: Date.now(),
      }),
    );
  };
  const removeGoal = (gid: string) =>
    db.transact(db.tx.customGoals[gid].delete());

  /** Sube una foto de progreso (la redimensiona antes) y guarda su metadata. */
  const addPhoto = async (file: File, date: string) => {
    if (!user) return;
    const blob = await downscaleImage(file);
    const path = `progress/${user.id}/${date}-${id()}.jpg`;
    const res = await db.storage.uploadFile(path, blob, {
      contentType: "image/jpeg",
    });
    await db.transact(
      db.tx.photos[id()].update({
        owner: user.id,
        date,
        path,
        fileId: res.data.id,
        createdAt: Date.now(),
      }),
    );
  };
  const removePhoto = (photoId: string, path: string) => {
    db.transact(db.tx.photos[photoId].delete());
    void db.storage.delete(path).catch(() => {});
  };

  /** Marca/desmarca un suplemento como tomado en un día. */
  const toggleSupplement = (supId: string, date: string) => {
    if (!user) return;
    const existing = supplementLogs.find(
      (l) => l.supId === supId && l.date === date,
    ) as (SupplementLog & { id: string }) | undefined;
    if (existing) {
      db.transact(db.tx.supplementLogs[existing.id].delete());
    } else {
      db.transact(
        db.tx.supplementLogs[id()].update({ owner: user.id, supId, date }),
      );
    }
  };

  /** Actualiza (o crea) las métricas de bienestar de un día. */
  const setMetric = (
    date: string,
    patch: Partial<Pick<DailyMetrics, "water" | "sleepHours" | "sleepQuality" | "steps">>,
  ) => {
    if (!user) return;
    const existing = metrics.find((m) => m.date === date) as
      | (DailyMetrics & { id: string })
      | undefined;
    const mid = existing?.id ?? id();
    db.transact(
      db.tx.metrics[mid].update({ owner: user.id, date, ...patch }),
    );
  };

  return {
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
    profileId,
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
    removeMessage,
    addMemory,
    removeMemory,
    addWeight,
    removeWeight,
    setTargetWeight,
    setMetric,
    addMeasure,
    removeMeasure,
    addSupplement,
    removeSupplement,
    toggleSupplement,
    addSet,
    removeSet,
    addGoal,
    removeGoal,
    addPhoto,
    removePhoto,
  };
}
