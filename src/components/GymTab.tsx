"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { inputCls } from "@/components/Sheet";
import ExerciseImage from "@/components/ExerciseImage";
import ExercisePickerSheet from "@/components/ExercisePickerSheet";
import CardioSheet from "@/components/CardioSheet";
import {
  buildDailyRoutine,
  exerciseProgress,
  groupByExercise,
  personalRecords,
  totalVolume,
  usedExercises,
} from "@/lib/gym";
import { matchExercise } from "@/lib/exerciseDb";
import {
  COMMON_LIFTS,
  startOfLocalDayMs,
  type ExerciseEntry,
  type StrengthSet,
} from "@/lib/types";
import exerciseNames from "@/data/exercise-names.json";

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** Corre una fecha YYYY-MM-DD `delta` días (local). */
const shiftISO = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export default function GymTab({
  strengthSets,
  exercises = [],
  today,
  onAddSet,
  onRemoveSet,
  onAddExercise,
  onRemoveExercise,
}: {
  strengthSets: StrengthSet[];
  exercises?: ExerciseEntry[];
  today: string;
  onAddSet: (
    exercise: string,
    reps: number,
    weight: number,
    date: string,
    createdAt?: number,
  ) => void;
  onRemoveSet: (id: string) => void;
  onAddExercise: (e: ExerciseEntry) => void;
  onRemoveExercise: (id: string) => void;
}) {
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [progExercise, setProgExercise] = useState<string | null>(null);
  // Día que se está mirando (permite consultar sesiones anteriores).
  const [viewDate, setViewDate] = useState(today);
  const isToday = viewDate === today;

  const daySets = useMemo(
    () => strengthSets.filter((s) => s.date === viewDate),
    [strengthSets, viewDate],
  );
  const dayCardio = useMemo(
    () => exercises.filter((e) => e.date === viewDate),
    [exercises, viewDate],
  );
  const groups = useMemo(() => groupByExercise(daySets), [daySets]);
  const prs = useMemo(() => personalRecords(strengthSets), [strengthSets]);
  const dayVolume = totalVolume(daySets);
  const routine = useMemo(
    () => buildDailyRoutine(strengthSets, exercises, today),
    [strengthSets, exercises, today],
  );
  // Descarte por jornada: se guarda la clave del día en localStorage. Se lee en
  // el inicializador (GymTab solo monta al abrir el tab, nunca en SSR).
  const [dismissedKey, setDismissedKey] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("nutta.routineDismissed"),
  );
  const showSuggestion = routine.key !== dismissedKey;
  const dismissSuggestion = () => {
    localStorage.setItem("nutta.routineDismissed", routine.key);
    setDismissedKey(routine.key);
  };

  const used = useMemo(() => usedExercises(strengthSets), [strengthSets]);
  // Historial y comunes primero (lo más relevante), luego el catálogo canónico
  // de RepDB (400 ejercicios) para autocompletar con nombres consistentes.
  const options = useMemo(
    () => [...new Set([...used, ...COMMON_LIFTS, ...exerciseNames])],
    [used],
  );

  const selectedProg = progExercise ?? used[0] ?? null;
  const progData = useMemo(
    () =>
      selectedProg
        ? exerciseProgress(strengthSets, selectedProg).map((p) => ({
            label: shortDate(p.date),
            peso: p.weight,
          }))
        : [],
    [strengthSets, selectedProg],
  );

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--foreground)",
  } as const;

  // Ejercicio del catálogo que matchea lo escrito (para mostrar su miniatura).
  const matched = useMemo(
    () => (exercise.trim() ? matchExercise(exercise) : null),
    [exercise],
  );

  const canAdd = exercise.trim() !== "" && Number(reps) > 0;
  const submit = () => {
    if (!canAdd) return;
    // Para un día pasado se ancla el createdAt al mediodía de ese día + 1 min por
    // serie ya cargada: cae en el día correcto y preserva el orden de la sesión.
    const createdAt = isToday
      ? undefined
      : startOfLocalDayMs(viewDate) + daySets.length * 60_000;
    onAddSet(exercise.trim(), Number(reps), Number(weight) || 0, viewDate, createdAt);
    setReps("");
    // se mantienen ejercicio y peso para cargar la próxima serie rápido
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entreno</h1>
          <p className="text-sm text-muted">Series, peso y PR</p>
        </div>
        {daySets.length > 0 && (
          <span className="text-right text-xs text-muted">
            Volumen
            <span className="block text-base font-bold tabular-nums text-foreground">
              {Math.round(dayVolume).toLocaleString("es-AR")} kg
            </span>
          </span>
        )}
      </header>

      {/* Navegador de días: consultar sesiones anteriores */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-2 py-1.5">
        <button
          onClick={() => setViewDate((d) => shiftISO(d, -1))}
          className="rounded-lg px-4 py-1 text-xl text-muted active:scale-90"
          aria-label="Día anterior"
        >
          ‹
        </button>
        <span className="text-sm font-semibold capitalize">
          {isToday ? "Hoy" : longDate(viewDate)}
        </span>
        <button
          onClick={() => setViewDate((d) => shiftISO(d, 1))}
          disabled={isToday}
          className="rounded-lg px-4 py-1 text-xl text-muted active:scale-90 disabled:opacity-30"
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      {isToday && showSuggestion && (
        <div
          className={`flex flex-col gap-3 rounded-2xl border border-border border-l-4 bg-card px-4 py-3 ${
            routine.tone === "recovery"
              ? "border-l-primary"
              : routine.tone === "done"
                ? "border-l-success"
                : "border-l-accent"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg leading-none">
              {routine.tone === "recovery"
                ? "🧘"
                : routine.tone === "done"
                  ? "✅"
                  : "🎯"}
            </span>
            <p className="flex-1 text-sm">{routine.headline}</p>
            <button
              onClick={dismissSuggestion}
              aria-label="Descartar sugerencia"
              className="shrink-0 text-muted hover:text-accent"
            >
              ×
            </button>
          </div>

          {routine.groups.map((g) => (
            <div key={g.group} className="flex flex-col gap-1.5 pl-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {g.group}
              </p>
              {g.exercises.map((ex) => (
                <button
                  key={ex.name}
                  onClick={() => setExercise(ex.name)}
                  className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left text-sm active:scale-[0.99] hover:border-primary"
                >
                  <span>{ex.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {ex.sets} × {ex.reps}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {routine.cardioTip && (
            <p className="pl-1 text-xs text-muted">🏃 {routine.cardioTip}</p>
          )}
        </div>
      )}

      {/* Alta de serie (hoy o un día pasado que estés completando) */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        {!isToday && (
          <p className="text-xs font-medium text-accent">
            Cargando series en {longDate(viewDate)}
          </p>
        )}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2 text-sm font-medium text-primary active:scale-[0.99] hover:border-primary"
        >
          🔍 Buscar ejercicio por grupo
        </button>
        <div className="flex items-center gap-2">
          {matched && (
            <ExerciseImage
              image={matched.image}
              name={matched.name_es}
              className="h-10 w-10"
            />
          )}
          <input
            className={inputCls}
            list="lift-options"
            placeholder="…o escribí el nombre (ej. Press banca)"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
          />
        </div>
        <datalist id="lift-options">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            className={inputCls}
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            className={inputCls}
            placeholder="Peso (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button
            onClick={submit}
            disabled={!canAdd}
            className="shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground active:scale-95 disabled:opacity-40"
          >
            + Serie
          </button>
        </div>
        <p className="text-xs text-muted">
          Dejá el peso en 0 para ejercicios con peso corporal.
        </p>
      </section>

      {/* Sesión del día */}
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted">
          {isToday
            ? "Todavía no cargaste series hoy. Sumá tu primera serie arriba 💪"
            : "No hay series este día. Si te lo olvidaste, cargalas arriba 💪"}
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">
            {isToday ? "Sesión de hoy" : `Sesión — ${longDate(viewDate)}`}
          </h2>
          {groups.map((g) => {
            const pr = prs.get(g.exercise) ?? 0;
            const isPr = g.topWeight >= pr && pr > 0;
            return (
              <div
                key={g.exercise}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">
                    {g.exercise}
                    {isPr && (
                      <span
                        className="ml-2 align-middle text-xs text-accent"
                        title="Récord personal"
                      >
                        🏆 PR
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-muted tabular-nums">
                    {Math.round(g.volume).toLocaleString("es-AR")} kg
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {g.sets.map((s, i) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="tabular-nums">
                        <span className="mr-2 text-muted">{i + 1}.</span>
                        {s.reps} <span className="text-muted">reps ×</span>{" "}
                        {s.weight} <span className="text-muted">kg</span>
                      </span>
                      <button
                        onClick={() => onRemoveSet(s.id)}
                        className="text-muted hover:text-accent"
                        aria-label="Eliminar serie"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  PR: {pr} kg · {g.sets.length}{" "}
                  {g.sets.length === 1 ? "serie" : "series"}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {/* Cardio del día (correr, bici, estilo libre… con datos del reloj) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">
            {isToday ? "Cardio de hoy" : `Cardio — ${longDate(viewDate)}`}
          </h2>
          <button
            onClick={() => setCardioOpen(true)}
            className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-primary active:scale-95 hover:border-primary"
          >
            + Cardio
          </button>
        </div>
        {dayCardio.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted">
            Sin cardio registrado {isToday ? "hoy" : "este día"}.
          </p>
        ) : (
          dayCardio.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold">{c.name}</h3>
                <button
                  onClick={() => onRemoveExercise(c.id)}
                  className="text-muted hover:text-accent"
                  aria-label="Eliminar cardio"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-muted">
                {c.minutes} min · {c.caloriesBurned} kcal
                {c.avgHeartRate != null && ` · ${c.avgHeartRate} LPM prom.`}
                {c.maxHeartRate != null && ` · ${c.maxHeartRate} LPM máx.`}
                {c.trainingEffect != null &&
                  ` · Efecto ${c.trainingEffect.toFixed(1)}`}
              </p>
            </div>
          ))
        )}
      </section>

      {/* Progresión por ejercicio */}
      {used.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">Progresión</h2>
          <div className="flex flex-wrap gap-2">
            {used.slice(0, 8).map((ex) => (
              <button
                key={ex}
                onClick={() => setProgExercise(ex)}
                className={`rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${
                  selectedProg === ex
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            {progData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={progData}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--muted)"
                  />
                  <YAxis
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--muted)"
                    width={40}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${v} kg`, "Peso máx."]}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--accent)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-3 text-center text-sm text-muted">
                Registrá {selectedProg} en más de un día para ver tu
                progresión.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Atribución obligatoria del dataset de ejercicios (licencia RepDB). */}
      <p className="mt-2 text-center text-[11px] text-muted">
        Exercise data by{" "}
        <a
          href="https://repdb.co"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          RepDB (repdb.co)
        </a>
      </p>

      {cardioOpen && (
        <CardioSheet
          date={viewDate}
          onAdd={onAddExercise}
          onClose={() => setCardioOpen(false)}
        />
      )}

      {pickerOpen && (
        <ExercisePickerSheet
          strengthSets={strengthSets}
          onSelect={setExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}
