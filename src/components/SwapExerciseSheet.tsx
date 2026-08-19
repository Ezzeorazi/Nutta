"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/Field";
import ExerciseImage from "@/components/ExerciseImage";
import {
  alternativesFor,
  equipmentLabel,
  mechanicLabel,
  muscleLabel,
  muscleWork,
  searchExercises,
  type Alternative,
} from "@/lib/exerciseDb";

/**
 * "La máquina está ocupada": cambiar un ejercicio de la rutina por otro que
 * trabaje lo mismo.
 *
 * Las opciones salen del catálogo filtradas por MÚSCULO, no por nombre: lo que
 * hace falta cuando no podés hacer un ejercicio es otro que compense el mismo
 * estímulo, y eso no se deduce de cómo se llama. Cada opción dice qué comparte
 * con el original y con qué equipo se hace, que es lo que decide si te sirve
 * ahora mismo.
 */
export default function SwapExerciseSheet({
  exercise,
  swappedFrom,
  onSwap,
  onUndo,
  onClose,
}: {
  /** El ejercicio que se está por reemplazar (el actual de la rutina). */
  exercise: string;
  /** Si ya era un reemplazo, el original del plan (para poder volver). */
  swappedFrom?: string;
  onSwap: (to: string) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  // Las alternativas se calculan sobre el ejercicio ORIGINAL del plan: si ya
  // cambiaste una vez, lo que hay que sustituir sigue siendo aquel, no el
  // reemplazo (o cada cambio te alejaría un poco más del músculo de origen).
  const base = swappedFrom ?? exercise;
  const work = useMemo(() => muscleWork(base), [base]);
  const alts = useMemo(() => alternativesFor(base, 12), [base]);

  // Buscar por nombre es la salida cuando la máquina que querés no está en la
  // lista: el catálogo entero, con los mismos datos a la vista.
  const found: Alternative[] = useMemo(() => {
    if (!query.trim()) return [];
    return searchExercises(query, 20).map((ex) => ({
      exercise: ex,
      shared: ex.primary_muscles
        .filter((m) => work.match?.primary_muscles.includes(m))
        .map(muscleLabel),
      otherEquipment: ex.equipment !== work.match?.equipment,
    }));
  }, [query, work]);

  const list = query.trim() ? found : alts;

  const pick = (name: string) => {
    onSwap(name);
    onClose();
  };

  return (
    <Sheet title="Cambiar ejercicio" description={exercise} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Qué hay que reemplazar: sin esto no se puede juzgar si una
            alternativa sirve o si te deja el músculo sin trabajar. */}
        {work.primary.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-control bg-sunken px-3.5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {base} trabaja
            </p>
            <p className="text-sm">
              <span className="font-medium">{work.primary.join(", ")}</span>
              {work.secondary.length > 0 && (
                <span className="text-muted">
                  {" "}
                  · asisten {work.secondary.join(", ")}
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="rounded-control bg-sunken px-3.5 py-3 text-sm text-muted">
            No tengo este ejercicio en el catálogo, así que no puedo sugerir por
            músculo. Buscá el reemplazo por nombre.
          </p>
        )}

        {/* Volver al original: un cambio de un día tiene que poder deshacerse */}
        {swappedFrom && (
          <button
            type="button"
            onClick={() => {
              onUndo();
              onClose();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border px-3.5 text-sm font-medium text-muted transition-colors active:scale-[0.99] hover:border-primary hover:text-primary"
          >
            <RotateCcw size={15} strokeWidth={2} aria-hidden />
            Volver a {swappedFrom}
          </button>
        )}

        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            className={`${inputCls} pl-11`}
            placeholder="Buscar otro ejercicio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar ejercicio"
          />
        </div>

        {!query.trim() && alts.length > 0 && (
          <p className="text-xs font-medium text-muted">
            Trabajan lo mismo ({work.group}):
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {list.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">
              {query.trim()
                ? "Sin resultados. Probá otro nombre."
                : "No encontré alternativas para este ejercicio."}
            </li>
          ) : (
            list.map((a) => (
              <li key={a.exercise.id}>
                <button
                  type="button"
                  onClick={() => pick(a.exercise.name_es)}
                  className="flex w-full items-center gap-3 rounded-control bg-sunken p-2 text-left transition-transform duration-(--duration-fast) active:scale-[0.99]"
                >
                  <ExerciseImage
                    image={a.exercise.image}
                    name={a.exercise.name_es}
                    className="h-14 w-14"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {a.exercise.name_es}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{equipmentLabel(a.exercise.equipment)}</span>
                      {mechanicLabel(a.exercise.mechanic) && (
                        <span className="rounded-full bg-border/60 px-1.5 py-0.5 text-[10px]">
                          {mechanicLabel(a.exercise.mechanic)}
                        </span>
                      )}
                    </span>
                    {a.shared.length > 0 && (
                      <span className="mt-0.5 block truncate text-xs text-primary">
                        comparte {a.shared.join(", ")}
                      </span>
                    )}
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
