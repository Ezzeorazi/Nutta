"use client";

import { useState } from "react";
import { Bell, BellOff, ChevronDown, Palmtree } from "lucide-react";
import MealIdeas from "@/components/MealIdeas";
import {
  PLAN_CHECKPOINTS,
  PLAN_GOALS,
  PLAN_MEALS,
  PLAN_RULES,
  PLAN_WAIST,
} from "@/lib/plan";
import type { FoodEntry, Goals, MemoryFact } from "@/lib/types";
import type { PushState } from "@/lib/usePlanReminders";

function NotifSection({ push }: { push: PushState }) {
  const { enabled, blocker, busy, error } = push;

  if (blocker === "instalar") {
    return (
      <p className="flex items-start gap-2 text-xs text-muted">
        <BellOff size={14} className="mt-0.5 shrink-0" aria-hidden />
        Para recibir avisos en iPhone hay que instalar Nutta: tocá Compartir →
        «Agregar a inicio» y abrila desde ahí.
      </p>
    );
  }
  if (blocker === "no-soportado") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <BellOff size={14} aria-hidden />
        Este navegador no soporta avisos.
      </p>
    );
  }
  if (blocker === "bloqueado") {
    return (
      <p className="flex items-start gap-2 text-xs text-muted">
        <BellOff size={14} className="mt-0.5 shrink-0" aria-hidden />
        Avisos bloqueados: habilitalos en los permisos del navegador para este
        sitio.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {enabled ? (
          <p className="flex items-center gap-2 text-xs font-medium text-primary">
            <Bell size={14} aria-hidden />
            Avisos activados en este dispositivo
          </p>
        ) : (
          <button
            type="button"
            onClick={push.enable}
            disabled={busy}
            className="flex min-h-9 items-center gap-2 rounded-full border border-primary bg-primary/10 px-3.5 text-sm font-semibold text-primary active:scale-95 disabled:opacity-50"
          >
            <Bell size={15} aria-hidden />
            {busy ? "Activando…" : "Activar avisos"}
          </button>
        )}
        {enabled && (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={push.sendTest}
              className="text-xs font-medium text-muted underline-offset-2 hover:underline"
            >
              Probar
            </button>
            <button
              type="button"
              onClick={push.disable}
              disabled={busy}
              className="text-xs font-medium text-muted underline-offset-2 hover:underline disabled:opacity-50"
            >
              Desactivar
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}

export default function PlanCard({
  planActive,
  onTogglePlan,
  vacationActive,
  onOpenVacation,
  push,
  ideas,
  hasPlan = true,
}: {
  planActive: boolean;
  onTogglePlan: () => void;
  /** Hay un tramo de vacaciones cubriendo hoy: el plan está en pausa. */
  vacationActive: boolean;
  onOpenVacation: () => void;
  push: PushState;
  /** Para "Dame ideas"; solo viaja cuando se está viendo hoy. */
  ideas?: {
    today: string;
    remaining: Goals;
    foods: FoodEntry[];
    memories: MemoryFact[];
  };
  /**
   * El plan es de otra persona (ver `lib/planOwner.ts`): de la tarjeta queda
   * solo lo que sirve a cualquiera, las ideas de comida. Vacaciones y avisos
   * también se van porque los dos giran alrededor de la rutina del plan.
   */
  hasPlan?: boolean;
}) {
  const [showDay, setShowDay] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const g = PLAN_GOALS;

  if (!hasPlan) {
    if (!ideas) return null;
    return (
      <section className="rounded-card bg-card p-4 shadow-e1">
        <h2 className="mb-3 font-semibold">💡 Ideas para hoy</h2>
        <MealIdeas {...ideas} />
      </section>
    );
  }

  return (
    <section className="rounded-card bg-card p-4 shadow-e1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">📋 Tu plan de octubre</h2>
        <button
          type="button"
          onClick={onTogglePlan}
          className={`text-xs font-medium underline-offset-2 hover:underline ${
            planActive ? "text-primary" : "text-muted"
          }`}
        >
          {planActive ? "Metas del plan: ON" : "Metas del plan: OFF"}
        </button>
      </div>

      <p className="mb-3 text-xs text-muted">
        {vacationActive
          ? "En pausa: estás de vacaciones, así que arriba mandan las metas flexibles. El plan vuelve solo el día que termina el viaje."
          : planActive
            ? `Recomposición: ${g.calories.toLocaleString("es-AR")} kcal · ${g.protein} P · ${g.carbs} C · ${g.fat} G. La meta que manda es la cintura: de ${PLAN_WAIST.start} a ${PLAN_WAIST.target} cm.`
            : "Metas automáticas activas. Tocá arriba para volver a las del plan."}
      </p>

      {ideas && (
        <div className="mb-4">
          <MealIdeas {...ideas} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowDay((s) => !s)}
        className="mb-2 flex w-full items-center justify-between text-xs font-semibold text-muted"
      >
        Cómo repartir el día
        <ChevronDown
          size={15}
          className={`transition-transform ${showDay ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {showDay && (
        <ul className="mb-3 flex flex-col gap-1.5">
          {PLAN_MEALS.map((m) => (
            <li key={m.time} className="text-xs">
              <span className="font-medium">{m.time}</span>
              <span className="text-muted"> — {m.text}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowRules((s) => !s)}
        className="flex w-full items-center justify-between text-xs font-semibold text-muted"
      >
        Reglas y checkpoints
        <ChevronDown
          size={15}
          className={`transition-transform ${showRules ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {showRules && (
        <div className="mt-2 flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5">
            {PLAN_RULES.map((r) => (
              <li key={r} className="flex gap-2 text-xs text-muted">
                <span className="text-primary">•</span>
                {r}
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1.5 border-t border-border pt-2">
            {PLAN_CHECKPOINTS.map((c) => (
              <li key={c.freq} className="text-xs text-muted">
                <span className="font-medium text-foreground">{c.freq}:</span>{" "}
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!vacationActive && (
        <button
          type="button"
          onClick={onOpenVacation}
          className="mt-4 flex w-full items-center gap-2 rounded-control border border-dashed border-border px-3.5 py-2.5 text-left text-xs text-muted transition-colors active:scale-[0.99] hover:border-info hover:text-info"
        >
          <Palmtree size={15} strokeWidth={2} className="shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">¿Te vas de viaje?</strong> Activá
            el modo vacaciones y la app deja de exigirte el plan.
          </span>
        </button>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <NotifSection push={push} />
        <p className="mt-2 text-[11px] text-muted">
          {vacationActive
            ? "De vacaciones llega uno solo, a la mañana: el de la noche —el que reclama— no se manda."
            : "Dos avisos por día: a la mañana, qué toca entrenar y cómo venís de recuperado; a la noche, lo que todavía podés corregir. Llegan aunque tengas la app cerrada."}
        </p>
      </div>
    </section>
  );
}
