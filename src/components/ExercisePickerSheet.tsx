"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/Field";
import ExerciseImage from "@/components/ExerciseImage";
import ExerciseEditor, {
  draftFor,
  type ExerciseDraft,
} from "@/components/ExerciseEditor";
import { usedExercises } from "@/lib/gym";
import { KINDS } from "@/lib/exerciseKind";
import {
  MUSCLE_GROUPS,
  equipmentLabel,
  exercisesByGroup,
  mechanicLabel,
  searchExercises,
  type DbExercise,
  type MuscleGroup,
} from "@/lib/exerciseDb";
import type { CustomExercise, StrengthSet } from "@/lib/types";

const norm = (s: string) => s.trim().toLowerCase();

/**
 * El cuerpo del buscador, sin el sheet: el editor de rutina lo muestra adentro
 * del suyo, porque dos sheets apilados se pelean el foco y el gesto.
 */
export function ExercisePicker({
  strengthSets,
  customExercises = [],
  imageOf,
  onPick,
  onCreate,
  onEdit,
}: {
  strengthSets: StrengthSet[];
  /** Los ejercicios propios del usuario: van arriba de todo. */
  customExercises?: CustomExercise[];
  /** Foto de cada ejercicio con las elegidas por el usuario encima. */
  imageOf?: (name: string) => string | null;
  onPick: (name: string) => void;
  /** Crear un ejercicio nuevo (con lo buscado como nombre de arranque). */
  onCreate?: (name: string) => void;
  /** Editar uno propio. */
  onEdit?: (c: CustomExercise) => void;
}) {
  const [group, setGroup] = useState<MuscleGroup>("pecho");
  const [query, setQuery] = useState("");
  const q = query.trim();

  const byGroup = useMemo(() => exercisesByGroup(), []);
  const recents = useMemo(
    () => usedExercises(strengthSets).slice(0, 6),
    [strengthSets],
  );
  const results: DbExercise[] = useMemo(
    () => (q ? searchExercises(q) : byGroup[group]),
    [q, group, byGroup],
  );
  // Los propios, filtrados por lo que se busca o por el grupo elegido. Los que
  // no tienen grupo se ven siempre sin búsqueda: si no, quedarían escondidos.
  const mine = useMemo(
    () =>
      customExercises.filter((c) =>
        q ? norm(c.name).includes(norm(q)) : !c.group || c.group === group,
      ),
    [customExercises, q, group],
  );
  const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? k;
  const exact =
    !!q &&
    (results.some((r) => norm(r.name_es) === norm(q)) ||
      customExercises.some((c) => norm(c.name) === norm(q)));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          className={`${inputCls} pl-11`}
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar ejercicio"
        />
      </div>

      {onCreate && !exact && (
        <button
          type="button"
          onClick={() => onCreate(q)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-dashed border-primary px-4 text-sm font-medium text-primary transition-transform duration-(--duration-fast) active:scale-[0.99]"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
          {q ? `Crear «${q}»` : "Crear ejercicio propio"}
        </button>
      )}

      {/* Recientes: re-elegir de un toque */}
      {!q && recents.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">Recientes</span>
          <div className="flex flex-wrap gap-2">
            {recents.map((name) => (
              <Chip key={name} onClick={() => onPick(name)}>
                {name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Chips de grupo muscular (ocultos al buscar por texto) */}
      {!q && (
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g.key}
              selected={group === g.key}
              onClick={() => setGroup(g.key)}
            >
              {g.emoji} {g.label}
            </Chip>
          ))}
        </div>
      )}

      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">Tus ejercicios</span>
          <ul className="flex flex-col gap-2">
            {mine.map((c) => (
              <li key={c.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => onPick(c.name)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-control bg-sunken p-2 text-left transition-transform duration-(--duration-fast) active:scale-[0.99]"
                >
                  <ExerciseImage
                    image={c.image || null}
                    name={c.name}
                    className="h-14 w-14"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {kindLabel(c.kind)}
                    </span>
                  </span>
                </button>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    aria-label={`Editar ${c.name}`}
                    className="grid w-11 shrink-0 place-items-center rounded-control bg-sunken text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-primary"
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lista de ejercicios. Sin scroll propio: el cuerpo del sheet ya
          scrollea, y dos áreas anidadas hacen que el gesto elija mal. */}
      <ul className="flex flex-col gap-2">
        {results.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted">
            Sin resultados. Probá otro nombre o grupo.
          </li>
        ) : (
          results.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => onPick(ex.name_es)}
                className="flex w-full items-center gap-3 rounded-control bg-sunken p-2 text-left transition-transform duration-(--duration-fast) active:scale-[0.99]"
              >
                <ExerciseImage
                  image={imageOf ? imageOf(ex.name_es) : ex.image}
                  name={ex.name_es}
                  className="h-14 w-14"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {ex.name_es}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{equipmentLabel(ex.equipment)}</span>
                    {mechanicLabel(ex.mechanic) && (
                      <span className="rounded-full bg-border/60 px-1.5 py-0.5 text-[10px]">
                        {mechanicLabel(ex.mechanic)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Plus size={17} strokeWidth={2.5} aria-hidden />
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {/* Atribución obligatoria del dataset (licencia RepDB). */}
      <p className="text-center text-[11px] text-muted">
        Exercise data &amp; images by{" "}
        <a
          href="https://repdb.co"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          RepDB (repdb.co)
        </a>
      </p>
    </div>
  );
}

/**
 * Buscador visual de ejercicios por grupo muscular. Al elegir uno, se
 * autocompleta el nombre en el alta de series (el usuario solo pone reps/peso).
 *
 * Con `onSaveExercise` se puede además crear o editar un ejercicio propio sin
 * salir del sheet: el cuerpo pasa a ser el editor y "Volver" regresa a la lista.
 */
export default function ExercisePickerSheet({
  onSelect,
  onClose,
  onSaveExercise,
  onRemoveExercise,
  ...rest
}: Omit<
  React.ComponentProps<typeof ExercisePicker>,
  "onPick" | "onCreate" | "onEdit"
> & {
  onSelect: (name: string) => void;
  onClose: () => void;
  onSaveExercise?: (d: ExerciseDraft) => void;
  onRemoveExercise?: (id: string) => void;
}) {
  const [editing, setEditing] = useState<{
    draft: ExerciseDraft;
    isNew: boolean;
  } | null>(null);

  return (
    <Sheet
      title={
        editing ? (editing.isNew ? "Nuevo ejercicio" : "Editar ejercicio") : "Elegí un ejercicio"
      }
      onClose={onClose}
    >
      {editing ? (
        <ExerciseEditor
          initial={editing.draft}
          nameLocked={!editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={(d) => {
            onSaveExercise?.(d);
            setEditing(null);
            // Uno recién creado se elige directo: para eso se creó.
            if (editing.isNew) {
              onSelect(d.name);
              onClose();
            }
          }}
          onDelete={
            !editing.isNew && editing.draft.id && onRemoveExercise
              ? () => {
                  onRemoveExercise(editing.draft.id!);
                  setEditing(null);
                }
              : undefined
          }
        />
      ) : (
        <ExercisePicker
          {...rest}
          onPick={(name) => {
            onSelect(name);
            onClose();
          }}
          onCreate={
            onSaveExercise
              ? (name) => setEditing({ draft: draftFor(name), isNew: true })
              : undefined
          }
          onEdit={
            onSaveExercise
              ? (c) =>
                  setEditing({
                    draft: {
                      id: c.id,
                      name: c.name,
                      kind: c.kind,
                      image: c.image,
                      group: c.group,
                    },
                    isNew: false,
                  })
              : undefined
          }
        />
      )}
    </Sheet>
  );
}
