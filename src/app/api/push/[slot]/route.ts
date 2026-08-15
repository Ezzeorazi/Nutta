import { NextResponse } from "next/server";
import { sendSlot } from "@/lib/pushServer";
import { SLOT_HOURS, type Slot } from "@/lib/reminders";

/** Enviar a varios dispositivos puede tardar; el default queda corto. */
export const maxDuration = 60;

const isSlot = (v: string): v is Slot => v in SLOT_HOURS;

/**
 * Dispara los avisos del plan. Lo llama el cron de Vercel (ver `vercel.json`):
 *
 *   GET /api/push/manana
 *   GET /api/push/noche
 *
 * La franja va en la ruta y no en la query porque el cron de Vercel solo
 * garantiza el `path`; con `?slot=` quedaría a merced de que no lo recorte.
 *
 * Va protegido con `CRON_SECRET`: sin eso cualquiera podría notificarte desde
 * afuera. Vercel manda ese header en las invocaciones del cron.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Los avisos no están configurados (falta CRON_SECRET)." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { slot } = await params;
  if (!isSlot(slot)) {
    return NextResponse.json(
      { error: `Franja inválida: usá ${Object.keys(SLOT_HOURS).join(" o ")}` },
      { status: 400 },
    );
  }

  try {
    const result = await sendSlot(slot);
    return NextResponse.json({ slot, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
