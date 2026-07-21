"use client";

import { useRef, useState } from "react";
import type { ResolvedPhoto } from "@/lib/useNutta";

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export default function PhotosPanel({
  photos,
  today,
  onAdd,
  onRemove,
}: {
  photos: ResolvedPhoto[];
  today: string;
  onAdd: (file: File, date: string) => Promise<void>;
  onRemove: (id: string, path: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [antesId, setAntesId] = useState<string | null>(null);
  const [despuesId, setDespuesId] = useState<string | null>(null);
  const [pos, setPos] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);

  const withUrl = photos.filter((p) => p.url);
  const antes =
    withUrl.find((p) => p.id === antesId) ?? withUrl[0];
  const despues =
    withUrl.find((p) => p.id === despuesId) ?? withUrl[withUrl.length - 1];

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await onAdd(file, today);
    } catch {
      setError("No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Fotos de progreso</h2>
        <label className="cursor-pointer rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground active:scale-95">
          {uploading ? "Subiendo…" : "+ Foto"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {error && <p className="text-xs text-accent">{error}</p>}

      {withUrl.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted">
          Subí fotos cada tanto para comparar tu antes y después.
        </p>
      ) : (
        <>
          {/* Comparación antes/después */}
          {withUrl.length >= 2 && antes && despues && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={despues.url}
                  alt="Después"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={antes.url}
                  alt="Antes"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/90"
                  style={{ left: `${pos}%` }}
                />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  Antes · {shortDate(antes.date)}
                </span>
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  Después · {shortDate(despues.date)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Comparar antes y después"
              />
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                  Antes
                  <select
                    value={antes.id}
                    onChange={(e) => setAntesId(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {withUrl.map((p) => (
                      <option key={p.id} value={p.id}>
                        {shortDate(p.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                  Después
                  <select
                    value={despues.id}
                    onChange={(e) => setDespuesId(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {withUrl.map((p) => (
                      <option key={p.id} value={p.id}>
                        {shortDate(p.date)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Galería */}
          <div className="grid grid-cols-3 gap-2">
            {withUrl.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Foto ${shortDate(p.date)}`}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
                  {shortDate(p.date)}
                </span>
                <button
                  onClick={() => onRemove(p.id, p.path)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-sm text-white active:scale-90"
                  aria-label="Eliminar foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
