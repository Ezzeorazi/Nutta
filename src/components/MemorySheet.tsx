"use client";

import { useState } from "react";
import Sheet, { inputCls } from "@/components/Sheet";
import {
  MEMORY_KINDS,
  type MemoryFact,
  type MemoryKind,
} from "@/lib/types";

const kindMeta = (k: MemoryKind) =>
  MEMORY_KINDS.find((x) => x.key === k) ?? MEMORY_KINDS[6];

export default function MemorySheet({
  memories,
  onAdd,
  onRemove,
  onClose,
}: {
  memories: MemoryFact[];
  onAdd: (kind: MemoryKind, text: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<MemoryKind>("habito");
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onAdd(kind, text);
    setText("");
  };

  return (
    <Sheet title="🧠 Lo que Nutta recuerda de vos" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted">
          La IA usa esto para entenderte (ej. «hice lo de siempre») y lo va
          aprendiendo sola. Podés editarlo cuando quieras.
        </p>

        {/* Alta manual */}
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3">
          <div className="flex flex-wrap gap-1.5">
            {MEMORY_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                  kind === k.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Ej. Mi desayuno de siempre: 3 huevos y café"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim()}
              className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>

        {/* Lista */}
        {memories.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            Todavía no hay nada guardado. Contale a Nutta tus hábitos o
            agregalos acá arriba.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {memories.map((m) => {
              const meta = kindMeta(m.kind);
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="flex min-w-0 items-start gap-2 text-sm">
                    <span className="shrink-0">{meta.emoji}</span>
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted">
                        {meta.label}
                      </span>
                      {m.text}
                    </span>
                  </span>
                  <button
                    onClick={() => onRemove(m.id)}
                    className="shrink-0 text-muted hover:text-accent"
                    aria-label="Olvidar"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
