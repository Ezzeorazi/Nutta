type Props = {
  label: string;
  value: number;
  goal: number;
  color: string;
  /**
   * Qué significa pasarse. En proteína, de más está bien; en carbos y grasas
   * es un excedente que conviene ver. Sin esto la barra topaba en 100% y
   * mostraba 129/94 g de grasa en verde lleno, igual que una meta cumplida.
   */
  overTone?: "ok" | "warn";
};

export default function MacroBar({
  label,
  value,
  goal,
  color,
  overTone = "warn",
}: Props) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const excess = goal > 0 ? Math.round(value - goal) : 0;
  const over = excess > 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 text-muted tabular-nums">
          {Math.round(value)} / {goal} g
          {over && (
            <span
              className={`ml-1.5 font-semibold ${
                overTone === "ok" ? "text-success" : "text-accent"
              }`}
            >
              +{excess}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            // El excedente se marca en la barra además del número: un color
            // solo no alcanza si no distinguís bien los tonos.
            backgroundColor: over && overTone === "warn" ? "var(--accent)" : color,
          }}
        />
      </div>
    </div>
  );
}
