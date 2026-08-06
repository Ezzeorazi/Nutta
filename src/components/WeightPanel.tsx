"use client";

import { axisProps, chartMargin, tooltipStyle, yAxis } from "@/lib/chart";
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
import Button from "@/components/ui/Button";
import { Field, inputCls } from "@/components/ui/Field";
import type { BodyVerdict } from "@/lib/body";
import type { WeightEntry } from "@/lib/types";
import { weightPoints, weightTrend } from "@/lib/weight";
import { weeklyAverages } from "@/lib/week";

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export default function WeightPanel({
  weights,
  targetWeight,
  bodyVerdict,
  onAdd,
  onSetTarget,
  today,
}: {
  weights: WeightEntry[];
  targetWeight?: number;
  /** Lectura de las medidas: sin ella el panel juzga con la balanza sola. */
  bodyVerdict?: BodyVerdict;
  onAdd: (kg: number, date: string) => void;
  onSetTarget: (kg: number) => void;
  today: string;
}) {
  const points = useMemo(() => weightPoints(weights), [weights]);
  const trend = useMemo(
    () => weightTrend(points, targetWeight, bodyVerdict),
    [points, targetWeight, bodyVerdict],
  );

  // Subir de peso no es rojo cuando las medidas dicen que es músculo.
  const gainingIsFine =
    bodyVerdict === "recomposicion" || bodyVerdict === "musculo";

  const last = weights.length ? weights[weights.length - 1].kg : "";
  const [kg, setKg] = useState<string>(String(last || ""));
  const [target, setTarget] = useState<string>(
    targetWeight ? String(targetWeight) : "",
  );

  // El gráfico muestra el promedio por semana (lunes): suaviza el ruido diario.
  const chartData = useMemo(
    () =>
      weeklyAverages(
        points,
        (p) => p.date,
        (p) => p.kg,
      ).map((w) => ({ label: shortDate(w.weekStart), kg: w.value })),
    [points],
  );

  // La meta entra al dominio del eje: si no, su línea punteada puede caer
  // fuera del gráfico y desaparecer sin explicación.
  const yProps = useMemo(
    () =>
      yAxis([
        ...chartData.map((d) => d.kg),
        ...(targetWeight ? [targetWeight] : []),
      ]),
    [chartData, targetWeight],
  );

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
      <div className="rounded-card bg-card p-5 shadow-e1">
        <p className="text-xs uppercase tracking-wide text-muted">Peso actual</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">
            {trend ? trend.current : "—"}
          </span>
          <span className="text-lg text-muted">kg</span>
          {trend && weights.length >= 2 && (
            <span
              className={`ml-auto text-sm font-semibold tabular-nums ${
                trend.deltaTotal <= 0 || gainingIsFine
                  ? "text-success"
                  : "text-accent"
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
        <div className="rounded-card bg-card p-4 shadow-e1">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Evolución</h2>
            <span className="text-xs text-muted">por semana</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={chartMargin}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} {...yProps} />
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
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          Registrá tu peso a lo largo de un par de semanas y vas a ver el
          gráfico y la predicción acá.
        </p>
      )}

      {/* Registrar / Meta */}
      <div className="flex flex-col gap-4 rounded-card bg-card p-4 shadow-e1">
        <Field label="Registrar peso de hoy (kg)">
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
            <Button
              variant="accent"
              onClick={submitWeight}
              disabled={!(Number(kg) > 0)}
            >
              Guardar
            </Button>
          </div>
        </Field>
        <Field label="Meta de peso (kg)">
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
            <Button onClick={submitTarget} disabled={!(Number(target) > 0)}>
              Fijar
            </Button>
          </div>
        </Field>
      </div>
    </section>
  );
}
