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
import { Check, Compass, Moon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import DayNavigator from "@/components/DayNavigator";
import ExerciseImage from "@/components/ExerciseImage";
import ExercisePickerSheet from "@/components/ExercisePickerSheet";
import CardioSheet from "@/components/CardioSheet";
import PlanDayCard from "@/components/PlanDayCard";
import RoutineEditorSheet from "@/components/RoutineEditorSheet";
import type { ExerciseDraft } from "@/components/ExerciseEditor";
import RestTimer from "@/components/RestTimer";
import SessionSheet from "@/components/SessionSheet";
import SwapExerciseSheet from "@/components/SwapExerciseSheet";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Stepper from "@/components/ui/Stepper";
import { Field, inputCls } from "@/components/ui/Field";
import {
  bestScores,
  exerciseProgress,
  groupByExercise,
  lastPerformance,
  nextTarget,
  totalVolume,
  usedExercises,
  type LastPerformance,
} from "@/lib/gym";
import { canonicalName } from "@/lib/exerciseDb";
import {
  KINDS,
  customFinder,
  fmtScore,
  fmtSeconds,
  fmtSet,
  imageResolver,
  kindResolver,
  loadSets,
  loadVolume,
  setScore,
  type BodyweightOn,
} from "@/lib/exerciseKind";
import {
  DOW_SHORT,
  WEEKLY_PLAN,
  getPlanDay,
  shortPlanLabel,
  type PlanDay,
} from "@/lib/plan";
import {
  VACATION_DOW,
  pickedDow,
  planDayFor,
  vacationOn,
  vacationOptions,
} from "@/lib/vacation";
import { applySwaps } from "@/lib/planSwaps";
import { buildTodaySession } from "@/lib/session";
import type { AthleteState } from "@/lib/athlete";
import {
  COMMON_LIFTS,
  dayLabel,
  type CustomExercise,
  type ExerciseKind,
  startOfLocalDayMs,
  type DailyMetrics,
  type ExerciseEntry,
  type PlanSwap,
  type PlanPick,
  type StrengthSet,
  type Vacation,
} from "@/lib/types";
import exerciseNames from "@/data/exercise-names.json";

const NO_DOWS = new Set<number>();
const NO_CUSTOM: CustomExercise[] = [];
const NO_BW: BodyweightOn = () => 0;

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/**
 * Los campos de una serie según cómo se mide el ejercicio: reps + kg, reps +
 * asistencia, solo reps o solo segundos. Steppers en vez de campos sueltos:
 * entre serie y serie se carga con una mano y sin mirar. Van apilados (no lado
 * a lado) porque a dos columnas no queda ancho para el número.
 */
function SetFields({
  kind,
  reps,
  weight,
  onReps,
  onWeight,
  bodyweight,
  compact = false,
}: {
  kind: ExerciseKind;
  reps: string;
  weight: string;
  onReps: (v: string) => void;
  onWeight: (v: string) => void;
  /** Peso corporal: con él, la asistencia se traduce a kg reales. */
  bodyweight: number;
  compact?: boolean;
}) {
  const label = (text: string, control: React.ReactNode) =>
    compact ? (
      <div>
        <p className="mb-1 text-[11px] text-muted">{text}</p>
        {control}
      </div>
    ) : (
      <Field label={text}>{control}</Field>
    );
  const assist = Number(weight) || 0;
  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      {kind === "tiempo"
        ? label(
            "Segundos",
            <Stepper
              value={reps}
              onChange={onReps}
              step={5}
              min={0}
              max={600}
              ariaLabel="Segundos"
            />,
          )
        : label(
            "Repeticiones",
            <Stepper
              value={reps}
              onChange={onReps}
              step={1}
              min={0}
              max={100}
              ariaLabel="Repeticiones"
            />,
          )}
      {(kind === "peso" || kind === "asistido") &&
        label(
          kind === "asistido" ? "Asistencia (kg)" : "Peso (kg)",
          <Stepper
            value={weight}
            onChange={onWeight}
            step={5}
            min={0}
            max={500}
            ariaLabel={kind === "asistido" ? "Asistencia en kilos" : "Peso en kilos"}
          />,
        )}
      {kind === "asistido" && (
        <p className="text-xs text-muted">
          {bodyweight > 0
            ? `Con tu peso de ${bodyweight} kg levantás ${Math.max(0, Math.round((bodyweight - assist) * 10) / 10)} kg. Menos asistencia = más difícil.`
            : "Registrá tu peso en Progreso para calcular cuánto levantás de verdad."}
        </p>
      )}
    </div>
  );
}

