"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  secondary: "bg-sunken text-foreground",
  ghost: "text-muted hover:text-foreground",
  danger: "bg-sunken text-accent",
};

/**
 * Alturas mínimas de 44px: es el objetivo táctil más chico que se acierta sin
 * mirar. `sm` baja de eso a propósito y solo va donde el control es secundario
 * y está rodeado de aire (un chip suelto, nunca una fila de acciones juntas).
 */
const SIZES: Record<Size, string> = {
  sm: "min-h-8 gap-1.5 px-3 text-xs",
  md: "min-h-11 gap-2 px-4 text-sm",
  lg: "min-h-13 gap-2 px-5 text-base",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-control font-semibold transition-transform duration-(--duration-fast) active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
