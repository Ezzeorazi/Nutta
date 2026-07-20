"use client";

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
import { inputCls } from "@/components/Sheet";
import {
  MEASURE_PARTS,
  type BodyPart,
  type MeasureEntry,
} from "@/lib/types";

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

  const chartData = partPoints.map((p) => ({
    label: shortDate(p.date),
    cm: p.cm,
  }));

  const meta = MEASURE_PARTS.find((p) => p.key === part)!;

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--foreground)",
  } as const;

  const submit = () => {
    const n = Number(cm);
    if (n > 0) {
      onAdd(part, n, today);
      setCm("");
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Medidas corporales</h2>

      {/* Selector de parte */}
      <div className="flex flex-wrap gap-2">
        {MEASURE_PARTS.map((p) => {
          const last = measures.filter((m) => m.part === p.key).at(-1)?.cm;
          return (
            <button
              key={p.key}
              onClick={() => setPart(p.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${
                part === p.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted"
              }`}
            >
              <span>{p.emoji}</span>
              {p.label}
              {last != null && (
                <span className="tabular-nums opacity-70">· {last}cm</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
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
            Registrá {meta.label.toLowerCase()} un par de veces para ver la
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
          <button
            onClick={submit}
            disabled={!(Number(cm) > 0)}
            className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </section>
  );
}
