"use client";

import { axisProps, chartMargin, tooltipStyle, yAxis } from "@/lib/chart";
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
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import DayNavigator from "@/components/DayNavigator";
import ExerciseImage from "@/components/ExerciseImage";
import ExercisePickerSheet from "@/components/ExercisePickerSheet";
import CardioSheet from "@/components/CardioSheet";
import RestTimer from "@/components/RestTimer";
import Button from "@/components/ui/Button";
import Stepper from "@/components/ui/Stepper";
import { Field, inputCls } from "@/components/ui/Field";
import {
  buildDailyRoutine,
  exerciseProgress,
  groupByExercise,
  personalRecords,
  totalVolume,
  usedExercises,
  type Readiness,
} from "@/lib/gym";
import { matchExercise } from "@/lib/exerciseDb";
import type { ObjectiveKey } from "@/lib/nutrition";
import {
  COMMON_LIFTS,
  dayLabel,
  startOfLocalDayMs,
  type ExerciseEntry,
  type StrengthSet,
} from "@/lib/types";
import exerciseNames from "@/data/exercise-names.json";

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/**
 * Mini-formulario de una serie (reps + peso) con steppers. Se usa tanto para
 * EDITAR una serie existente como para AGREGAR otra a un ejercicio ya cargado,
 * así ambos flujos se ven y se cargan igual (con −/+, sin teclado).
 */
