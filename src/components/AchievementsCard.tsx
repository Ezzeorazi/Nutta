"use client";

import { useMemo } from "react";
import {
  activeDays,
  computeAchievements,
  streakFromDates,
  type AchievementInput,
} from "@/lib/achievements";

export default function AchievementsCard(input: AchievementInput) {
  const streak = useMemo(
    () => streakFromDates(activeDays(input), input.today),
    [input],
  );
  const achievements = useMemo(() => computeAchievements(input), [input]);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <section className="flex flex-col gap-4">
      {/* Rachas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold tabular-nums">
            🔥 {streak.current}
          </p>
          <p className="text-xs text-muted">
            {streak.current === 1 ? "día" : "días"} de racha
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold tabular-nums">{streak.best}</p>
          <p className="text-xs text-muted">tu mejor racha</p>
        </div>
      </div>

      {/* Logros */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Logros</h2>
          <span className="text-xs text-muted tabular-nums">
            {unlocked}/{achievements.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col gap-1 rounded-2xl border p-3 ${
                a.unlocked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border opacity-60"
              }`}
            >
              <span className={`text-2xl ${a.unlocked ? "" : "grayscale"}`}>
                {a.emoji}
              </span>
              <span className="text-sm font-semibold leading-tight">
                {a.title}
              </span>
              <span className="text-[11px] leading-tight text-muted">
                {a.desc}
              </span>
              {!a.unlocked && a.progress && a.progress.target > 1 && (
                <span className="mt-0.5 text-[10px] tabular-nums text-muted">
                  {a.progress.cur}/{a.progress.target}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
