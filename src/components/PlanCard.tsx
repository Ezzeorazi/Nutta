"use client";

import { useState } from "react";
import { Bell, BellOff, ChevronDown } from "lucide-react";
import Chip from "@/components/ui/Chip";
import { DIET_TEMPLATES, PLAN_CHECKPOINTS, PLAN_RULES } from "@/lib/plan";
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
  push,
}: {
  planActive: boolean;
  onTogglePlan: () => void;
  push: PushState;
}) {
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  return (
    <section className="rounded-card bg-card p-4 shadow-e1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">📋 Tu plan de agosto</h2>
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
        {planActive
          ? "Tus metas de calorías y macros de arriba son las del plan (2.350 kcal · 190 P). Meta de peso: 92 kg."
          : "Metas automáticas activas. Tocá arriba para volver a las del plan."}
      </p>

      <div className="mb-4 flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted">Plantillas de comida</h3>
        <div className="flex flex-wrap gap-2">
          {DIET_TEMPLATES.map((t) => (
            <Chip
              key={t.id}
              selected={openTemplate === t.id}
              onClick={() => setOpenTemplate((o) => (o === t.id ? null : t.id))}
            >
              {t.id}
            </Chip>
          ))}
        </div>
        {openTemplate && (
          <div className="mt-1 flex flex-col gap-2 rounded-xl bg-sunken p-3">
            {(() => {
              const t = DIET_TEMPLATES.find((x) => x.id === openTemplate)!;
              return (
                <>
                  <p className="text-xs font-semibold">{t.label}</p>
                  <p className="text-[11px] text-muted">{t.summary}</p>
                  <ul className="flex flex-col gap-1.5">
                    {t.meals.map((m) => (
                      <li key={m.time} className="text-xs">
                        <span className="font-medium">{m.time}</span>
                        <span className="text-muted"> — {m.desc}</span>
                        {m.kcal > 0 && (
                          <span className="text-muted tabular-nums">
                            {" "}
                            ({m.kcal} kcal, {m.protein} g P)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        )}
      </div>

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

      <div className="mt-4 border-t border-border pt-3">
        <NotifSection push={push} />
        <p className="mt-2 text-[11px] text-muted">
          Dos avisos por día: a la mañana, qué toca entrenar y cómo venís de
          recuperado; a la noche, lo que todavía podés corregir. Llegan aunque
          tengas la app cerrada.
        </p>
      </div>
    </section>
  );
}
