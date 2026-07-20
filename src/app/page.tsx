"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeProduct, type FoodProduct, type OffProduct } from "@/lib/off";
import {
  MET_ACTIVITIES,
  caloriesFromMet,
  type MetActivity,
} from "@/lib/exercises";
import BarcodeScanner from "@/components/BarcodeScanner";
import BottomNav, { type Tab } from "@/components/BottomNav";
import CalorieRing from "@/components/CalorieRing";
import History from "@/components/History";
import MacroBar from "@/components/MacroBar";
import Login from "@/components/Login";
import Onboarding from "@/components/Onboarding";
import { db, id } from "@/lib/db";
import { computeGoals, type Profile } from "@/lib/nutrition";
import {
  DEFAULT_GOALS,
  MEALS,
  todayISO,
  type ExerciseEntry,
  type FoodEntry,
  type MealType,
} from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Home() {
  const today = todayISO();

  const { isLoading: authLoading, user } = db.useAuth();
  const { isLoading: dataLoading, data } = db.useQuery(
    user ? { profiles: {}, foods: {}, exercises: {} } : null,
  );

  const [foodOpen, setFoodOpen] = useState<MealType | null>(null);
  const [exOpen, setExOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [tab, setTab] = useState<Tab>("hoy");

  const owner = user?.id;
  const foods = (
    (data?.foods ?? []) as unknown as (FoodEntry & { owner: string })[]
  ).filter((f) => f.owner === owner);
  const exercises = (
    (data?.exercises ?? []) as unknown as (ExerciseEntry & { owner: string })[]
  ).filter((e) => e.owner === owner);
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
      }),
    );
  };
  const removeExercise = (eid: string) =>
    db.transact(db.tx.exercises[eid].delete());

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
          const kcal = Math.round(items.reduce((s, f) => s + f.calories, 0));
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
                        {f.name} <span className="text-muted">· {f.qty} g</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-muted">
                          {Math.round(f.calories)} kcal
                        </span>
                        <button
                          onClick={() =>
                            removeFood(f.id)
                          }
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
                  {e.name} <span className="text-muted">· {e.minutes} min</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-muted">
                    {Math.round(e.caloriesBurned)} kcal
                  </span>
                  <button
                    onClick={() =>
                      removeExercise(e.id)
                    }
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

/* ---------- Formularios (bottom-sheet) ---------- */

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted" aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Escala los valores por 100 g a la cantidad indicada. */
function scale(per100: FoodProduct["per100"], qty: number) {
  const k = qty / 100;
  return {
    calories: String(Math.round(per100.calories * k)),
    protein: String(round1(per100.protein * k)),
    carbs: String(round1(per100.carbs * k)),
    fat: String(round1(per100.fat * k)),
  };
}

