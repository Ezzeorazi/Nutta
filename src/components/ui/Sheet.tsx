"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { useDismissable } from "@/lib/useDismissable";

/**
 * Duración de la animación de salida de vaul (su `TRANSITIONS.DURATION`, 0.5s).
 * Hay que esperarla antes de desmontar o el sheet desaparece de golpe.
 */
const EXIT_MS = 500;

type Props = {
  title: string;
  /** Bajada opcional. También cumple el `aria-describedby` del diálogo. */
  description?: string;
  /** Acciones fijas al pie: no se van con el scroll del cuerpo. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
};

/**
 * Bottom sheet de la app.
 *
 * Se puede cerrar de cinco formas, y todas terminan en el mismo lugar: la cruz,
 * el arrastre hacia abajo, ESC, el tap en el fondo y el botón atrás del
 * teléfono. Trae además bloqueo de scroll del fondo, trampa de foco y roles
 * ARIA, que vienen de Radix Dialog por debajo de vaul.
 *
 * El padre lo monta condicionalmente (`{abierto && <Sheet …/>}`) y recibe
 * `onClose` recién cuando la animación de salida terminó.
 */
export default function Sheet({
  title,
  description,
  footer,
  children,
  onClose,
}: Props) {
  const [open, setOpen] = useState(false);

  // `onClose` suele venir como arrow inline desde el padre, así que cambia en
  // cada render. Por ref para que el temporizador de salida no se reinicie.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Nace cerrado y se abre en el primer frame: si naciera abierto, vaul no
  // tendría un estado previo desde donde animar y el sheet aparecería de golpe.
  // Va dentro de un rAF para que el navegador llegue a pintar el estado cerrado
  // antes del cambio, que es lo que hace que la transición efectivamente corra.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const requestClose = useCallback(() => setOpen(false), []);

  useDismissable(open, requestClose);

  // Desmontar al terminar la salida. El flag evita que el render inicial
  // (todavía en `open: false`) programe un cierre apenas se abre.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    const timer = setTimeout(() => closeRef.current(), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Radix avisa por consola si un diálogo no tiene descripción accesible.
  // Cuando hay bajada la cablea solo desde `Drawer.Description`; cuando no,
  // se le dice explícitamente que no la busque. No se puede pasar siempre:
  // un `aria-describedby` explícito pisaría el que arma Radix.
  const noDescription = description ? {} : { "aria-describedby": undefined };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      repositionInputs
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Drawer.Content
          {...noDescription}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-sheet bg-card shadow-e3 outline-none"
        >
          {/* Agarradera: además de indicar que se arrastra, es el área de drag
              más segura cuando el cuerpo del sheet tiene su propio scroll. */}
          <Drawer.Handle className="mx-auto mt-3 h-1.5! w-10! shrink-0 rounded-full! bg-border!" />

          <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <Drawer.Title className="truncate text-lg font-semibold">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="mt-0.5 text-sm text-muted">
                  {description}
                </Drawer.Description>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar"
              className="-mr-1.5 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-foreground"
            >
              <X size={20} strokeWidth={2.25} aria-hidden />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {children}
          </div>

          {footer && (
            <div className="shrink-0 border-t border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {footer}
            </div>
          )}

          {/* Sin footer, igual hace falta respetar la barra de gestos del sistema. */}
          {!footer && (
            <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
