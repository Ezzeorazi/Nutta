"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDismissable } from "@/lib/useDismissable";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  // callback estable para no reiniciar la cámara en cada render
  const cbRef = useRef(onDetected);
  useEffect(() => {
    cbRef.current = onDetected;
  }, [onDetected]);

  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  // El botón atrás del teléfono vuelve al formulario en vez de salir de la app.
  // Siempre activo: este componente solo existe mientras el escáner está abierto.
  useDismissable(true, onClose);

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

  // El escáner se abre DESDE el sheet de comida. vaul le aplica un `transform`
  // al contenido del sheet, y un `position: fixed` dentro de un ancestro
  // transformado se posiciona respecto de ese ancestro, no de la ventana: sin
  // portal, la cámara quedaría encerrada dentro del sheet.
  //
  // `document` no existe durante el render del servidor. El escáner solo
  // aparece tras un toque, así que en la práctica nunca llega ahí, pero el
  // guard hace que eso no dependa de dónde se lo monte.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <span className="font-semibold">Escanear código</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mr-1 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-transform active:scale-90"
        >
          <X size={20} strokeWidth={2.25} aria-hidden />
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
          className="min-h-11 flex-1 rounded-control border border-white/20 bg-white/10 px-3.5 text-base text-white outline-none placeholder:text-white/50"
        />
        <button
          type="submit"
          className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.97]"
        >
          Buscar
        </button>
      </form>
    </div>,
    document.body,
  );
}
