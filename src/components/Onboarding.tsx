"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, inputCls } from "@/components/ui/Field";
import { useDismissable } from "@/lib/useDismissable";
import {
  ACTIVITIES,
  OBJECTIVES,
  computeGoals,
  type ActivityKey,
  type ObjectiveKey,
  type Profile,
  type Sex,
} from "@/lib/nutrition";

type Props = {
  initial?: Profile | null;
  onDone: (p: Profile) => void;
  onCancel?: () => void;
};

export default function Onboarding({ initial, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "masculino");
  const [age, setAge] = useState(initial?.age ? String(initial.age) : "");
  const [weight, setWeight] = useState(
    initial?.weight ? String(initial.weight) : "",
  );
  const [height, setHeight] = useState(
    initial?.height ? String(initial.height) : "",
  );
  const [activity, setActivity] = useState<ActivityKey>(
    initial?.activity ?? "moderado",
  );
  const [objective, setObjective] = useState<ObjectiveKey>(
    initial?.objective ?? "mantener",
  );

  // El botón atrás del teléfono cancela la edición del perfil. En el alta
  // inicial no hay nada que cancelar, así que no hace nada: es preferible a que
  // te saque de la app en medio de la configuración.
  useDismissable(true, () => onCancel?.());

  const profile: Profile = {
    sex,
    age: Number(age) || 0,
    weight: Number(weight) || 0,
    height: Number(height) || 0,
    activity,
    objective,
  };

  const step0Valid =
    profile.age > 0 && profile.weight > 0 && profile.height > 0;

  const preview = step0Valid ? computeGoals(profile) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {step === 0 ? "Contanos sobre vos" : "Tu plan"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {step === 0
              ? "Calculamos tus calorías y macros ideales."
              : "Podés ajustarlo cuando quieras."}
          </p>
          <div className="mt-4 flex gap-2" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={2}>
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-(--duration-base) ${
                  i <= step ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Sexo</span>
              <div className="grid grid-cols-2 gap-2">
                {(["masculino", "femenino"] as Sex[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    aria-pressed={sex === s}
                    className={`min-h-12 rounded-control border text-sm capitalize transition-transform duration-(--duration-fast) active:scale-[0.98] ${
                      sex === s
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Edad">
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </Field>
              <Field label="Peso (kg)">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputCls}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </Field>
              <Field label="Altura (cm)">
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Nivel de actividad</span>
              {ACTIVITIES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setActivity(a.key)}
                  aria-pressed={activity === a.key}
                  className={`flex items-center justify-between gap-3 rounded-control border px-4 py-3 text-left transition-transform duration-(--duration-fast) active:scale-[0.99] ${
                    activity === a.key
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-xs text-muted">{a.desc}</span>
                  </span>
                  {activity === a.key && (
                    <Check
                      size={18}
                      strokeWidth={2.5}
                      className="shrink-0 text-primary"
                      aria-hidden
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto flex gap-3 pt-6">
              {onCancel && (
                <Button variant="secondary" size="lg" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button
                size="lg"
                full
                disabled={!step0Valid}
                onClick={() => setStep(1)}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Objetivo</span>
              {OBJECTIVES.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setObjective(o.key)}
                  aria-pressed={objective === o.key}
                  className={`flex items-center justify-between gap-3 rounded-control border px-4 py-3 text-left transition-transform duration-(--duration-fast) active:scale-[0.99] ${
                    objective === o.key
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-xs text-muted">{o.desc}</span>
                  </span>
                  {objective === o.key && (
                    <Check
                      size={18}
                      strokeWidth={2.5}
                      className="shrink-0 text-primary"
                      aria-hidden
                    />
                  )}
                </button>
              ))}
            </div>

            {preview && (
              <div className="rounded-card bg-card p-5 shadow-e1">
                <p className="text-sm text-muted">Meta diaria estimada</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {preview.calories}{" "}
                  <span className="text-base font-normal text-muted">kcal</span>
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    { l: "Proteínas", v: preview.protein, c: "var(--primary)" },
                    { l: "Carbos", v: preview.carbs, c: "var(--accent)" },
                    { l: "Grasas", v: preview.fat, c: "var(--success)" },
                  ].map((m) => (
                    <div key={m.l} className="rounded-control bg-sunken py-3">
                      <p
                        className="text-lg font-bold tabular-nums"
                        style={{ color: m.c }}
                      >
                        {m.v}g
                      </p>
                      <p className="text-xs text-muted">{m.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" size="lg" onClick={() => setStep(0)}>
                Atrás
              </Button>
              <Button size="lg" full onClick={() => onDone(profile)}>
                {initial ? "Guardar" : "Empezar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
