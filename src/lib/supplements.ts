import type { Supplement, SupplementLog } from "@/lib/types";

/** Proteína (g) aportada por un registro, según la cantidad realmente tomada. */
export function supplementLogProtein(
  sup: Supplement | undefined,
  log: Pick<SupplementLog, "qty">,
): number {
  if (!sup?.protein || !sup.defaultQty) return 0;
  const qty = log.qty ?? sup.defaultQty;
  return (qty / sup.defaultQty) * sup.protein;
}

/** Proteína total (g) aportada por suplementos en un día. */
export function dailySupplementProtein(
  supplements: Supplement[],
  logs: SupplementLog[],
  date: string,
): number {
  return logs
    .filter((l) => l.date === date)
    .reduce(
      (sum, l) =>
        sum + supplementLogProtein(supplements.find((s) => s.id === l.supId), l),
      0,
    );
}