function SetForm({
  reps,
  weight,
  onReps,
  onWeight,
  onSave,
  onCancel,
  saveLabel,
}: {
  reps: string;
  weight: string;
  onReps: (v: string) => void;
  onWeight: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-sunken p-2">
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[11px] text-muted">Reps</p>
          <Stepper
            value={reps}
            onChange={onReps}
            step={1}
            min={0}
            max={100}
            ariaLabel="Repeticiones"
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] text-muted">Peso (kg)</p>
          <Stepper
            value={weight}
            onChange={onWeight}
            step={5}
            min={0}
            max={500}
            ariaLabel="Peso en kilos"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="accent"
          onClick={onSave}
          disabled={!(Number(reps) > 0)}
        >
          <Check size={15} strokeWidth={2.5} aria-hidden />
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

export default function GymTab({
  strengthSets,
  exercises = [],
  today,
  objective,
  readiness,
  onAddSet,
  onRemoveSet,
  onEditSet,
  onAddExercise,
  onRemoveExercise,
}: {
  strengthSets: StrengthSet[];
  exercises?: ExerciseEntry[];
  today: string;
  objective?: ObjectiveKey;
  /** Cómo llega el usuario hoy (sueño, carga acumulada, recuperación). */
  readiness?: Readiness;
  onAddSet: (
    exercise: string,
    reps: number,
    weight: number,
    date: string,
    createdAt?: number,
  ) => void;
  onRemoveSet: (id: string) => void;
  onEditSet: (id: string, reps: number, weight: number) => void;
  onAddExercise: (e: ExerciseEntry) => void;
  onRemoveExercise: (id: string) => void;
}) {
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [progExercise, setProgExercise] = useState<string | null>(null);
  // Instante de la última serie cargada, para el cronómetro de descanso.
  const [restSince, setRestSince] = useState<number | null>(null);
  // Serie que se está editando (id) o agregando (ejercicio) + sus valores.
  const [editId, setEditId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newReps, setNewReps] = useState("");
  const [newWeight, setNewWeight] = useState("");

  const startEdit = (s: StrengthSet) => {
    setEditId(s.id);
    setEditReps(String(s.reps));
    setEditWeight(String(s.weight));
    setAddingTo(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    if (editId && Number(editReps) > 0) {
      onEditSet(editId, Number(editReps), Number(editWeight) || 0);
    }
    setEditId(null);
  };

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
    () => buildDailyRoutine(strengthSets, exercises, today, objective, readiness),
    [strengthSets, exercises, today, objective, readiness],
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
  const progAxis = useMemo(
    () => yAxis(progData.map((p) => p.peso)),
    [progData],
  );

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
    // Ejercicio, reps y peso quedan cargados: lo normal es repetir la misma
    // serie, así que la próxima sale con un solo toque. Antes se borraban las
    // reps y había que reescribirlas en cada serie de un 4×10.
    if (isToday) setRestSince(Date.now());
  };

  // Agregar otra serie a un ejercicio ya cargado, sin reescribir el nombre.
  const startAdd = (g: { exercise: string; sets: StrengthSet[] }) => {
    // Prefill con la última serie: lo normal es repetir reps/peso.
    const last = g.sets[g.sets.length - 1];
    setAddingTo(g.exercise);
    setNewReps(last ? String(last.reps) : "");
    setNewWeight(last ? String(last.weight) : "");
    setEditId(null);
  };
  const cancelAdd = () => setAddingTo(null);
  const saveAdd = () => {
    if (addingTo && Number(newReps) > 0) {
      // Mismo anclaje de fecha que el alta de arriba (día pasado → mediodía).
      const createdAt = isToday
        ? undefined
        : startOfLocalDayMs(viewDate) + daySets.length * 60_000;
      onAddSet(
        addingTo,
        Number(newReps),
        Number(newWeight) || 0,
        viewDate,
        createdAt,
      );
      if (isToday) setRestSince(Date.now());
    }
    setAddingTo(null);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <AppHeader
        title="Entreno"
        subtitle="Series, peso y PR"
        actions={
          daySets.length > 0 ? (
            <span className="text-right text-xs text-muted">
              Volumen
              <span className="block text-base font-bold tabular-nums text-foreground">
                {Math.round(dayVolume).toLocaleString("es-AR")} kg
              </span>
            </span>
          ) : undefined
        }
        below={
          <DayNavigator
            viewDate={viewDate}
            today={today}
            onChange={setViewDate}
          />
        }
      />

      {/* Sugerencia de rutina. Va con su propio título: antes arrancaba con un
          emoji y una frase suelta, y no quedaba claro si era un consejo o algo
          que ya habías cargado. */}
      {isToday && showSuggestion && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Sugerencia de hoy</h2>
        <div
          className={`flex flex-col gap-3 rounded-card border-l-4 bg-card px-4 py-3 shadow-e1 ${
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
            <div className="min-w-0 flex-1">
              <p className="text-sm">{routine.headline}</p>
              {/* El porqué de la sugerencia: sin esto es un oráculo. */}
              {routine.why && (
                <p className="mt-0.5 text-xs text-muted">{routine.why}</p>
              )}
            </div>
            <button
              type="button"
              onClick={dismissSuggestion}
              aria-label="Descartar sugerencia"
              className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
            >
              <X size={17} strokeWidth={2.25} aria-hidden />
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
        </section>
      )}

      {/* Alta de serie (hoy o un día pasado que estés completando) */}
      <section className="flex flex-col gap-4 rounded-card bg-card p-4 shadow-e1">
        {!isToday && (
          <p className="text-xs font-medium text-accent">
            Cargando series en {dayLabel(viewDate)}
          </p>
        )}

        <div className="flex items-center gap-2">
          {matched && (
            <ExerciseImage
              image={matched.image}
              name={matched.name_es}
              className="h-11 w-11 shrink-0"
            />
          )}
          <input
            className={inputCls}
            list="lift-options"
            placeholder="Ejercicio (ej. Press banca)"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            aria-label="Ejercicio"
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Buscar ejercicio por grupo muscular"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-primary transition-transform duration-(--duration-fast) active:scale-90"
          >
            <Search size={19} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <datalist id="lift-options">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>

        {/* Steppers en vez de campos sueltos: entre serie y serie se carga con
            una mano y sin mirar. El peso salta de a 5 kg (para 10, dos toques);
            para ajustes finos el campo sigue siendo editable a mano. Van
            apilados (no lado a lado) porque a dos columnas no queda ancho
            para el número: con dos botones de 44px a cada lado, el dígito
            termina tapado. */}
        <div className="flex flex-col gap-3">
          <Field label="Repeticiones">
            <Stepper
              value={reps}
              onChange={setReps}
              step={1}
              min={0}
              max={100}
              ariaLabel="Repeticiones"
            />
          </Field>
          <Field label="Peso (kg)">
            <Stepper
              value={weight}
              onChange={setWeight}
              step={5}
              min={0}
              max={500}
              ariaLabel="Peso en kilos"
            />
          </Field>
        </div>

        <Button variant="accent" size="lg" full onClick={submit} disabled={!canAdd}>
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          Agregar serie
        </Button>

        {restSince != null && (
          <RestTimer since={restSince} onDismiss={() => setRestSince(null)} />
        )}

        <p className="text-xs text-muted">
          Dejá el peso en 0 para ejercicios con peso corporal. Los valores quedan
          cargados para repetir la serie de un toque.
        </p>
      </section>

      {/* Sesión del día */}
      {groups.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          {isToday
            ? "Todavía no cargaste series hoy. Sumá tu primera serie arriba 💪"
            : "No hay series este día. Si te lo olvidaste, cargalas arriba 💪"}
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">
            {isToday ? "Sesión de hoy" : `Sesión — ${dayLabel(viewDate)}`}
          </h2>
          {groups.map((g) => {
            const pr = prs.get(g.exercise) ?? 0;
            const isPr = g.topWeight >= pr && pr > 0;
            return (
              <div
                key={g.exercise}
                className="rounded-card bg-card p-4 shadow-e1"
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
                  {g.sets.map((s, i) =>
                    editId === s.id ? (
                      <li key={s.id}>
                        <SetForm
                          reps={editReps}
                          weight={editWeight}
                          onReps={setEditReps}
                          onWeight={setEditWeight}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          saveLabel="Guardar"
                        />
                      </li>
                    ) : (
                      <li
                        key={s.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="tabular-nums">
                          <span className="mr-2 text-muted">{i + 1}.</span>
                          {s.reps} <span className="text-muted">reps ×</span>{" "}
                          {s.weight} <span className="text-muted">kg</span>
                        </span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-primary"
                            aria-label={`Editar serie: ${s.reps} reps × ${s.weight} kg`}
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSet(s.id)}
                            className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                            aria-label={`Eliminar serie: ${s.reps} reps × ${s.weight} kg`}
                          >
                            <Trash2 size={15} aria-hidden />
                          </button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
                {addingTo === g.exercise ? (
                  <div className="mt-2">
                    <SetForm
                      reps={newReps}
                      weight={newWeight}
                      onReps={setNewReps}
                      onWeight={setNewWeight}
                      onSave={saveAdd}
                      onCancel={cancelAdd}
                      saveLabel="Agregar"
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted">
                      PR: {pr} kg · {g.sets.length}{" "}
                      {g.sets.length === 1 ? "serie" : "series"}
                    </p>
                    <button
                      type="button"
                      onClick={() => startAdd(g)}
                      className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-primary transition-colors active:scale-95 hover:border-primary"
                    >
                      <Plus size={13} strokeWidth={2.5} aria-hidden />
                      Serie
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Cardio del día (correr, bici, estilo libre… con datos del reloj) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">
            {isToday ? "Cardio de hoy" : `Cardio — ${dayLabel(viewDate)}`}
          </h2>
          <button
            onClick={() => setCardioOpen(true)}
            className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-primary active:scale-95 hover:border-primary"
          >
            + Cardio
          </button>
        </div>

        {dayCardio.length === 0 ? (
          <p className="rounded-card border border-dashed border-border p-4 text-center text-sm text-muted">
            Sin cardio registrado {isToday ? "hoy" : "este día"}.
          </p>
        ) : (
          dayCardio.map((c) => (
            <div
              key={c.id}
              className="rounded-card bg-card p-4 shadow-e1"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate font-semibold">{c.name}</h3>
                  {c.source === "reloj" && (
                    <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[10px] font-medium text-muted">
                      Reloj
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveExercise(c.id)}
                  className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                  aria-label={`Eliminar cardio: ${c.name}`}
                >
                  <Trash2 size={16} aria-hidden />
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
          <div className="rounded-card bg-card p-4 shadow-e1">
            {progData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={progData} margin={chartMargin}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} {...progAxis} />
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
