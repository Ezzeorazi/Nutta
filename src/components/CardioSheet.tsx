"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import Stepper from "@/components/ui/Stepper";
import { Field, inputCls } from "@/components/ui/Field";
import { uid } from "@/lib/uid";
import type { ExerciseEntry } from "@/lib/types";

const QUICK_MIN = [20, 30, 45, 60];

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
  const [minutes, setMinutes] = useState("30");
  const [calories, setCalories] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [effect, setEffect] = useState("");
  const [showWatch, setShowWatch] = useState(false);

  const mins = Number(minutes) || 0;
  const canAdd = name.trim() !== "" && mins > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: uid(),
      date,
      name: name.trim(),
      minutes: mins,
      caloriesBurned: Number(calories) || 0,
      ...(avgHr && { avgHeartRate: Number(avgHr) }),
      ...(maxHr && { maxHeartRate: Number(maxHr) }),
      ...(effect && { trainingEffect: Number(effect) }),
    });
    onClose();
  };

  return (
    <Sheet
      title="Registrar cardio"
      onClose={onClose}
      footer={
        <Button
          variant="accent"
          size="lg"
          full
          type="submit"
          form="cardio-form"
          disabled={!canAdd}
        >
          Agregar cardio
        </Button>
      }
    >
      <form
        id="cardio-form"
        className="flex flex-col gap-5"
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
          />
        </Field>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-muted">Duración</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_MIN.map((m) => (
              <Chip
                key={m}
                tone="accent"
                selected={mins === m}
                onClick={() => setMinutes(String(m))}
              >
                {m} min
              </Chip>
            ))}
          </div>
          <Stepper
            value={minutes}
            onChange={setMinutes}
            step={5}
            min={0}
            max={600}
            suffix="min"
            ariaLabel="Duración en minutos"
          />
        </div>

        <Field label="Calorías quemadas (kcal)" hint="Las que marcó el reloj">
          <input
            type="number"
            inputMode="numeric"
            className={inputCls}
            placeholder="420"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
        </Field>

        {/* Los datos del reloj son opcionales y casi nadie los carga siempre:
            plegados, no compiten con lo que sí hace falta. */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowWatch((v) => !v)}
            aria-expanded={showWatch}
            className="self-start text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            {showWatch ? "− " : "+ "}Datos del reloj (opcional)
          </button>

          {showWatch && (
            <div className="flex flex-col gap-3">
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
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}