function FoodForm({
  meal,
  onAdd,
  onClose,
}: {
  meal: MealType;
  onAdd: (e: FoodEntry) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: "",
    qty: "100",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  // per100 del producto elegido; si es null, los macros son manuales.
  const [base, setBase] = useState<FoodProduct["per100"] | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const label = MEALS.find((m) => m.key === meal)?.label ?? "";

  // Búsqueda con debounce contra Open Food Facts.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        // Se consulta OFF directo desde el navegador: usa la IP del usuario
        // (las IPs de datacenter de Vercel suelen ser bloqueadas por OFF).
        const url =
          "https://world.openfoodfacts.org/api/v2/search?" +
          new URLSearchParams({
            search_terms: q,
            page_size: "40",
            sort_by: "popularity_key",
            fields: "code,product_name,product_name_es,brands,nutriments",
          }).toString();
        const res = await fetch(url, { signal: ctrl.signal });
        const data = (await res.json()) as { products?: OffProduct[] };
        const products = (data.products ?? [])
          .map(normalizeProduct)
          .filter((p): p is FoodProduct => p !== null)
          .slice(0, 15);
        setResults(products);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const selectProduct = (p: FoodProduct) => {
    const qty = Number(f.qty) || 100;
    setBase(p.per100);
    setF({ name: p.name, qty: String(qty), ...scale(p.per100, qty) });
    setQuery("");
    setResults([]);
  };

  const lookupBarcode = async (code: string) => {
    setScanning(false);
    setScanMsg("Buscando producto…");
    try {
      const res = await fetch(`/api/foods/barcode?code=${code}`);
      const data = (await res.json()) as {
        product?: FoodProduct | null;
        error?: string;
      };
      if (data.product) {
        selectProduct(data.product);
        setScanMsg(null);
      } else {
        setScanMsg(data.error ?? "Producto no encontrado");
      }
    } catch {
      setScanMsg("No se pudo consultar el código");
    }
  };

  const changeQty = (qty: string) => {
    if (base) {
      setF({ ...f, qty, ...scale(base, Number(qty) || 0) });
    } else {
      setF({ ...f, qty });
    }
  };

  return (
    <Sheet title={`Agregar a ${label}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!f.name.trim()) return;
          onAdd({
            id: uid(),
            date: todayISO(),
            meal,
            name: f.name.trim(),
            qty: Number(f.qty) || 0,
            calories: Number(f.calories) || 0,
            protein: Number(f.protein) || 0,
            carbs: Number(f.carbs) || 0,
            fat: Number(f.fat) || 0,
          });
        }}
      >
        {/* Buscador Open Food Facts + escaneo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className={inputCls}
              placeholder="🔍 Buscar alimento (ej. yogur, banana...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          {(loading || results.length > 0) && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              {loading && (
                <p className="px-3 py-2 text-sm text-muted">Buscando…</p>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-primary/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {p.name}
                    </span>
                    {p.brand && (
                      <span className="block truncate text-xs text-muted">
                        {p.brand}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {p.per100.calories} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}
          </div>
          <button
            type="button"
            onClick={() => {
              setScanMsg(null);
              setScanning(true);
            }}
            className="shrink-0 rounded-xl border border-border px-3 text-xl active:scale-95"
            aria-label="Escanear código de barras"
          >
            📷
          </button>
        </div>
        {scanMsg && <p className="-mt-2 text-xs text-accent">{scanMsg}</p>}

        <input
          className={inputCls}
          placeholder="Alimento (ej. Yogur natural)"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad (g)">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              value={f.qty}
              onChange={(e) => changeQty(e.target.value)}
            />
          </Field>
          <Field label="Calorías (kcal)">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              value={f.calories}
              onChange={(e) => setF({ ...f, calories: e.target.value })}
            />
          </Field>
          <Field label="Proteínas (g)">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={f.protein}
              onChange={(e) => setF({ ...f, protein: e.target.value })}
            />
          </Field>
          <Field label="Carbohidratos (g)">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={f.carbs}
              onChange={(e) => setF({ ...f, carbs: e.target.value })}
            />
          </Field>
          <Field label="Grasas (g)">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={f.fat}
              onChange={(e) => setF({ ...f, fat: e.target.value })}
            />
          </Field>
        </div>
        <button
          type="submit"
          className="mt-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground active:scale-[0.99]"
        >
          Agregar
        </button>
      </form>
      {scanning && (
        <BarcodeScanner
          onDetected={lookupBarcode}
          onClose={() => setScanning(false)}
        />
      )}
    </Sheet>
  );
}

function ExerciseForm({
  weight,
  onAdd,
  onClose,
}: {
  weight: number;
  onAdd: (e: ExerciseEntry) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [met, setMet] = useState<number | null>(null);
  const [caloriesEdited, setCaloriesEdited] = useState("");
  const [query, setQuery] = useState("");

  const mins = Number(minutes) || 0;

  // Calorías: si hay MET, se calculan; si el usuario las editó, se respeta.
  const autoCalories =
    met != null ? caloriesFromMet(met, weight, mins) : null;
  const calories =
    caloriesEdited !== "" ? Number(caloriesEdited) || 0 : (autoCalories ?? 0);

  const filtered = query.trim()
    ? MET_ACTIVITIES.filter((a) =>
        a.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : MET_ACTIVITIES;

  const selectActivity = (a: MetActivity) => {
    setName(a.name);
    setMet(a.met);
    setCaloriesEdited("");
    setQuery("");
  };

  return (
    <Sheet title="Agregar ejercicio" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!name.trim()) return;
          onAdd({
            id: uid(),
            date: todayISO(),
            name: name.trim(),
            minutes: mins,
            caloriesBurned: calories,
          });
        }}
      >
        {/* Selector de actividad con MET */}
        <input
          className={inputCls}
          placeholder="🔍 Buscar actividad (ej. correr, yoga...)"
          value={name || query}
          onChange={(e) => {
            setQuery(e.target.value);
            setName("");
            setMet(null);
          }}
          autoFocus
        />
        {!name && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
            {filtered.map((a) => (
              <button
                key={a.name}
                type="button"
                onClick={() => selectActivity(a)}
                className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-accent/5"
              >
                <span>
                  {a.name}{" "}
                  <span className="text-xs text-muted">· {a.category}</span>
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {a.met} MET
                </span>
              </button>
            ))}
            {query.trim() && (
              <button
                type="button"
                onClick={() => {
                  setName(query.trim());
                  setMet(null);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-sm text-accent hover:bg-accent/5"
              >
                + Usar «{query.trim()}» (calorías a mano)
              </button>
            )}
          </div>
        )}

        {name && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minutos">
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={minutes}
                  onChange={(e) => {
                    setMinutes(e.target.value);
                    setCaloriesEdited("");
                  }}
                />
              </Field>
              <Field label="Calorías quemadas">
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={caloriesEdited !== "" ? caloriesEdited : calories}
                  onChange={(e) => setCaloriesEdited(e.target.value)}
                />
              </Field>
            </div>
            {met != null && caloriesEdited === "" && (
              <p className="-mt-1 text-xs text-muted">
                Estimado: {met} MET × {weight} kg × {mins} min
              </p>
            )}
            <button
              type="submit"
              className="mt-2 rounded-xl bg-accent py-3 font-semibold text-accent-foreground active:scale-[0.99]"
            >
              Agregar
            </button>
          </>
        )}
      </form>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
