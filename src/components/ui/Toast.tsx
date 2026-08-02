"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";

type ToastAction = { label: string; onAction: () => void };
type ToastItem = { id: number; message: string; action?: ToastAction };
type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

/**
 * Confirma una acción sin interrumpir.
 *
 * Su razón de ser es la acción de deshacer: hasta ahora el chat podía revertir
 * lo que registraba y los formularios no, así que un error de carga manual
 * había que ir a buscarlo al timeline para borrarlo.
 */
export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback<ShowToast>((message, action) => {
    if (timer.current) clearTimeout(timer.current);
    // Uno por vez: dos avisos apilados compiten entre sí y no se lee ninguno.
    setToast({ id: nextId.current++, message, action });
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        // `pointer-events-none` en el contenedor para no tapar la nav de abajo;
        // el aviso en sí los vuelve a habilitar para que su botón sea clickeable.
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-45 flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.21, ease: [0.32, 0.72, 0, 1] }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-control bg-foreground px-4 py-3 shadow-e3"
            >
              <span className="min-w-0 flex-1 text-sm text-background">
                {toast.message}
              </span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onAction();
                    dismiss();
                  }}
                  className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-background underline underline-offset-2 active:scale-95"
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
