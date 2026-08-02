"use client";

import {
  CalendarDays,
  Dumbbell,
  MessageCircle,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";

export type Tab = "chat" | "hoy" | "gym" | "progreso" | "historial";

/** Orden de la barra. Lo usa además `page.tsx` para saber hacia qué lado animar. */
export const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
  { key: "chat", label: "Chat", Icon: MessageCircle },
  { key: "hoy", label: "Hoy", Icon: UtensilsCrossed },
  { key: "gym", label: "Gym", Icon: Dumbbell },
  { key: "progreso", label: "Progreso", Icon: TrendingUp },
  { key: "historial", label: "Historial", Icon: CalendarDays },
];

export default function BottomNav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-md">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2 transition-colors ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              {/* La píldora se desliza de un tab al otro en vez de aparecer y
                  desaparecer: comunica que es el mismo objeto que se movió.
                  `layoutId` es lo que hace la interpolación entre posiciones. */}
              {active && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-x-2 top-1 h-8 rounded-full bg-primary/10"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon
                size={21}
                strokeWidth={active ? 2.4 : 1.9}
                className="relative"
                aria-hidden
              />
              <span
                className={`relative text-[11px] leading-none ${active ? "font-semibold" : ""}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
