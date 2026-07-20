"use client";

import { useState } from "react";
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

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {step === 0 ? "Contanos sobre vos" : "Tu plan"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {step === 0
              ? "Calculamos tus calorías y macros ideales."
              : "Podés ajustarlo cuando quieras."}
          </p>
          <div className="mt-4 flex gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= step ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="flex flex-1 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Sexo</span>
              <div className="grid grid-cols-2 gap-2">
                {(["masculino", "femenino"] as Sex[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSex(s)}
                    className={`rounded-xl border py-2.5 text-sm capitalize transition ${
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
              <label className="flex flex-col gap-1 text-xs text-muted">
                Edad
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Peso (kg)
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputCls}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Altura (cm)
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Nivel de actividad</span>
              {ACTIVITIES.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setActivity(a.key)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
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
                    <span className="text-primary">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto flex gap-3 pt-4">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-medium"
                >
                  Cancelar
                </button>
              )}
              <button
                disabled={!step0Valid}
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Objetivo</span>
              {OBJECTIVES.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setObjective(o.key)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
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
                    <span className="text-primary">✓</span>
                  )}
                </button>
              ))}
            </div>

            {preview && (
              <div className="rounded-2xl border border-border bg-card p-5">
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
                    <div key={m.l} className="rounded-xl bg-background py-3">
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

            <div className="mt-auto flex gap-3 pt-4">
              <button
                onClick={() => setStep(0)}
                className="rounded-xl border border-border px-5 py-3 text-sm font-medium"
              >
                Atrás
              </button>
              <button
                onClick={() => onDone(profile)}
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
              >
                {initial ? "Guardar" : "Empezar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
