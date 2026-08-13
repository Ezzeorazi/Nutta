import type { EnergyBalance } from "@/lib/athlete";

type Props = {
  consumed: number;
  burned: number;
  goal: number;
  /** Veredicto del día. Sin él, el anillo solo sabe contar hacia atrás. */
  energy?: EnergyBalance;
};

const TONE_COLOR = {
  good: "var(--success)",
  warn: "var(--accent)",
  bad: "var(--danger)",
  neutral: "var(--primary)",
} as const;

/**
 * El anillo del día. Mientras el día está abierto cuenta lo que queda —que es
 * lo accionable—; una vez cerrado deja de pedir comida y muestra cómo terminó:
 * "1.147 kcal por debajo · Déficit excesivo" dice algo, "1.147 kcal restantes"
 * a las 23 h manda a comer de más.
 */
export default function CalorieRing({ consumed, burned, goal, energy }: Props) {
  const net = Math.max(0, consumed - burned);
  const remaining = Math.max(0, goal - net);
  const pct = goal > 0 ? Math.min(1, net / goal) : 0;

  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = net > goal;

  const closed = energy?.closed ?? false;
  const delta = energy?.delta ?? net - goal;
  const color = closed
    ? TONE_COLOR[energy!.tone]
    : over
      ? "var(--accent)"
      : "var(--primary)";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums">
          {closed ? Math.abs(Math.round(delta)) : remaining}
        </span>
        <span className="text-sm text-muted">
          {closed
            ? delta < 0
              ? "kcal por debajo"
              : "kcal de más"
            : over
              ? "kcal de más"
              : "kcal restantes"}
        </span>
        {closed && (
          <span
            className="mt-1 text-xs font-semibold"
            style={{ color }}
          >
            {energy!.label}
          </span>
        )}
        <span className="mt-1 text-xs text-muted tabular-nums">
          {consumed} in · {burned} out
        </span>
      </div>
    </div>
  );
}
