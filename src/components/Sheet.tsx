/**
 * Compatibilidad.
 *
 * `Sheet` se rehízo sobre vaul y vive en `@/components/ui/Sheet`; los campos,
 * en `@/components/ui/Field`. Este archivo mantiene en pie los imports de las
 * diez pantallas que ya lo usaban, así la mejora del sheet (cruz con área
 * táctil real, arrastre, ESC, botón atrás, scroll interno) llega a todas sin
 * tocarlas una por una.
 *
 * Se borra cuando todas importen de `@/components/ui`.
 */
export { default } from "@/components/ui/Sheet";
export { Field, Input, inputCls } from "@/components/ui/Field";

/** Id corto para registros nuevos. */
export const uid = () => Math.random().toString(36).slice(2, 10);
