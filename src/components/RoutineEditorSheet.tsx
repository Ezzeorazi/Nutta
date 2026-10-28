"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import { Field, inputCls } from "@/components/ui/Field";
import ExerciseImage from "@/components/ExerciseImage";
import ExerciseEditor, {
  draftFor,
  type ExerciseDraft,
} from "@/components/ExerciseEditor";
import { ExercisePicker } from "@/components/ExercisePickerSheet";
import { DOW_SHORT, type PlanDay } from "@/lib/plan";
import { WEEK_ORDER, emptyDay } from "@/lib/routine";
import { KINDS, customFinder, defaultScheme, type KindOf } from "@/lib/exerciseKind";
import type { CustomExercise, StrengthSet } from "@/lib/types";

type View =
  | { kind: "day" }
  /** Elegir un ejercicio: para sumarlo (`slot` null) o para reemplazar uno. */
  | { kind: "pick"; slot: number | null }
  | { kind: "edit"; draft: ExerciseDraft; isNew: boolean; slot: number | null };

const copyDay = (d: PlanDay): PlanDay => ({
  ...d,
  exercises: d.exercises.map((e) => ({ ...e })),
});

/**
 * Editor de la rutina semanal: qué ejercicios, en qué orden, con qué esquema.
 *
 * Trabaja sobre un borrador de toda la semana y guarda solo los días tocados.
 * Un día guardado pisa al del plan fijo; "Volver al plan" borra el registro y
 * el día vuelve a ser el original (ver `lib/routine.ts`). Los cambios de un
 * día puntual ("la máquina estaba ocupada") siguen yendo por el ⇄ de la
 * rutina, que no toca la semana.
 *
 * Elegir y crear ejercicios pasa DENTRO de este mismo sheet, cambiando de
 * vista: dos sheets apilados se pelean el foco y el gesto de cerrar.
 */
