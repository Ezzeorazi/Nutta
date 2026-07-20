"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  // callback estable para no reiniciar la cámara en cada render
  const cbRef = useRef(onDetected);
  cbRef.current = onDetected;

  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (!videoRef.current || cancelled) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            if (result && !doneRef.current) {
              doneRef.current = true;
              controls?.stop();
              cbRef.current(result.getText());
            }
          },
        );
      } catch {
        if (!cancelled)
          setError(
            "No se pudo acceder a la cámara. Ingresá el código a mano.",
          );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="font-semibold">Escanear código</span>
        <button onClick={onClose} aria-label="Cerrar" className="text-2xl">
          ×
        </button>
      </div>

      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {/* Marco guía */}
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-72 rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.4)]" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
            {error}
          </div>
        )}
      </div>

      {/* Fallback: ingreso manual del código */}
      <form
        className="flex gap-2 bg-black p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.trim();
          if (/^\d{6,14}$/.test(code)) onDetected(code);
        }}
      >
        <input
          inputMode="numeric"
          placeholder="O ingresá el código (EAN)"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
