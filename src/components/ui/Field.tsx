"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Estilo base de los campos.
 *
 * El `text-base` (16px) no es una decisión tipográfica: iOS hace zoom
 * automático al enfocar un campo de menos de 16px y después deja la página
 * descuadrada. Bajarlo a `text-sm` reintroduce ese bug.
 */
export const inputCls =
  "w-full rounded-control border border-border bg-background px-3.5 py-2.5 text-base outline-none transition-colors placeholder:text-muted focus:border-primary";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...rest} />;
}

/** Etiqueta + control apilados. `hint` explica; `error` corrige. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-accent">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
