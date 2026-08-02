"use client";

import { MotionConfig } from "motion/react";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Contexto compartido de la interfaz.
 *
 * `reducedMotion="user"` hace que motion respete la preferencia del sistema.
 * El `@media (prefers-reduced-motion)` de globals.css solo alcanza a las
 * transiciones CSS: las animaciones de motion corren por JS y hay que apagarlas
 * acá, o quien pidió menos movimiento igual lo recibe.
 */
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
