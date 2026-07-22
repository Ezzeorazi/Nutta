"use client";

export type Tab = "chat" | "hoy" | "gym" | "progreso" | "historial";

type Props = {
  tab: Tab;
  onChange: (t: Tab) => void;
};

const items: { key: Tab; label: string; icon: string }[] = [
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "hoy", label: "Hoy", icon: "🍽️" },
  { key: "gym", label: "Gym", icon: "🏋️" },
  { key: "progreso", label: "Progreso", icon: "📈" },
  { key: "historial", label: "Historial", icon: "📊" },
];

export default function BottomNav({ tab, onChange }: Props) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-md">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              {/* Indicador del tab activo (no depende solo del color) */}
              {active && (
                <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
              )}
              <span className="text-lg leading-none">{it.icon}</span>
              <span className={active ? "font-semibold" : ""}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
