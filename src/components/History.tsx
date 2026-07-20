"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { averages, lastNDays } from "@/lib/analytics";
import type { Goals, ExerciseEntry, FoodEntry } from "@/lib/types";

type Props = {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  goals: Goals;
};

export default function History({ foods, exercises, goals }: Props) {
  const stats = useMemo(
    () => lastNDays(foods, exercises, 7),
    [foods, exercises],
  );
  const avg = useMemo(() => averages(stats), [stats]);

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--foreground)",
  } as const;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm text-muted">Últimos 7 días</p>
      </header>

      {/* Promedios */}
      <section className="grid grid-cols-3 gap-3">
        <StatTile label="Días" value={avg.daysLogged} suffix="/7" />
        <StatTile label="Prom. kcal" value={avg.calories} />
        <StatTile label="Prom. prot." value={avg.protein} suffix="g" />
      </section>

      {/* Calorías netas por día */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Calorías netas</h2>
          <span className="text-xs text-muted">
            meta {goals.calories} kcal
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--muted)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--muted)"
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--border)", opacity: 0.4 }}
              formatter={(v) => [`${v} kcal`, "Neto"]}
            />
            <ReferenceLine
              y={goals.calories}
              stroke="var(--accent)"
              strokeDasharray="4 4"
            />
            <Bar dataKey="net" radius={[6, 6, 0, 0]}>
              {stats.map((s) => (
                <Cell
                  key={s.date}
                  fill={
                    s.net > goals.calories ? "var(--accent)" : "var(--primary)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Macros por día */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Macros (g)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={stats} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--muted)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="var(--muted)"
              width={40}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="protein"
              name="Proteína"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="carbs"
              name="Carbos"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fat"
              name="Grasas"
              stroke="var(--success)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {avg.daysLogged === 0 && (
        <p className="text-center text-sm text-muted">
          Registrá comidas y ejercicio para ver tu progreso acá.
        </p>
      )}
    </main>
  );
}

function StatTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-xl font-bold tabular-nums">
        {value}
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
