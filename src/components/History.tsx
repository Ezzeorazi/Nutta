"use client";

import { useMemo, useState } from "react";
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
import AchievementsCard from "@/components/AchievementsCard";
import ExportPanel from "@/components/ExportPanel";
import { averages, lastNDays } from "@/lib/analytics";
import { groupByExercise, groupStatsInRange } from "@/lib/gym";
import type {
  CustomGoal,
  DailyMetrics,
  ExerciseEntry,
  FoodEntry,
  Goals,
  MeasureEntry,
  PhotoEntry,
  StrengthSet,
  Supplement,
  SupplementLog,
  WeightEntry,
} from "@/lib/types";

type Props = {
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  goals: Goals;
  strengthSets: StrengthSet[];
  weights: WeightEntry[];
  metrics: DailyMetrics[];
  measures: MeasureEntry[];
  customGoals: CustomGoal[];
  photos: Pick<PhotoEntry, "id">[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  targetWeight?: number;
  today: string;
};

export default function History({
  foods,
  exercises,
  goals,
  strengthSets,
  weights,
  metrics,
  measures,
  customGoals,
  photos,
  supplements,
  supplementLogs,
  targetWeight,
  today,
}: Props) {
  const [days, setDays] = useState<7 | 30>(7);
  const stats = useMemo(
    () => lastNDays(foods, exercises, days, supplements, supplementLogs),
    [foods, exercises, days, supplements, supplementLogs],
  );
  const avg = useMemo(() => averages(stats), [stats]);
  const xKey = days === 7 ? "label" : "dm";
  const xInterval = days === 7 ? 0 : 4;

  // Ventana de fuerza: la misma que la de los gráficos de comida (7d/30d).
  const fromISO = stats[0]?.date ?? today;
  const groupStats = useMemo(
    () =>
      groupStatsInRange(strengthSets, fromISO, today).filter(
        (g) => g.sets > 0,
      ),
    [strengthSets, fromISO, today],
  );
  const maxGroupSets = Math.max(1, ...groupStats.map((g) => g.sets));
  const strengthDaysInRange = useMemo(
    () =>
      new Set(
        strengthSets
          .filter((s) => s.date >= fromISO && s.date <= today)
          .map((s) => s.date),
      ).size,
    [strengthSets, fromISO, today],
  );
  const topExercises = useMemo(
    () =>
      groupByExercise(
        strengthSets.filter((s) => s.date >= fromISO && s.date <= today),
      )
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
    [strengthSets, fromISO, today],
  );

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--foreground)",
  } as const;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="text-sm text-muted">Rachas, logros y estadísticas</p>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1 font-medium transition ${
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      <AchievementsCard
        foods={foods}
        exercises={exercises}
        strengthSets={strengthSets}
        weights={weights}
        metrics={metrics}
        photos={photos}
        targetWeight={targetWeight}
        today={today}
      />

      {/* Entrenamiento: qué grupos y ejercicios se trabajaron en la ventana */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Entrenamiento</h2>
          <span className="text-xs text-muted">
            {strengthDaysInRange} días de fuerza
          </span>
        </div>

        {groupStats.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted">
            Cargá series de fuerza para ver qué grupos entrenaste.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {groupStats.map((g) => (
                <div key={g.group} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium capitalize">{g.group}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {g.sets} {g.sets === 1 ? "serie" : "series"} ·{" "}
                      {Math.round(g.volume).toLocaleString("es-AR")} kg
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${(g.sets / maxGroupSets) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {topExercises.length > 0 && (
              <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-muted">
                  Top ejercicios
                </h3>
                {topExercises.map((ex) => (
                  <div
                    key={ex.exercise}
                    className="flex items-baseline justify-between text-sm"
                  >
                    <span>{ex.exercise}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {ex.sets.length}{" "}
                      {ex.sets.length === 1 ? "serie" : "series"} ·{" "}
                      {Math.round(ex.volume).toLocaleString("es-AR")} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Promedios */}
      <section className="grid grid-cols-3 gap-3">
        <StatTile label="Días" value={avg.daysLogged} suffix={`/${days}`} />
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
              dataKey={xKey}
              interval={xInterval}
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
              dataKey={xKey}
              interval={xInterval}
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

      <ExportPanel
        foods={foods}
        exercises={exercises}
        strengthSets={strengthSets}
        weights={weights}
        measures={measures}
        metrics={metrics}
        customGoals={customGoals}
      />
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
