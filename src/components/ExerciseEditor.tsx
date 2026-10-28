"use client";

import { useMemo, useState } from "react";
import { Check, ImageOff, Search, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { Field, inputCls } from "@/components/ui/Field";
import ExerciseImage from "@/components/ExerciseImage";
import { KINDS, defaultKind } from "@/lib/exerciseKind";
import {
  EXERCISES,
  MUSCLE_GROUPS,
  exercisesByGroup,
  groupOf,
  matchExercise,
  searchExercises,
  type MuscleGroup,
} from "@/lib/exerciseDb";
import type { ExerciseKind } from "@/lib/types";

export type ExerciseDraft = {
  id?: string;
  name: string;
  kind: ExerciseKind;
  image: string;
  group: string;
};

/** Borrador para un nombre: arranca con lo que el catálogo ya sabe de él. */
export function draftFor(name: string): ExerciseDraft {
  const ex = name.trim() ? matchExercise(name) : null;
  return {
    name: name.trim(),
    kind: name.trim() ? defaultKind(name) : "peso",
    image: ex?.image ?? "",
    group: (name.trim() && groupOf(name)) || "",
  };
}

/** Máximo de fotos en la grilla: con 400 la lista se vuelve un scroll eterno. */
const MAX_PHOTOS = 60;

/**
 * Alta o edición de un ejercicio: nombre, cómo se mide, grupo y foto.
 *
 * La medición es lo que más importa: decide si la serie se lee como kg, como
 * asistencia (menos es mejor), como cantidad o como segundos. La foto se elige
 * del catálogo de RepDB, que ya viene con la app.
 *
 * Es solo el cuerpo: lo monta un sheet que ya está abierto (el buscador o el
 * editor de rutina), así no se apilan dos.
 */
export default function ExerciseEditor({
  initial,
  nameLocked = false,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: ExerciseDraft;
  /**
   * El nombre no se cambia: las series se guardan por nombre, así que
   * renombrar partiría el historial en dos.
   */
  nameLocked?: boolean;
  onSave: (d: ExerciseDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [query, setQuery] = useState("");
  const set = (patch: Partial<ExerciseDraft>) => setD((p) => ({ ...p, ...patch }));

  // Fotos: lo buscado; si no, las del grupo elegido; si no, todo el catálogo.
  const photos = useMemo(() => {
    const q = query.trim();
    const pool = q
      ? searchExercises(q, MAX_PHOTOS * 2)
      : d.group
        ? (exercisesByGroup()[d.group as MuscleGroup] ?? EXERCISES)
        : EXERCISES;
    return pool.filter((e) => e.image).slice(0, MAX_PHOTOS);
  }, [query, d.group]);

  const kind = KINDS.find((k) => k.key === d.kind);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <ExerciseImage
          image={d.image || null}
          name={d.name || "Ejercicio"}
          className="h-16 w-16"
        />
        <div className="min-w-0 flex-1">
          {nameLocked ? (
            <p className="truncate font-semibold">{d.name}</p>
          ) : (
            <input
              className={inputCls}
              placeholder="Nombre (ej. Flexiones diamante)"
              value={d.name}
              onChange={(e) => set({ name: e.target.value })}
              aria-label="Nombre del ejercicio"
            />
          )}
        </div>
      </div>

      <Field label="¿Cómo se mide?" hint={kind?.hint}>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Chip
              key={k.key}
              tone="accent"
              selected={d.kind === k.key}
              onClick={() => set({ kind: k.key })}
            >
              {k.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Grupo muscular">
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g.key}
              selected={d.group === g.key}
              onClick={() => set({ group: d.group === g.key ? "" : g.key })}
            >
              {g.emoji} {g.label}
            </Chip>
          ))}
        </div>
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted">Foto</span>
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            className={`${inputCls} pl-11`}
            placeholder="Buscar foto por ejercicio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar foto"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => set({ image: "" })}
            aria-pressed={!d.image}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-background text-[11px] text-muted ${
              !d.image ? "border-primary ring-2 ring-primary" : "border-border"
            }`}
          >
            <ImageOff size={20} aria-hidden />
            Sin foto
          </button>
          {photos.map((e) => {
            const on = d.image === e.image;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => set({ image: e.image ?? "" })}
                aria-pressed={on}
                aria-label={`Usar la foto de ${e.name_es}`}
                className={`relative overflow-hidden rounded-xl border ${
                  on ? "border-primary ring-2 ring-primary" : "border-border"
                }`}
              >
                <ExerciseImage
                  image={e.image}
                  name={e.name_es}
                  className="aspect-square w-full rounded-none"
                />
                <span className="block truncate px-1 py-0.5 text-[10px] text-muted">
                  {e.name_es}
                </span>
                {on && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] text-muted">
          Images by{" "}
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

      <div className="flex items-center gap-2">
        {onDelete && (
          <Button variant="danger" onClick={onDelete} aria-label="Borrar ejercicio">
            <Trash2 size={16} aria-hidden />
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Volver
        </Button>
        <Button
          variant="accent"
          onClick={() => onSave({ ...d, name: d.name.trim() })}
          disabled={!d.name.trim()}
          className="flex-1"
        >
          <Check size={16} strokeWidth={2.5} aria-hidden />
          Guardar
        </Button>
      </div>
    </div>
  );
}
