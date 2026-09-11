"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";

/**
 * La base no contesta.
 *
 * Existe porque el modo de falla anterior era el peor posible: un error de la
 * query se veía idéntico a una cuenta nueva (sin datos → sin perfil → al
 * onboarding), y completarlo escribía un perfil duplicado encima de datos que
 * seguían ahí, solo que ilegibles. Ante la duda, la app ahora no escribe nada
 * y dice lo que pasó.
 */
export default function DataErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  /** El error crudo de InstantDB. Se muestra: es lo que permite diagnosticarlo. */
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
        <AlertTriangle size={26} strokeWidth={2} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">No pude leer tus datos</h1>
        <p className="text-sm text-muted">
          Tus registros están a salvo: es la conexión con la base la que está
          fallando, no los datos. No se guardó ni se borró nada.
        </p>
      </div>

      <p className="w-full rounded-card bg-sunken px-3 py-2 text-left font-mono text-xs break-words text-muted">
        {message}
      </p>

      <div className="flex w-full flex-col gap-2">
        <Button full size="lg" onClick={onRetry}>
          <RefreshCw size={18} strokeWidth={2.25} aria-hidden />
          Reintentar
        </Button>
        <Button full variant="ghost" onClick={onSignOut}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
