"use client";

export type Tab = "chat" | "hoy" | "progreso" | "historial";

type Props = {
  tab: Tab;
  onChange: (t: Tab) => void;
};

const items: { key: Tab; label: string; icon: string }[] = [
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "hoy", label: "Hoy", icon: "🍽️" },
  { key: "progreso", label: "Progreso", icon: "📈" },
  { key: "historial", label: "Historial", icon: "📊" },
];

export default function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              <span className="text-lg leading-none">{it.icon}</span>
              <span className={active ? "font-semibold" : ""}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
