"use client";

import type { Insight, InsightTone } from "@/lib/insights";

const toneClasses: Record<InsightTone, string> = {
  good: "border-l-success",
  warn: "border-l-accent",
  info: "border-l-primary",
};

export default function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">Insights</h2>
      <ul className="flex flex-col gap-2">
        {insights.map((it, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-xl border border-border border-l-4 bg-card px-3 py-2.5 ${
              toneClasses[it.tone]
            }`}
          >
            <span className="text-lg leading-none">{it.emoji}</span>
            <span className="text-sm">{it.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
