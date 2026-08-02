"use client";

/**
 * Encabezado común a todos los tabs.
 *
 * Antes cada pantalla dibujaba el suyo con tamaños y comportamientos distintos
 * (Hoy `text-2xl` sin sticky, Chat `text-lg` sticky con blur, Entreno `text-2xl`
 * con `items-baseline`), y al cambiar de tab el título saltaba de lugar.
 *
 * Va pegado arriba en todas: las pantallas son largas y perder el contexto de
 * dónde estás parado al scrollear es innecesario.
 */
export default function AppHeader({
  title,
  subtitle,
  actions,
  below,
}: {
  title: React.ReactNode;
  /** Bajada breve, al lado del título. */
  subtitle?: string;
  /** Acciones a la derecha (perfil, memoria, análisis…). */
  actions?: React.ReactNode;
  /** Fila secundaria bajo el título, p. ej. el navegador de días. */
  below?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 -mt-6 mb-0 bg-background/85 px-4 pb-3 pt-6 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {below && <div className="mt-3">{below}</div>}
    </header>
  );
}
