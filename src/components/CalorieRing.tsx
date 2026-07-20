type Props = {
  consumed: number;
  burned: number;
  goal: number;
};

export default function CalorieRing({ consumed, burned, goal }: Props) {
  const net = Math.max(0, consumed - burned);
  const remaining = Math.max(0, goal - net);
  const pct = goal > 0 ? Math.min(1, net / goal) : 0;

  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = net > goal;

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
          stroke={over ? "var(--accent)" : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums">{remaining}</span>
        <span className="text-sm text-muted">
          {over ? "kcal de más" : "kcal restantes"}
        </span>
        <span className="mt-1 text-xs text-muted tabular-nums">
          {consumed} in · {burned} out
        </span>
      </div>
    </div>
  );
}
