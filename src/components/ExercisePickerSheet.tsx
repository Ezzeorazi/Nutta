"use client";

import { useMemo, useState } from "react";
import Sheet, { inputCls } from "@/components/Sheet";
import ExerciseImage from "@/components/ExerciseImage";
import { usedExercises } from "@/lib/gym";
import {
  MUSCLE_GROUPS,
  equipmentLabel,
  exercisesByGroup,
  mechanicLabel,
  searchExercises,
  type DbExercise,
  type MuscleGroup,
} from "@/lib/exerciseDb";
import type { StrengthSet } from "@/lib/types";

/**
 * Buscador visual de ejercicios por grupo muscular. Al elegir uno, se
 * autocompleta el nombre en el alta de series (el usuario solo pone reps/peso).
 */
export default function ExercisePickerSheet({
  strengthSets,
  onSelect,
  onClose,
}: {
  strengthSets: StrengthSet[];
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<MuscleGroup>("pecho");
  const [query, setQuery] = useState("");

  const byGroup = useMemo(() => exercisesByGroup(), []);
  const recents = useMemo(
    () => usedExercises(strengthSets).slice(0, 6),
    [strengthSets],
  );
  const results: DbExercise[] = useMemo(
    () => (query.trim() ? searchExercises(query) : byGroup[group]),
    [query, group, byGroup],
  );

  const pick = (name: string) => {
    onSelect(name);
    onClose();
  };

  return (
    <Sheet title="Elegí un ejercicio" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          className={inputCls}
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {/* Recientes: re-elegir de un toque */}
        {!query.trim() && recents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Recientes</span>
            <div className="flex flex-wrap gap-1.5">
              {recents.map((name) => (
                <button
                  key={name}
                  onClick={() => pick(name)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs active:scale-95 hover:border-primary"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chips de grupo muscular (ocultos al buscar por texto) */}
        {!query.trim() && (
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroup(g.key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${
                  group === g.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        )}

        {/* Lista de ejercicios */}
        <ul className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">
              Sin resultados. Probá otro nombre o grupo.
            </li>
          ) : (
            results.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => pick(ex.name_es)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-2 text-left transition active:scale-[0.99] hover:border-primary"
                >
                  <ExerciseImage
                    image={ex.image}
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
                  <span className="shrink-0 text-lg text-primary">+</span>
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
    </Sheet>
  );
}
