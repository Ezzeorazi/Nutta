"use client";

import { Palmtree } from "lucide-react";
import { Button } from "@/components/ui";
import {
  vacationProgress,
  vacationRangeLabel,
} from "@/lib/vacation";
import { dayLabel, type Goals, type Vacation } from "@/lib/types";

/**
 * La tarjeta del modo activo. Va arriba de todo en Hoy porque explica por qué
 * la pantalla de abajo cambió: sin ella, las metas más altas y la rutina rara
 * parecen un error de la app.
 */
export default function VacationCard({
  vacation,
  viewDate,
  today,
  goals,
  onEdit,
}: {
  vacation: Vacation;
  /** Día que se está mirando (puede ser pasado). */
  viewDate: string;
  today: string;
  /** Las metas flexibles ya calculadas (las que se están usando). */
  goals: Goals;
  onEdit: () => void;
}) {
  const { day, total } = vacationProgress(vacation, viewDate);
  const isToday = viewDate === today;
  const terminado = today > vacation.end;

  return (
    <section className="flex flex-col gap-3 rounded-card border-l-4 border-l-info bg-card p-4 shadow-e1">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-info/10 text-info">
          <Palmtree size={20} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Modo vacaciones
            {vacation.label ? (
              <span className="text-muted"> · {vacation.label}</span>
            ) : null}
          </p>
          <p className="text-xs text-muted">
            Día {day} de {total} · {vacationRangeLabel(vacation)}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Ajustar
        </Button>
      </div>

      <p className="text-sm text-muted">
        Metas flexibles: {goals.calories.toLocaleString("es-AR")} kcal y{" "}
        <strong className="text-foreground">{goals.protein} g de proteína</strong>
        , que es lo único que conviene sostener. La rutina corta de viaje está en
        el Gym y la racha no se corta.
      </p>

      {isToday && !terminado && (
        <p className="text-xs text-muted">
          Volvés el {dayLabel(vacation.end)}. Ese día el plan de siempre vuelve
          solo.
        </p>
      )}
    </section>
  );
}
