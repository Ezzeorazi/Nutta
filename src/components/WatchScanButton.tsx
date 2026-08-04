"use client";

import { useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { downscaleImage } from "@/lib/image";
import type { WatchReading } from "@/lib/watchScan";

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Elige una captura del reloj y la manda a leer a la IA.
 *
 * Es la única vía para sacarle los datos a un reloj Xiaomi sin tipearlos (ver
 * watchScan.ts). Quien la usa siempre ve el resultado en el formulario antes
 * de guardarlo — la IA completa, no registra sola.
 */
export default function WatchScanButton({
  label = "Escanear captura del reloj",
  onRead,
}: {
  label?: string;
  onRead: (reading: WatchReading) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const scan = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const image = await toDataUrl(await downscaleImage(file));
      const res = await fetch("/api/watch/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "No pude leer la captura.");
        return;
      }
      if (data.kind === "nada") {
        toast("No encontré datos del reloj en esa imagen.");
        return;
      }
      onRead(data as WatchReading);
    } catch {
      toast("No pude leer la captura.");
    } finally {
      setBusy(false);
      // Se limpia para poder volver a elegir el MISMO archivo (si no, el
      // input no dispara change y parece que el botón no anda).
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => scan(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <ScanLine size={13} aria-hidden />
        {busy ? "Leyendo…" : label}
      </Button>
    </>
  );
}
