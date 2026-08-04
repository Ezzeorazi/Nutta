"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/Field";
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

        {/* Recientes: re-elegir de un toque */}
        {!query.trim() && recents.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">Recientes</span>
            <div className="flex flex-wrap gap-2">
              {recents.map((name) => (
                <Chip key={name} onClick={() => pick(name)}>
                  {name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Chips de grupo muscular (ocultos al buscar por texto) */}
        {!query.trim() && (
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
                  onClick={() => pick(ex.name_es)}
                  className="flex w-full items-center gap-3 rounded-control bg-sunken p-2 text-left transition-transform duration-(--duration-fast) active:scale-[0.99]"
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
    </Sheet>
  );
}