/**
 * Mini-formulario de una serie con steppers. Se usa tanto para EDITAR una serie
 * existente como para AGREGAR otra a un ejercicio ya cargado, así ambos flujos
 * se ven y se cargan igual (con −/+, sin teclado).
 */
function SetForm({
  kind,
  bodyweight,
  reps,
  weight,
  onReps,
  onWeight,
  onSave,
  onCancel,
  saveLabel,
}: {
  kind: ExerciseKind;
  bodyweight: number;
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
      <SetFields
        kind={kind}
        reps={reps}
        weight={weight}
        onReps={onReps}
        onWeight={onWeight}
        bodyweight={bodyweight}
        compact
      />
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

/** Peso que se guarda según el tipo: en reps y tiempo no hay kg que cargar. */
const storedWeight = (kind: ExerciseKind, weight: string) =>
  kind === "peso" || kind === "asistido" ? Number(weight) || 0 : 0;

export default function GymTab({
  strengthSets,
  exercises = [],
  metrics = [],
  state,
  today,
  onAddSet,
  onRemoveSet,
  onEditSet,
  onAddExercise,
  onRemoveExercise,
  onSetRestDay,
  planSwaps = [],
  vacations = [],
  planPicks = [],
  onPickPlanDay,
  onSwapExercise,
  onUndoSwap,
  hasPlan = true,
  plan = WEEKLY_PLAN,
  basePlan = WEEKLY_PLAN,
  savedDows = NO_DOWS,
  customExercises = NO_CUSTOM,
  bodyweightOn = NO_BW,
  onSaveRoutineDay,
  onResetRoutineDay,
  onSaveExercise,
  onRemoveCustomExercise,
}: {
  strengthSets: StrengthSet[];
  exercises?: ExerciseEntry[];
  /** Métricas diarias: de acá sale si el día está marcado como descanso. */
  metrics?: DailyMetrics[];
  /** Estado de HOY: recuperación, carga y grupos, para armar la sesión. */
  state: AthleteState;
  today: string;
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
  onSetRestDay: (date: string, rest: boolean) => void;
  /** Ejercicios de la rutina cambiados por otro, por día. */
  planSwaps?: PlanSwap[];
  /** Tramos de vacaciones: los días que cubren muestran la rutina de viaje. */
  vacations?: Vacation[];
  /** Días del plan elegidos a mano, por fecha (solo en vacaciones). */
  planPicks?: PlanPick[];
  /** Elegir qué día del plan hacer en esa fecha (`VACATION_DOW` = rutina de viaje). */
  onPickPlanDay?: (date: string, dow: number) => void;
  onSwapExercise?: (date: string, from: string, to: string) => void;
  onUndoSwap?: (date: string, from: string) => void;
  /**
   * El plan del mes es de este usuario (ver `lib/planOwner.ts`). Si no, se
   * ocultan la sesión sugerida y la rutina fija: las dos salen de ese plan, y
   * queda el registro libre de series.
   */
  hasPlan?: boolean;
  /** La semana vigente: plan fijo + días editados (ver `lib/routine.ts`). */
  plan?: PlanDay[];
  /** El plan fijo sin ediciones (vacío si el usuario no tiene plan propio). */
  basePlan?: PlanDay[];
  /** Días de la semana con una edición guardada. */
  savedDows?: Set<number>;
  /** Ejercicios propios y overrides de medición/foto. */
  customExercises?: CustomExercise[];
  /** Peso corporal en una fecha: para leer las asistidas en kg reales. */
  bodyweightOn?: BodyweightOn;
  onSaveRoutineDay?: (day: PlanDay) => void;
  onResetRoutineDay?: (dow: number) => void;
  onSaveExercise?: (d: ExerciseDraft) => void;
  onRemoveCustomExercise?: (id: string) => void;
}) {
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  // Cómo se mide cada ejercicio y qué foto lleva, con lo tuyo encima.
  const kindOf = useMemo(() => kindResolver(customExercises), [customExercises]);
  const findCustom = useMemo(() => customFinder(customExercises), [customExercises]);
  const imageOf = useMemo(() => imageResolver(customExercises), [customExercises]);
  // La rutina se muestra si hay plan propio o si armaste una en el editor.
  const hasRoutine = hasPlan || savedDows.size > 0;
  const bwToday = bodyweightOn(today);
  const [cardioOpen, setCardioOpen] = useState(false);
  // Ejercicio de la rutina que se está por reemplazar (null = sheet cerrado).
  const [swapping, setSwapping] = useState<string | null>(null);
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
    const set = strengthSets.find((s) => s.id === editId);
    if (set && Number(editReps) > 0) {
      onEditSet(set.id, Number(editReps), storedWeight(kindOf(set.exercise), editWeight));
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
  // PR según el tipo: más kg, menos asistencia, más reps o más segundos.
  const prs = useMemo(
    () => bestScores(strengthSets, kindOf, bodyweightOn),
    [strengthSets, kindOf, bodyweightOn],
  );
  // Volumen con la carga real: una asistida suma tu peso menos la ayuda.
  const dayVolume = totalVolume(loadSets(daySets, kindOf, bodyweightOn));
  // Descanso declarado para el día que se está viendo. Con series cargadas el
  // día cuenta como entrenamiento igual (lo hecho manda sobre lo declarado).
  const restDay = useMemo(
    () => metrics.some((m) => m.date === viewDate && m.restDay),
    [metrics, viewDate],
  );
  // La sesión sugerida se arma sobre HOY (no sobre el día que se esté mirando):
  // es una decisión sobre lo que hay que hacer ahora, no sobre el pasado.
  const [sessionOpen, setSessionOpen] = useState(false);
  const todaySets = useMemo(
    () => strengthSets.filter((s) => s.date === today),
    [strengthSets, today],
  );
  const session = useMemo(
    () =>
      buildTodaySession({
        state,
        today,
        daySets: todaySets,
        swaps: planSwaps,
        picks: planPicks,
        plan,
      }),
    [state, today, todaySets, planSwaps, planPicks, plan],
  );

  // La rutina del día que se está viendo, con sus cambios ya aplicados. Si ese
  // día cae en vacaciones manda lo que hayas elegido, y si no elegiste nada, la
  // rutina corta de viaje.
  const planDay = useMemo(
    () =>
      applySwaps(
        planDayFor(
          viewDate,
          vacations,
          (iso) => getPlanDay(iso, plan),
          planPicks,
          plan,
        ),
        planSwaps,
        viewDate,
      ),
    [planPicks, planSwaps, vacations, viewDate, plan],
  );
  // De viaje el calendario no manda: el día lo elegís vos, y solo para ese día.
  const deViaje = useMemo(
    () => !!vacationOn(vacations, viewDate),
    [vacations, viewDate],
  );
  const elegido = pickedDow(planPicks, viewDate) ?? VACATION_DOW;

  // Lo último que hiciste en cada ejercicio de la rutina, antes del día que se
  // ve: de ahí sale el peso sugerido. Se compara por nombre canónico para que
  // "Abductor" y "Abducción de Cadera en Máquina" sean el mismo historial.
  const lastByExercise = useMemo(() => {
    const canon = new Map<string, string>();
    const key = (n: string) => {
      let k = canon.get(n);
      if (k === undefined) canon.set(n, (k = canonicalName(n).trim().toLowerCase()));
      return k;
    };
    const same = (a: string, b: string) => key(a) === key(b);
    const out = new Map<string, LastPerformance>();
    for (const ex of planDay.exercises) {
      const last = lastPerformance(
        strengthSets,
        ex.name,
        viewDate,
        ex.sets,
        same,
        kindOf(ex.name),
      );
      if (last) out.set(ex.name, last);
    }
    return out;
  }, [planDay, strengthSets, viewDate, kindOf]);

  // Tocar un ejercicio de la rutina lo carga con tu último peso y reps (o el
  // siguiente escalón si la última vez topeaste el rango en todas las series).
  const selectExercise = (name: string) => {
    setExercise(name);
    const last = lastByExercise.get(name);
    if (last) {
      const t = nextTarget(last, kindOf(name));
      setWeight(String(t.weight));
      setReps(String(t.reps));
    }
  };

  // El slot que se está cambiando: hace falta su original para poder volver
  // atrás y para sugerir sobre el ejercicio del plan, no sobre el reemplazo.
  const swapSlot = swapping
    ? planDay.exercises.find((e) => e.name === swapping)
    : undefined;

  const used = useMemo(() => usedExercises(strengthSets), [strengthSets]);
  // Historial y comunes primero (lo más relevante), luego el catálogo canónico
  // de RepDB (400 ejercicios) para autocompletar con nombres consistentes.
  const options = useMemo(
    () => [...new Set([...used, ...COMMON_LIFTS, ...exerciseNames])],
    [used],
  );

  const selectedProg = progExercise ?? used[0] ?? null;
  const progKind = selectedProg ? kindOf(selectedProg) : "peso";
  const progData = useMemo(
    () =>
      selectedProg
        ? exerciseProgress(
            strengthSets,
            selectedProg,
            progKind,
            bodyweightOn,
          ).map((p) => ({
            label: shortDate(p.date),
            // Sin peso corporal, una asistida va en negativo (para que el PR
            // sea la menor ayuda); en el gráfico se muestra la asistencia.
            peso: Math.abs(p.value),
          }))
        : [],
    [strengthSets, selectedProg, progKind, bodyweightOn],
  );
  const progTooltip = (v: number): [string, string] =>
    progKind === "tiempo"
      ? [fmtSeconds(v), "Mejor tiempo"]
      : progKind === "reps"
        ? [`${v} reps`, "Máx. reps"]
        : progKind === "asistido"
          ? bwToday > 0
            ? [`${v} kg`, "Kg netos (peso − asistencia)"]
            : [`${v} kg`, "Asistencia"]
          : [`${v} kg`, "Peso máx."];
  const progAxis = useMemo(
    () => yAxis(progData.map((p) => p.peso)),
    [progData],
  );

  // Foto y medición de lo escrito (del catálogo o tuyas).
  const image = exercise.trim() ? imageOf(exercise) : null;
  const kind: ExerciseKind = exercise.trim() ? kindOf(exercise) : "peso";

  const canAdd = exercise.trim() !== "" && Number(reps) > 0;
  const submit = () => {
    if (!canAdd) return;
    // Para un día pasado se ancla el createdAt al mediodía de ese día + 1 min por
    // serie ya cargada: cae en el día correcto y preserva el orden de la sesión.
    const createdAt = isToday
      ? undefined
      : startOfLocalDayMs(viewDate) + daySets.length * 60_000;
    onAddSet(exercise.trim(), Number(reps), storedWeight(kind, weight), viewDate, createdAt);
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
        storedWeight(kindOf(addingTo), newWeight),
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

      {/* "¿Qué hago hoy?". Va a pedido, en un sheet: la rutina del plan ya está
          abajo, y dos rutinas compitiendo en la misma pantalla fue justamente
          el problema que sacamos. */}
      {isToday && hasPlan && (
        <button
          type="button"
          onClick={() => setSessionOpen(true)}
          className="flex min-h-14 items-center justify-center gap-2.5 rounded-card bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-e1 transition-transform duration-(--duration-fast) active:scale-[0.98]"
        >
          <Compass size={20} strokeWidth={2.25} aria-hidden />
          ¿Qué hago hoy?
        </button>
      )}

      {/* Descanso del día. Sin este botón, no cargar series era ambiguo: podía
          ser "descansé" o "me olvidé", y la app siempre leía lo segundo (te
          avisaba de días seguidos sin descanso aunque hubieras parado). */}
      {restDay ? (
        <section className="flex items-center gap-3 rounded-card border-l-4 border-l-primary bg-card px-4 py-3 shadow-e1">
          <span className="text-lg leading-none" aria-hidden>
            🧘
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {isToday ? "Hoy descansás" : `Descanso — ${dayLabel(viewDate)}`}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {daySets.length > 0
                ? "Cargaste series este día, así que cuenta como entrenamiento."
                : "No cuenta como día sin entrenar y corta la racha de fatiga."}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSetRestDay(viewDate, false)}
          >
            Quitar
          </Button>
        </section>
      ) : (
        daySets.length === 0 && (
          <button
            type="button"
            onClick={() => onSetRestDay(viewDate, true)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-card border border-dashed border-border px-4 py-3 text-sm font-medium text-muted transition-colors active:scale-[0.99] hover:border-primary hover:text-primary"
          >
            <Moon size={16} strokeWidth={2} aria-hidden />
            Marcar {isToday ? "hoy" : dayLabel(viewDate)} como día de descanso
          </button>
        )
      )}

      {/* De vacaciones, el día lo elegís. Es la contracara del modo: si no hay
          calendario que cumplir, tampoco hay uno que te diga qué toca — y si
          apareció un gimnasio en el viaje, la rutina corta no alcanza. */}
      {hasPlan && deViaje && onPickPlanDay && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">
            ¿Qué entrenás {isToday ? "hoy" : `el ${dayLabel(viewDate)}`}?
          </h2>
          <p className="text-xs text-muted">
            Estás de vacaciones: elegí el día del plan que quieras. Vale solo
            para este día, así que mañana volvés a elegir.
          </p>
          <div className="flex flex-wrap gap-2">
            {vacationOptions(plan).map((d) => (
              <Chip
                key={d.dow}
                selected={elegido === d.dow}
                onClick={() => onPickPlanDay(viewDate, d.dow)}
              >
                <span aria-hidden>{d.emoji}</span>
                {d.dow === VACATION_DOW
                  ? "Rutina de viaje"
                  : `${DOW_SHORT[d.dow]} · ${shortPlanLabel(d)}`}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* La rutina de la semana (el plan del mes con tus ediciones), para el
          día que se está viendo. Sin plan ni rutina propia, la invitación a
          armarla. */}
      {hasRoutine ? (
        <PlanDayCard
          planDay={planDay}
          daySets={daySets}
          isToday={isToday}
          viewDate={viewDate}
          lastByExercise={lastByExercise}
          onSelectExercise={selectExercise}
          onSwapExercise={onSwapExercise ? setSwapping : undefined}
          onEditRoutine={onSaveRoutineDay ? () => setRoutineOpen(true) : undefined}
          kindOf={kindOf}
        />
      ) : (
        onSaveRoutineDay && (
          <button
            type="button"
            onClick={() => setRoutineOpen(true)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-card border border-dashed border-border px-4 py-3 text-sm font-medium text-primary transition-colors active:scale-[0.99] hover:border-primary"
          >
            <Pencil size={15} strokeWidth={2} aria-hidden />
            Armá tu rutina semanal
          </button>
        )
      )}

      {/* Alta de serie (hoy o un día pasado que estés completando) */}
      <section className="flex flex-col gap-4 rounded-card bg-card p-4 shadow-e1">
        {!isToday && (
          <p className="text-xs font-medium text-accent">
            Cargando series en {dayLabel(viewDate)}
          </p>
        )}

        <div className="flex items-center gap-2">
          {image && (
            <ExerciseImage
              image={image}
              name={exercise}
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

        {/* Cómo se mide lo que escribiste. Viene del catálogo, pero se puede
            corregir acá mismo: queda guardado para ese ejercicio. */}
        {exercise.trim() && onSaveExercise && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Se mide por:</span>
            {KINDS.map((k) => (
              <Chip
                key={k.key}
                tone="accent"
                selected={kind === k.key}
                className="min-h-7! px-2.5! text-xs!"
                onClick={() =>
                  kind !== k.key &&
                  onSaveExercise({
                    id: findCustom(exercise)?.id,
                    name: findCustom(exercise)?.name ?? exercise.trim(),
                    kind: k.key,
                    image: imageOf(exercise) ?? "",
                    group: findCustom(exercise)?.group ?? "",
                  })
                }
              >
                {k.label}
              </Chip>
            ))}
          </div>
        )}

        {/* El peso salta de a 5 kg (para 10, dos toques); para ajustes finos
            el campo sigue siendo editable a mano. */}
        <SetFields
          kind={kind}
          reps={reps}
          weight={weight}
          onReps={setReps}
          onWeight={setWeight}
          bodyweight={bwToday}
        />

        <Button variant="accent" size="lg" full onClick={submit} disabled={!canAdd}>
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          Agregar serie
        </Button>

        {restSince != null && (
          <RestTimer since={restSince} onDismiss={() => setRestSince(null)} />
        )}

        <p className="text-xs text-muted">
          Los valores quedan cargados para repetir la serie de un toque.
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
            const gKind = kindOf(g.exercise);
            const bw = bodyweightOn(viewDate);
            // PR y resumen según cómo se mide: kg, asistencia, reps o tiempo.
            const pr = prs.get(g.exercise) ?? 0;
            const top = Math.max(...g.sets.map((s) => setScore(s, gKind, bw)));
            const isPr = top >= pr && top !== 0;
            const summary =
              gKind === "tiempo"
                ? fmtSeconds(g.sets.reduce((a, s) => a + s.reps, 0))
                : gKind === "reps"
                  ? `${g.sets.reduce((a, s) => a + s.reps, 0)} reps`
                  : `${Math.round(
                      g.sets.reduce((a, s) => a + loadVolume(s, gKind, bw), 0),
                    ).toLocaleString("es-AR")} kg`;
            return (
              <div
                key={g.exercise}
                className="rounded-card bg-card p-4 shadow-e1"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex min-w-0 items-center gap-2 font-semibold">
                    <ExerciseImage
                      image={imageOf(g.exercise)}
                      name={g.exercise}
                      className="h-9 w-9"
                    />
                    <span className="min-w-0">{g.exercise}</span>
                    {isPr && (
                      <span
                        className="ml-2 align-middle text-xs text-accent"
                        title="Récord personal"
                      >
                        🏆 PR
                      </span>
                    )}
                  </h3>
                  <span className="shrink-0 pl-2 text-xs text-muted tabular-nums">
                    {summary}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {g.sets.map((s, i) =>
                    editId === s.id ? (
                      <li key={s.id}>
                        <SetForm
                          kind={gKind}
                          bodyweight={bw}
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
                          {fmtSet(s, gKind)}
                        </span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-primary"
                            aria-label={`Editar serie: ${fmtSet(s, gKind)}`}
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSet(s.id)}
                            className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                            aria-label={`Eliminar serie: ${fmtSet(s, gKind)}`}
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
                      kind={gKind}
                      bodyweight={bw}
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
                      PR: {fmtScore(pr, gKind, bw > 0)} · {g.sets.length}{" "}
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
                    formatter={(v) => progTooltip(Number(v))}
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

      {sessionOpen && (
        <SessionSheet
          session={session}
          onSelectExercise={selectExercise}
          onClose={() => setSessionOpen(false)}
        />
      )}

      {swapping && (
        <SwapExerciseSheet
          exercise={swapping}
          swappedFrom={swapSlot?.swappedFrom}
          onSwap={(to) =>
            onSwapExercise?.(viewDate, swapSlot?.swappedFrom ?? swapping, to)
          }
          onUndo={() =>
            swapSlot?.swappedFrom && onUndoSwap?.(viewDate, swapSlot.swappedFrom)
          }
          onClose={() => setSwapping(null)}
        />
      )}

      {pickerOpen && (
        <ExercisePickerSheet
          strengthSets={strengthSets}
          customExercises={customExercises}
          imageOf={imageOf}
          onSelect={setExercise}
          onSaveExercise={onSaveExercise}
          onRemoveExercise={onRemoveCustomExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {routineOpen && onSaveRoutineDay && onResetRoutineDay && onSaveExercise && onRemoveCustomExercise && (
        <RoutineEditorSheet
          plan={plan}
          basePlan={basePlan}
          savedDows={savedDows}
          initialDow={new Date(`${viewDate}T00:00:00`).getDay()}
          strengthSets={strengthSets}
          customExercises={customExercises}
          kindOf={kindOf}
          imageOf={imageOf}
          onSaveDay={onSaveRoutineDay}
          onResetDay={onResetRoutineDay}
          onSaveExercise={onSaveExercise}
          onRemoveExercise={onRemoveCustomExercise}
          onClose={() => setRoutineOpen(false)}
        />
      )}
    </main>
  );
}
