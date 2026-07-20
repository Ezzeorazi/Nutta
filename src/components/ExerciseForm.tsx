"use client";

import { useState } from "react";
import {
  MET_ACTIVITIES,
  caloriesFromMet,
  type MetActivity,
} from "@/lib/exercises";
import Sheet, { Field, inputCls, uid } from "@/components/Sheet";
import { todayISO, type ExerciseEntry } from "@/lib/types";

export default function ExerciseForm({
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
  const autoCalories = met != null ? caloriesFromMet(met, weight, mins) : null;
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
