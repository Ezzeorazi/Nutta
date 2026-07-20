"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { inputCls } from "@/components/Sheet";
import type { WeightEntry } from "@/lib/types";
import { weightPoints, weightTrend } from "@/lib/weight";

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export default function WeightPanel({
  weights,
  targetWeight,
  onAdd,
  onSetTarget,
  today,
}: {
  weights: WeightEntry[];
  targetWeight?: number;
  onAdd: (kg: number, date: string) => void;
  onSetTarget: (kg: number) => void;
  today: string;
}) {
  const points = useMemo(() => weightPoints(weights), [weights]);
  const trend = useMemo(
    () => weightTrend(points, targetWeight),
    [points, targetWeight],
  );

  const last = weights.length ? weights[weights.length - 1].kg : "";
  const [kg, setKg] = useState<string>(String(last || ""));
  const [target, setTarget] = useState<string>(
    targetWeight ? String(targetWeight) : "",
  );

  const chartData = points.map((p) => ({ label: shortDate(p.date), kg: p.kg }));

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--foreground)",
  } as const;

  const submitWeight = () => {
    const n = Number(kg);
    if (n > 0) onAdd(n, today);
  };
  const submitTarget = () => {
    const n = Number(target);
    if (n > 0) onSetTarget(n);
  };

  return (
    <section className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Peso actual</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">
            {trend ? trend.current : "—"}
          </span>
          <span className="text-lg text-muted">kg</span>
          {trend && weights.length >= 2 && (
            <span
              className={`ml-auto text-sm font-semibold tabular-nums ${
                trend.deltaTotal <= 0 ? "text-success" : "text-accent"
              }`}
            >
              {trend.deltaTotal > 0 ? "+" : ""}
              {trend.deltaTotal.toFixed(1)} kg
            </span>
          )}
        </div>
        {trend?.etaText && (
          <p className="mt-2 text-sm text-muted">
            {targetWeight ? `Meta ${targetWeight} kg · ` : ""}
            {trend.etaText}
          </p>
        )}
        {trend && weights.length >= 2 && (
          <p className="mt-1 text-xs text-muted">
            Tendencia: {trend.slopePerWeek > 0 ? "+" : ""}
            {trend.slopePerWeek.toFixed(2)} kg/semana
          </p>
        )}
      </div>

      {/* Gráfico */}
      {chartData.length >= 2 ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Evolución</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted)"
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted)"
                width={40}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v} kg`, "Peso"]}
              />
              {targetWeight ? (
                <ReferenceLine
                  y={targetWeight}
                  stroke="var(--primary)"
                  strokeDasharray="4 4"
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="kg"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--accent)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted">
          Registrá tu peso unos días y vas a ver el gráfico y la predicción acá.
        </p>
      )}

      {/* Registrar / Meta */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs text-muted">
            Registrar peso de hoy (kg)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className={inputCls}
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="Ej. 80.5"
            />
            <button
              onClick={submitWeight}
              disabled={!(Number(kg) > 0)}
              className="shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground active:scale-95 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">
            Meta de peso (kg)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className={inputCls}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Ej. 78"
            />
            <button
              onClick={submitTarget}
              disabled={!(Number(target) > 0)}
              className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              Fijar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