export default function RoutineEditorSheet({
  plan,
  basePlan,
  savedDows,
  initialDow,
  strengthSets,
  customExercises,
  kindOf,
  imageOf,
  onSaveDay,
  onResetDay,
  onSaveExercise,
  onRemoveExercise,
  onClose,
}: {
  /** La semana vigente (plan fijo + días editados). */
  plan: PlanDay[];
  /** El plan fijo, sin ediciones: a esto vuelve un día restaurado. */
  basePlan: PlanDay[];
  /** Días que tienen una edición guardada. */
  savedDows: Set<number>;
  initialDow: number;
  strengthSets: StrengthSet[];
  customExercises: CustomExercise[];
  kindOf: KindOf;
  imageOf: (name: string) => string | null;
  onSaveDay: (day: PlanDay) => void;
  onResetDay: (dow: number) => void;
  onSaveExercise: (d: ExerciseDraft) => void;
  onRemoveExercise: (id: string) => void;
  onClose: () => void;
}) {
  const [dow, setDow] = useState(initialDow);
  const [drafts, setDrafts] = useState<Record<number, PlanDay>>(() =>
    Object.fromEntries(
      WEEK_ORDER.map((d) => [
        d,
        copyDay(plan.find((p) => p.dow === d) ?? emptyDay(d)),
      ]),
    ),
  );
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [view, setView] = useState<View>({ kind: "day" });

  const day = drafts[dow];
  const findCustom = customFinder(customExercises);
  const hasBase = basePlan.some((d) => d.dow === dow);

  const update = (patch: Partial<PlanDay>) => {
    setDrafts((p) => ({ ...p, [dow]: { ...p[dow], ...patch } }));
    setDirty((p) => new Set(p).add(dow));
  };
  const setExercises = (fn: (xs: PlanDay["exercises"]) => PlanDay["exercises"]) =>
    update({ exercises: fn(day.exercises) });

  const move = (i: number, by: -1 | 1) =>
    setExercises((xs) => {
      const j = i + by;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /** Pone un ejercicio en la rutina: en el lugar de otro o al final. */
  const place = (name: string, slot: number | null, kind = kindOf(name)) => {
    if (slot == null) {
      setExercises((xs) => [...xs, { name, sets: defaultScheme(kind) }]);
    } else {
      // Al reemplazar se queda el esquema (mismo estímulo) salvo que cambie la
      // forma de medir: "4 × 8-10" no tiene sentido para una plancha.
      setExercises((xs) =>
        xs.map((e, i) =>
          i !== slot
            ? e
            : {
                name,
                sets:
                  (kind === "tiempo") === /\d\s*s\b/.test(e.sets)
                    ? e.sets
                    : defaultScheme(kind),
              },
        ),
      );
    }
    setView({ kind: "day" });
  };

  const toggleRest = () => {
    const rest = !day.rest;
    update({
      rest,
      label: rest
        ? "Descanso"
        : day.label === "Descanso" || day.label === "Sin rutina"
          ? ""
          : day.label,
      emoji: rest ? "🧘" : day.emoji === "🧘" || day.emoji === "📭" ? "💪" : day.emoji,
    });
  };

  const save = () => {
    for (const d of dirty) onSaveDay(drafts[d]);
    setDirty(new Set());
    onClose();
  };

  const reset = () => {
    const msg = hasBase
      ? "¿Volver este día al plan original? Se pierden los cambios que le hiciste."
      : "¿Vaciar este día? Se borran sus ejercicios.";
    if (!window.confirm(msg)) return;
    onResetDay(dow);
    setDrafts((p) => ({
      ...p,
      [dow]: copyDay(basePlan.find((d) => d.dow === dow) ?? emptyDay(dow)),
    }));
    setDirty((p) => {
      const next = new Set(p);
      next.delete(dow);
      return next;
    });
  };

  const editExercise = (name: string, slot: number) => {
    const c = findCustom(name);
    setView({
      kind: "edit",
      isNew: false,
      slot,
      draft: c
        ? { id: c.id, name: c.name, kind: c.kind, image: c.image, group: c.group }
        : { ...draftFor(name), name, kind: kindOf(name) },
    });
  };

  // --- Vistas secundarias ---------------------------------------------------

  if (view.kind === "pick") {
    return (
      <Sheet
        title={view.slot == null ? "Agregar ejercicio" : "Cambiar ejercicio"}
        onClose={onClose}
      >
        <div className="flex flex-col gap-4">
          <BackButton onClick={() => setView({ kind: "day" })} />
          <ExercisePicker
            strengthSets={strengthSets}
            customExercises={customExercises}
            imageOf={imageOf}
            onPick={(name) => place(name, view.slot)}
            onCreate={(name) =>
              setView({ kind: "edit", draft: draftFor(name), isNew: true, slot: view.slot })
            }
            onEdit={(c) =>
              setView({
                kind: "edit",
                isNew: false,
                slot: null,
                draft: { id: c.id, name: c.name, kind: c.kind, image: c.image, group: c.group },
              })
            }
          />
        </div>
      </Sheet>
    );
  }

  if (view.kind === "edit") {
    return (
      <Sheet
        title={view.isNew ? "Nuevo ejercicio" : "Editar ejercicio"}
        onClose={onClose}
      >
        <ExerciseEditor
          initial={view.draft}
          nameLocked={!view.isNew}
          onCancel={() =>
            setView(view.isNew ? { kind: "pick", slot: view.slot } : { kind: "day" })
          }
          onSave={(d) => {
            onSaveExercise(d);
            // Uno recién creado va directo a la rutina: para eso se creó.
            if (view.isNew) place(d.name, view.slot, d.kind);
            else setView({ kind: "day" });
          }}
          onDelete={
            !view.isNew && view.draft.id
              ? () => {
                  onRemoveExercise(view.draft.id!);
                  setView({ kind: "day" });
                }
              : undefined
          }
        />
      </Sheet>
    );
  }

  // --- El día ---------------------------------------------------------------

  return (
    <Sheet
      title="Editar rutina"
      description="Los cambios valen para todas las semanas. Para un cambio de un solo día, usá ⇄ en la rutina."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {savedDows.has(dow) && (
            <Button variant="secondary" onClick={reset}>
              <RotateCcw size={15} aria-hidden />
              {hasBase ? "Volver al plan" : "Vaciar"}
            </Button>
          )}
          <Button
            variant="accent"
            className="flex-1"
            onClick={save}
            disabled={dirty.size === 0}
          >
            Guardar{dirty.size > 1 ? ` ${dirty.size} días` : ""}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Día de la semana">
          {WEEK_ORDER.map((d) => (
            <Chip
              key={d}
              role="tab"
              selected={d === dow}
              onClick={() => setDow(d)}
            >
              {DOW_SHORT[d]}
              {dirty.has(d) && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="sin guardar" />
              )}
            </Chip>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className={`${inputCls} w-16 text-center`}
            value={day.emoji}
            onChange={(e) => update({ emoji: e.target.value })}
            aria-label="Emoji del día"
            maxLength={4}
          />
          <input
            className={inputCls}
            placeholder="Nombre (ej. Empuje A)"
            value={day.label}
            onChange={(e) => update({ label: e.target.value })}
            aria-label="Nombre del día"
          />
        </div>

        <Chip selected={!!day.rest} onClick={toggleRest} className="self-start">
          🧘 Día de descanso
        </Chip>

        {!day.rest && (
          <div className="flex flex-col gap-2">
            {day.exercises.length === 0 && (
              <p className="rounded-card border border-dashed border-border p-4 text-center text-sm text-muted">
                Este día no tiene ejercicios. Sumá el primero.
              </p>
            )}
            {day.exercises.map((ex, i) => {
              const kind = KINDS.find((k) => k.key === kindOf(ex.name));
              return (
                <div
                  key={`${i}-${ex.name}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-2"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setView({ kind: "pick", slot: i })}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-label={`Cambiar ${ex.name} por otro ejercicio`}
                    >
                      <ExerciseImage
                        image={imageOf(ex.name)}
                        name={ex.name}
                        className="h-12 w-12"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {ex.name}
                        </span>
                        <span className="block text-xs text-muted">{kind?.label}</span>
                      </span>
                    </button>
                    <IconButton
                      label={`Editar ${ex.name}`}
                      onClick={() => editExercise(ex.name, i)}
                    >
                      <Pencil size={14} aria-hidden />
                    </IconButton>
                    <div className="flex flex-col">
                      <IconButton
                        label="Subir"
                        small
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronUp size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label="Bajar"
                        small
                        disabled={i === day.exercises.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown size={15} aria-hidden />
                      </IconButton>
                    </div>
                    <IconButton
                      label={`Quitar ${ex.name}`}
                      danger
                      onClick={() =>
                        setExercises((xs) => xs.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 size={14} aria-hidden />
                    </IconButton>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={`${inputCls} w-36 shrink-0`}
                      placeholder="4 × 8-10"
                      value={ex.sets}
                      onChange={(e) =>
                        setExercises((xs) =>
                          xs.map((x, j) => (j === i ? { ...x, sets: e.target.value } : x)),
                        )
                      }
                      aria-label={`Series de ${ex.name}`}
                    />
                    <input
                      className={inputCls}
                      placeholder="Nota (ej. en Smith)"
                      value={ex.weight ?? ""}
                      onChange={(e) =>
                        setExercises((xs) =>
                          xs.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)),
                        )
                      }
                      aria-label={`Nota de ${ex.name}`}
                    />
                  </div>
                </div>
              );
            })}
            <Button variant="secondary" onClick={() => setView({ kind: "pick", slot: null })}>
              <Plus size={16} strokeWidth={2.5} aria-hidden />
              Agregar ejercicio
            </Button>
          </div>
        )}

        <Field
          label={day.rest ? "Qué hacer ese día" : "Cardio"}
          hint={day.rest ? undefined : "Opcional. Ej.: 10-15 min cinta suave"}
        >
          <input
            className={inputCls}
            value={day.cardio ?? ""}
            onChange={(e) => update({ cardio: e.target.value })}
            placeholder={day.rest ? "Caminata + movilidad" : "10-15 min cinta"}
          />
        </Field>
      </div>
    </Sheet>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start text-sm font-medium text-primary"
    >
      <ArrowLeft size={16} aria-hidden />
      Volver a la rutina
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger = false,
  small = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`grid shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-30 ${
        small ? "h-6 w-8" : "h-9 w-9"
      } ${danger ? "hover:text-accent" : "hover:text-primary"}`}
    >
      {children}
    </button>
  );
}
