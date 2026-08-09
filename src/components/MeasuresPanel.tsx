"use client";

import { axisProps, chartMargin, tooltipStyle, yAxis } from "@/lib/chart";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import { inputCls } from "@/components/ui/Field";
import {
  MEASURE_PARTS,
  type BodyPart,
  type MeasureEntry,
} from "@/lib/types";
import { weeklyAverages } from "@/lib/week";

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export default function MeasuresPanel({
  measures,
  onAdd,
  today,
}: {
  measures: MeasureEntry[];
  onAdd: (part: BodyPart, cm: number, date: string) => void;
  today: string;
}) {
  const [part, setPart] = useState<BodyPart>("cintura");
  const [cm, setCm] = useState("");

  const partPoints = useMemo(
    () => measures.filter((m) => m.part === part),
    [measures, part],
  );

  const current = partPoints.length
    ? partPoints[partPoints.length - 1].cm
    : null;
  const delta =
    partPoints.length >= 2 ? current! - partPoints[0].cm : null;

  // Promedio por semana (lunes) de la parte elegida.
  const chartData = useMemo(
    () =>
      weeklyAverages(
        partPoints,
        (p) => p.date,
        (p) => p.cm,
      ).map((w) => ({ label: shortDate(w.weekStart), cm: w.value })),
    [partPoints],
  );
  const yProps = useMemo(
    () => yAxis(chartData.map((d) => d.cm)),
    [chartData],
  );

  const meta = MEASURE_PARTS.find((p) => p.key === part)!;
  const cintura = measures.filter((m) => m.part === "cintura").at(-1)?.cm;
  const summary =
    cintura != null ? `Cintura ${cintura} cm` : "Sin registros todavía";

  const submit = () => {
    const n = Number(cm);
    if (n > 0) {
      onAdd(part, n, today);
      setCm("");
    }
  };

  return (
    <CollapsibleCard icon="📏" title="Medidas corporales" summary={summary}>
      {/* Selector de parte */}
      <div className="flex flex-wrap gap-2">
        {MEASURE_PARTS.map((p) => {
          const last = measures.filter((m) => m.part === p.key).at(-1)?.cm;
          return (
            <Chip
              key={p.key}
              selected={part === p.key}
              onClick={() => setPart(p.key)}
            >
              <span>{p.emoji}</span>
              {p.label}
              {last != null && (
                <span className="tabular-nums opacity-70">· {last}cm</span>
              )}
            </Chip>
          );
        })}
      </div>

      <div className="rounded-control bg-sunken p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold">
            {meta.emoji} {meta.label}
          </h3>
          {current != null && (
            <span className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {current}
                <span className="text-sm text-muted"> cm</span>
              </span>
              {delta != null && Math.abs(delta) >= 0.1 && (
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    delta <= 0 ? "text-success" : "text-accent"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}
                </span>
              )}
            </span>
          )}
        </div>

        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={chartMargin}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} {...yProps} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v} cm`, meta.label]}
              />
              <Line
                type="monotone"
                dataKey="cm"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--primary)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-3 text-center text-sm text-muted">
            Registrá {meta.label.toLowerCase()} en un par de semanas para ver la
            evolución.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            className={inputCls}
            value={cm}
            onChange={(e) => setCm(e.target.value)}
            placeholder={`${meta.label} de hoy (cm)`}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} disabled={!(Number(cm) > 0)}>
            Guardar
          </Button>
        </div>
      </div>
    </CollapsibleCard>
  );
}
