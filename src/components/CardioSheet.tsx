"use client";

import { useState } from "react";
import Sheet, { Field, inputCls, uid } from "@/components/Sheet";
import type { ExerciseEntry } from "@/lib/types";

/** Alta de cardio con los datos que suelen mostrar los relojes/smartbands
 * (Xiaomi/Mi Fitness y similares): duración, calorías, LPM y efecto del
 * entrenamiento. Los campos del reloj son opcionales — alcanza con actividad
 * + minutos + calorías si no se los quiere cargar. */
export default function CardioSheet({
  date,
  onAdd,
  onClose,
}: {
  date: string;
  onAdd: (e: ExerciseEntry) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [calories, setCalories] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [effect, setEffect] = useState("");

  const canAdd = name.trim() !== "" && Number(minutes) > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: uid(),
      date,
      name: name.trim(),
      minutes: Number(minutes),
      caloriesBurned: Number(calories) || 0,
      ...(avgHr && { avgHeartRate: Number(avgHr) }),
      ...(maxHr && { maxHeartRate: Number(maxHr) }),
      ...(effect && { trainingEffect: Number(effect) }),
    });
    onClose();
  };

  return (
    <Sheet title="Registrar cardio" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <Field label="Actividad">
          <input
            className={inputCls}
            placeholder="Ej. Correr, Bici, Estilo libre…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutos">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              placeholder="45"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
          <Field label="Calorías (kcal)">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              placeholder="Del reloj"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </Field>
        </div>

        <p className="mt-1 text-xs font-medium text-muted">
          Datos del reloj (opcional)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="LPM promedio">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              placeholder="98"
              value={avgHr}
              onChange={(e) => setAvgHr(e.target.value)}
            />
          </Field>
          <Field label="LPM máximo">
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              placeholder="155"
              value={maxHr}
              onChange={(e) => setMaxHr(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Efecto del entrenamiento (0-5)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="5"
            className={inputCls}
            placeholder="2.8"
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
          />
        </Field>

        <button
          type="submit"
          disabled={!canAdd}
          className="mt-2 rounded-xl bg-accent py-3 font-semibold text-accent-foreground active:scale-[0.99] disabled:opacity-40"
        >
          Agregar
        </button>
      </form>
    </Sheet>
  );
}
