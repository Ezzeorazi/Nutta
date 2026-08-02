"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/Field";
import { MEMORY_KINDS, type MemoryFact, type MemoryKind } from "@/lib/types";

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
    <Sheet
      title="Lo que Nutta recuerda de vos"
      description="La IA usa esto para entenderte (ej. «hice lo de siempre») y lo va aprendiendo sola."
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {MEMORY_KINDS.map((k) => (
              <Chip
                key={k.key}
                selected={kind === k.key}
                onClick={() => setKind(k.key)}
              >
                {k.emoji} {k.label}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Ej. Mi desayuno de siempre: 3 huevos y café"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              aria-label="Qué querés que recuerde"
            />
            <Button onClick={submit} disabled={!text.trim()}>
              Guardar
            </Button>
          </div>
        </div>

        {/* La lista ya no tiene scroll propio: el cuerpo del sheet scrollea, y
            dos áreas de scroll anidadas hacen que el gesto elija mal. */}
        {memories.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            Todavía no hay nada guardado. Contale a Nutta tus hábitos o
            agregalos acá arriba.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memories.map((m) => {
              const meta = kindMeta(m.kind);
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-2 rounded-control bg-sunken px-3.5 py-2.5"
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
                    type="button"
                    onClick={() => onRemove(m.id)}
                    className="-mr-1.5 -mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-transform duration-(--duration-fast) active:scale-90 hover:text-accent"
                    aria-label={`Olvidar: ${m.text}`}
                  >
                    <Trash2 size={16} aria-hidden />
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
