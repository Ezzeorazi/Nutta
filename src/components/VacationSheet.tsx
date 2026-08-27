"use client";

import { useState } from "react";
import { Button, Chip, Field, Sheet, inputCls } from "@/components/ui";
import {
  DEFAULT_VACATION_DAYS,
  VACATION_PRESETS,
  vacationGoals,
} from "@/lib/vacation";
import { shiftISO, type Goals, type Vacation } from "@/lib/types";

/**
 * Alta y edición del tramo de vacaciones.
 *
 * Pide fecha de vuelta obligatoria a propósito. Un modo flexible sin fecha de
 * corte deja de ser un modo y pasa a ser el estado normal de la app: el
 * teléfono nunca vuelve a exigir nada y un mes después nadie se acuerda de por
 * qué las metas quedaron altas. Si volvés antes, se corta; si te quedás más,
 * se estira. Las dos cosas son un toque.
 */
export default function VacationSheet({
  today,
  goals,
  current,
  onStart,
  onSave,
  onEndNow,
  onRemove,
  onClose,
}: {
  today: string;
  /** Metas de siempre: se muestran contra las flexibles para que se vea el cambio. */
  goals: Goals;
  /** El tramo que se está editando. Ausente = alta. */
  current?: Vacation;
  onStart: (start: string, end: string, label?: string) => void;
  onSave: (end: string) => void;
  onEndNow: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(current?.start ?? today);
  const [end, setEnd] = useState(
    current?.end ?? shiftISO(today, DEFAULT_VACATION_DAYS - 1),
  );
  const [label, setLabel] = useState(current?.label ?? "");

  const flex = vacationGoals(goals);
  const invalid = end < start;
  const days =
    Math.round(
      (new Date(`${end}T00:00:00`).getTime() -
        new Date(`${start}T00:00:00`).getTime()) /
        86_400_000,
    ) + 1;

  const preset = (n: number) => setEnd(shiftISO(start, n - 1));

  return (
    <Sheet
      title={current ? "Tus vacaciones" : "Modo vacaciones"}
      description={
        current
          ? "Cambiá la vuelta, o cortalo si ya volviste."
          : "Los días en que la app deja de exigirte el plan."
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            full
            size="lg"
            disabled={invalid}
            onClick={() => {
              if (invalid) return;
              if (current) onSave(end);
              else onStart(start, end, label);
              onClose();
            }}
          >
            {current
              ? "Guardar"
              : `Activar${days > 0 ? ` · ${days} ${days === 1 ? "día" : "días"}` : ""}`}
          </Button>
          {current && (
            <div className="flex gap-2">
              <Button
                full
                variant="secondary"
                onClick={() => {
                  onEndNow();
                  onClose();
                }}
              >
                Volví antes
              </Button>
              <Button
                full
                variant="danger"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
              >
                Cancelar viaje
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <input
              type="date"
              className={inputCls}
              value={start}
              // El arranque de un tramo ya empezado no se toca: correrlo
              // reescribiría cómo se leyeron días que ya pasaron.
              disabled={!!current}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Hasta" error={invalid ? "La vuelta va después" : undefined}>
            <input
              type="date"
              className={inputCls}
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          {VACATION_PRESETS.map((n) => (
            <Chip
              key={n}
              selected={days === n}
              onClick={() => preset(n)}
            >
              {n} días
            </Chip>
          ))}
        </div>

        {!current && (
          <Field label="¿A dónde? (opcional)">
            <input
              className={inputCls}
              placeholder="Brasil, casamiento, visita a la familia…"
              value={label}
              maxLength={40}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
        )}

        <div className="flex flex-col gap-2 rounded-card bg-sunken p-3">
          <p className="text-xs font-semibold">Qué cambia</p>
          <ul className="flex flex-col gap-1.5 text-xs text-muted">
            <li>
              🎯 <strong className="text-foreground">Metas al mantenimiento</strong>
              : {flex.calories.toLocaleString("es-AR")} kcal y {flex.protein} g de
              proteína, en vez de {goals.calories.toLocaleString("es-AR")} y{" "}
              {goals.protein}. La proteína queda como piso: es lo único que se
              pierde en una semana floja.
            </li>
            <li>
              🏖️ <strong className="text-foreground">Rutina corta</strong>: cuerpo
              entero, sin equipamiento, 20 minutos. La misma todos los días — el
              split del mes se retoma al volver.
            </li>
            <li>
              🔥 <strong className="text-foreground">La racha no se corta</strong>:
              los días sin gimnasio se leen como descanso, no como olvidos.
            </li>
            <li>
              🔕 <strong className="text-foreground">Un solo aviso por día</strong>,
              a la mañana. El de la noche —el que reclama— no se manda.
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted">
          Seguí registrando lo que comés: para eso está el modo. Los datos del
          viaje valen tanto como los de una semana normal, y sin ellos volver es
          adivinar.
        </p>
      </div>
    </Sheet>
  );
}
