"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Images, Pause, Play, Trash2 } from "lucide-react";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import type { ResolvedPhoto } from "@/lib/useNutta";
import { weekIndexFrom, weekStartISO } from "@/lib/week";

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
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Fotos con URL resuelta, en orden cronológico (ya vienen ordenadas por día).
  const withUrl = useMemo(() => photos.filter((p) => p.url), [photos]);
  const firstDate = withUrl[0]?.date;
  // "Sem. N" de una foto, relativo a la primera.
  const weekLabel = (date: string) =>
    firstDate ? `Sem. ${weekIndexFrom(firstDate, date)}` : "";

  // Recordatorio: ¿ya subiste foto esta semana?
  const currentWeek = weekStartISO(today);
  const hasThisWeek = withUrl.some((p) => weekStartISO(p.date) === currentWeek);

  // idx puede quedar fuera de rango tras borrar una foto; se clampea en cada
  // lectura (`current`, slider y play), así no hace falta sincronizarlo por effect.

  // Reproducción automática del time-lapse (loop).
  useEffect(() => {
    if (!playing || withUrl.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % withUrl.length);
    }, 800);
    return () => clearInterval(t);
  }, [playing, withUrl.length]);

  const handleFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await onAdd(file, today);
    } catch {
      setError("No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setUploading(false);
      // Se limpia para poder volver a elegir el MISMO archivo: si no, el input
      // no dispara change y parece que el botón no anda.
      input.value = "";
    }
  };

  const current = withUrl[Math.min(idx, withUrl.length - 1)];
  const summary =
    withUrl.length > 0 && !hasThisWeek
      ? "📸 Te toca la foto de esta semana"
      : withUrl.length > 0
        ? `${withUrl.length} ${withUrl.length === 1 ? "foto" : "fotos"}`
        : "Sin fotos todavía";

  return (
    <CollapsibleCard icon="🖼️" title="Fotos de progreso" summary={summary}>
      {/* Dos entradas, no una: `capture` manda al celular directo a la cámara,
          así que con un solo input no había manera de subir una foto ya sacada.
          El atributo es fijo por input, por eso van separados. */}
      <div className="-mt-1 flex items-center justify-end gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground active:scale-95 ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Images size={15} strokeWidth={2} aria-hidden />
          Galería
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target)}
          />
        </label>
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground active:scale-95 ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Camera size={15} strokeWidth={2} aria-hidden />
          {uploading ? "Subiendo…" : "Cámara"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target)}
          />
        </label>
      </div>

      {error && <p className="text-xs text-accent">{error}</p>}

      {/* Recordatorio semanal (solo si ya arrancaste y falta la de esta semana) */}
      {withUrl.length > 0 && !hasThisWeek && (
        <p className="rounded-card border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm text-accent">
          📸 Te toca la foto de la semana. Sumá una para seguir la comparación.
        </p>
      )}

      {withUrl.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          Subí fotos cada tanto para comparar tu antes y después.
        </p>
      ) : (
        <>
          {/* Time-lapse: recorré toda tu evolución con el slider o dale play */}
          {withUrl.length >= 2 && current && (
            <div className="flex flex-col gap-2 rounded-control bg-sunken p-4">
              <div className="relative aspect-3/4 w-full overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt={`Progreso ${shortDate(current.date)}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                  {weekLabel(current.date)} · {shortDate(current.date)}
                </span>
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white tabular-nums">
                  {idx + 1}/{withUrl.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pausar" : "Reproducir evolución"}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
                >
                  {playing ? (
                    <Pause size={18} aria-hidden />
                  ) : (
                    <Play size={18} aria-hidden />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={withUrl.length - 1}
                  value={Math.min(idx, withUrl.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setIdx(Number(e.target.value));
                  }}
                  className="w-full accent-primary"
                  aria-label="Recorrer fotos en el tiempo"
                />
              </div>
            </div>
          )}

          {/* Galería con etiqueta de semana */}
          <div className="grid grid-cols-3 gap-2">
            {withUrl.map((p, i) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-card"
              >
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setIdx(i);
                  }}
                  className="absolute inset-0"
                  aria-label={`Ver ${weekLabel(p.date)} (${shortDate(p.date)})`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Foto ${shortDate(p.date)}`}
                    className="h-full w-full object-cover"
                  />
                </button>
                <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
                  {weekLabel(p.date)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(p.id, p.path)}
                  className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white transition-transform duration-(--duration-fast) active:scale-90"
                  aria-label="Eliminar foto"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </CollapsibleCard>
  );
}
