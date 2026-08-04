"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import Stepper from "@/components/ui/Stepper";
import { Field, inputCls } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import WatchScanButton from "@/components/WatchScanButton";
import { uid } from "@/lib/uid";
import { dayLabel, startOfLocalDayMs, type ExerciseEntry } from "@/lib/types";
import type { WatchReading } from "@/lib/watchScan";

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
  // Marca que los números salieron de una captura del reloj y no de tipearlos.
  const [scanned, setScanned] = useState(false);
  // Día y hora que mostraba la captura. Mandan sobre el día que se está viendo:
  // lo normal es cargar el domingo un entrenamiento del sábado.
  const [scanDate, setScanDate] = useState<string | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const toast = useToast();

  const mins = Number(minutes) || 0;
  const canAdd = name.trim() !== "" && mins > 0;
  const day = scanDate ?? date;

  /** Vuelca lo que la IA leyó de la captura. No guarda: deja el form listo. */
  const applyScan = (reading: WatchReading) => {
    const e = reading.exercise;
    if (!e) {
      toast("Esa captura es el resumen del día: cargala desde Hoy → Bienestar.");
      return;
    }
    setName(e.name);
    setMinutes(String(e.minutes));
    if (e.caloriesBurned) setCalories(String(e.caloriesBurned));
    if (e.avgHeartRate) setAvgHr(String(e.avgHeartRate));
    if (e.maxHeartRate) setMaxHr(String(e.maxHeartRate));
    if (e.trainingEffect) setEffect(String(e.trainingEffect));
    // Si leyó datos del reloj, se despliega la sección para que se vean.
    if (e.avgHeartRate || e.maxHeartRate || e.trainingEffect) setShowWatch(true);
    setScanned(true);
    setScanDate(e.date ?? null);
    setScanTime(e.time ?? null);
    toast(
      e.date && e.date !== date
        ? `Es del ${dayLabel(e.date)}: lo voy a guardar en ese día.`
        : "Completé el formulario. Revisalo antes de agregar.",
    );
  };

  const submit = () => {
    if (!canAdd) return;
    // El día efectivo de un registro sale de su createdAt, así que para que
    // caiga en la fecha de la captura hay que anclarlo ahí: con la hora que
    // mostraba el reloj si la leyó, o al mediodía de ese día si no.
    const createdAt = scanDate
      ? scanTime
        ? new Date(`${scanDate}T${scanTime}:00`).getTime()
        : startOfLocalDayMs(scanDate)
      : undefined;

    onAdd({
      id: uid(),
      date: day,
      name: name.trim(),
      minutes: mins,
      caloriesBurned: Number(calories) || 0,
      ...(createdAt && { createdAt }),
      ...(avgHr && { avgHeartRate: Number(avgHr) }),
      ...(maxHr && { maxHeartRate: Number(maxHr) }),
      ...(effect && { trainingEffect: Number(effect) }),
      ...(scanned && { source: "reloj" }),
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
        {/* Atajo: en vez de copiar los números del reloj a mano, se le saca
            una captura y la IA llena el formulario. */}
        <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-border px-3 py-2">
          <span className="min-w-0 text-xs text-muted">
            ¿Ya está en el reloj?
          </span>
          <WatchScanButton label="Escanear captura" onRead={applyScan} />
        </div>

        {/* Si la captura era de otro día, se avisa acá: se guarda en el día del
            entrenamiento, no en el que se está mirando. */}
        {scanDate && scanDate !== date && (
          <p className="-mt-2 text-xs text-muted">
            📅 Se guarda en{" "}
            <b className="text-foreground">{dayLabel(scanDate)}</b>
            {scanTime && `, ${scanTime}`} — la fecha de la captura.
          </p>
        )}

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
