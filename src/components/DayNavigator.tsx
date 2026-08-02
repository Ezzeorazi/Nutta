"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayLabel, shiftISO } from "@/lib/types";

/**
 * Navegador de días compartido por Hoy y Entreno.
 *
 * Antes cada pantalla tenía el suyo, con maquetación y tamaños distintos,
 * y `shiftISO` duplicada en los dos archivos.
 *
 * Detalle que evita frustración: cuando estás parado en un día pasado, tocar
 * la etiqueta vuelve directo a hoy. Sin eso hay que apretar › tantas veces
 * como días hayas retrocedido.
 */
export default function DayNavigator({
  viewDate,
  today,
  onChange,
}: {
  viewDate: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const isToday = viewDate === today;

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-sunken p-1">
      <button
        type="button"
        onClick={() => onChange(shiftISO(viewDate, -1))}
        aria-label="Día anterior"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-foreground"
      >
        <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => onChange(today)}
        disabled={isToday}
        aria-label={isToday ? undefined : "Volver a hoy"}
        className="min-w-24 rounded-full px-2 text-center text-sm font-medium capitalize transition-colors disabled:text-foreground enabled:text-muted enabled:hover:text-primary"
      >
        {isToday ? "Hoy" : dayLabel(viewDate)}
      </button>

      <button
        type="button"
        onClick={() => onChange(shiftISO(viewDate, 1))}
        disabled={isToday}
        aria-label="Día siguiente"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-25 hover:text-foreground"
      >
        <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
