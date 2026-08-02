"use client";

/**
 * Placeholder de carga.
 *
 * Se prefiere sobre un spinner porque anticipa la forma de lo que viene: la
 * pantalla no salta cuando llegan los datos.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-control bg-sunken ${className}`}
    />
  );
}

/** Esqueleto genérico de pantalla, para mientras cargan los datos del usuario. */
export function ScreenSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-6"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-56 w-full rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
    </main>
  );
}
