"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { uid } from "@/lib/uid";
import type { ExerciseEntry } from "@/lib/types";

type Status = { configured: boolean; connected: boolean };

type Activity = {
  externalId: string;
  name: string;
  date: string;
  minutes: number;
  caloriesBurned: number;
  createdAt: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
};

/** Cómo salió el ida y vuelta del OAuth (llega como `?strava=…` en la URL). */
const RESULT: Record<string, string> = {
  ok: "Strava conectado 🎉 Ya podés traer los entrenamientos del reloj.",
  denied: "No le diste acceso a Strava.",
  state: "Se venció el pedido de conexión. Probá de nuevo.",
  scope: "Faltó el permiso para leer tus actividades.",
  nocfg: "Falta configurar las claves de Strava en el servidor.",
  error: "No pude conectar con Strava.",
};

const DAYS = 30;

const toEntry = (a: Activity): ExerciseEntry => ({
  id: uid(),
  date: a.date,
  name: a.name,
  minutes: a.minutes,
  caloriesBurned: a.caloriesBurned,
  createdAt: a.createdAt,
  source: "strava",
  externalId: a.externalId,
  ...(a.avgHeartRate != null && { avgHeartRate: a.avgHeartRate }),
  ...(a.maxHeartRate != null && { maxHeartRate: a.maxHeartRate }),
});

/**
 * Trae el cardio del reloj (Xiaomi y cía.) sin tipearlo.
 *
 * El reloj sincroniza con Mi Fitness, Mi Fitness empuja a Strava y de ahí lo
 * leemos: es el único puente público que expone Xiaomi. Solo llegan las
 * actividades que se arrancan a mano en el reloj — pasos y sueño no viajan por
 * este camino y se siguen cargando aparte.
 */
export default function StravaSync({
  onImport,
}: {
  onImport: (list: ExerciseEntry[]) => number;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/strava/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false }));
  }, []);

  // Aviso al volver de Strava. Se limpia el query para que recargar la app no
  // repita el mensaje.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("strava");
    if (!result) return;
    toast(RESULT[result] ?? RESULT.error);
    window.history.replaceState({}, "", window.location.pathname);
  }, [toast]);

  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/strava/activities?days=${DAYS}`);
      const data = await res.json();
      if (!res.ok) {
        // 401 = el vínculo se cortó del lado de Strava.
        if (res.status === 401) setStatus({ configured: true, connected: false });
        toast(data?.error ?? "No pude traer los entrenamientos.");
        return;
      }
      const added = onImport((data.activities as Activity[]).map(toEntry));
      toast(
        added === 0
          ? `Sin entrenamientos nuevos en los últimos ${DAYS} días.`
          : added === 1
            ? "Importé 1 entrenamiento del reloj."
            : `Importé ${added} entrenamientos del reloj.`,
      );
    } catch {
      toast("No pude traer los entrenamientos.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch("/api/strava/disconnect", { method: "POST" });
      setStatus({ configured: true, connected: false });
      toast("Strava desvinculado.");
    } catch {
      toast("No pude desvincular Strava.");
    } finally {
      setBusy(false);
    }
  };

  // Sin claves en el servidor la función no existe: mejor no mostrar nada que
  // ofrecer un botón que va a fallar.
  if (!status?.configured) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-border px-3 py-2">
      <span className="min-w-0 text-xs text-muted">
        {status.connected
          ? `Reloj vinculado · últimos ${DAYS} días`
          : "Traé el cardio del reloj sin tipearlo"}
      </span>

      {status.connected ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="secondary" onClick={sync} disabled={busy}>
            <RefreshCw
              size={13}
              className={busy ? "animate-spin" : ""}
              aria-hidden
            />
            {busy ? "Trayendo…" : "Sincronizar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy}>
            Desvincular
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => window.location.assign("/api/strava/connect")}
        >
          Conectar Strava
        </Button>
      )}
    </div>
  );
}
