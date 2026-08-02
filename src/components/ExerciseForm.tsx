"use client";

import { useMemo, useState } from "react";
import { PenLine, Search } from "lucide-react";
import {
  MET_ACTIVITIES,
  caloriesFromMet,
  type MetActivity,
} from "@/lib/exercises";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import Stepper from "@/components/ui/Stepper";
import { Field, inputCls } from "@/components/ui/Field";
import { uid } from "@/lib/uid";
import { todayISO, type ExerciseEntry } from "@/lib/types";

/** Duraciones típicas, para no abrir el teclado por una sesión de 30 minutos. */
const QUICK_MIN = [15, 30, 45, 60];

export default function ExerciseForm({
  weight,
  onAdd,
  onClose,
}: {
  weight: number;
  onAdd: (e: ExerciseEntry) => void;
  onClose: () => void;
}) {
  // Mismo patrón que el alta de comida: primero QUÉ hiciste, después CUÁNTO.
  const [step, setStep] = useState<"buscar" | "duracion">("buscar");
  const [name, setName] = useState("");
  const [met, setMet] = useState<number | null>(null);
  const [minutes, setMinutes] = useState("30");
  const [caloriesEdited, setCaloriesEdited] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const mins = Number(minutes) || 0;

  // Calorías: si hay MET, se calculan; si las editaste, se respeta tu número.
  const autoCalories = met != null ? caloriesFromMet(met, weight, mins) : null;
  const calories =
    caloriesEdited !== "" ? Number(caloriesEdited) || 0 : (autoCalories ?? 0);

  const categories = useMemo(
    () => [...new Set(MET_ACTIVITIES.map((a) => a.category))],
    [],
  );

  /**
   * Antes se volcaba la lista entera de actividades sin agrupar. Ahora se filtra
   * por categoría y por texto: buscar "correr" ignora la categoría elegida,
   * porque escribir es una intención más específica que haber tocado un chip.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return MET_ACTIVITIES.filter((a) => a.name.toLowerCase().includes(q));
    if (category) return MET_ACTIVITIES.filter((a) => a.category === category);
    return MET_ACTIVITIES;
  }, [query, category]);

  const choose = (label: string, value: number | null) => {
    setName(label);
    setMet(value);
    setCaloriesEdited("");
    setQuery("");
    setStep("duracion");
  };

  const selectActivity = (a: MetActivity) => choose(a.name, a.met);

  const canAdd = name.trim() !== "" && mins > 0;
  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: uid(),
      date: todayISO(),
      name: name.trim(),
      minutes: mins,
      caloriesBurned: calories,
    });
  };

  return (
    <Sheet
      title={step === "buscar" ? "Agregar ejercicio" : name || "Duración"}
      onClose={onClose}
      footer={
        step === "duracion" ? (
          <Button variant="accent" size="lg" full onClick={submit} disabled={!canAdd}>
            Agregar ejercicio
          </Button>
        ) : undefined
      }
    >
      {step === "buscar" ? (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              className={`${inputCls} pl-11`}
              placeholder="Buscar actividad…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar actividad"
            />
          </div>

          {query.trim() === "" && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip
                  key={c}
                  tone="accent"
                  selected={category === c}
                  onClick={() => setCategory(category === c ? null : c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-col">
            {filtered.map((a) => (
              <button
                key={a.name}
                type="button"
                onClick={() => selectActivity(a)}
                className="flex items-center justify-between gap-3 border-b border-border py-3 text-left last:border-0 active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {a.name}
                  </span>
                  <span className="block text-xs text-muted">{a.category}</span>
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {Math.round(caloriesFromMet(a.met, weight, 30))} kcal/30min
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-3 text-sm text-muted">
                Nada con ese nombre en la tabla de referencia.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => choose(query.trim(), null)}
            className="flex items-center gap-2 self-start text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            <PenLine size={15} aria-hidden />
            {query.trim()
              ? `Cargar «${query.trim()}» a mano`
              : "Cargar a mano"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setStep("buscar")}
          >
            Cambiar actividad
          </Button>

          <Field label="Actividad">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Fútbol con amigos"
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
                  onClick={() => {
                    setMinutes(String(m));
                    setCaloriesEdited("");
                  }}
                >
                  {m} min
                </Chip>
              ))}
            </div>
            <Stepper
              value={minutes}
              onChange={(v) => {
                setMinutes(v);
                setCaloriesEdited("");
              }}
              step={5}
              min={0}
              max={600}
              suffix="min"
              ariaLabel="Duración en minutos"
            />
          </div>

          {/* Las calorías se muestran como resultado en vivo, no como un campo
              que compite con el cálculo. Editarlas sigue siendo posible. */}
          <div className="flex flex-col gap-3 rounded-card bg-sunken p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-3xl font-bold tabular-nums text-accent">
                {Math.round(calories)}
                <span className="ml-1.5 text-base font-normal text-muted">
                  kcal
                </span>
              </p>
              {met != null && caloriesEdited === "" && (
                <span className="text-right text-xs text-muted">
                  {met} MET × {weight} kg
                </span>
              )}
            </div>
            <Field label="Ajustar calorías quemadas">
              <input
                type="number"
                inputMode="numeric"
                className={inputCls}
                value={caloriesEdited !== "" ? caloriesEdited : calories}
                onChange={(e) => setCaloriesEdited(e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}
    </Sheet>
  );
}
