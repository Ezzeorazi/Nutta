/**
 * Id corto para registros nuevos.
 *
 * Vivía dentro de `components/Sheet.tsx`, que era un lugar raro para algo que
 * no tiene nada que ver con la interfaz: quedó ahí por arrastre.
 */
export const uid = () => Math.random().toString(36).slice(2, 10);
