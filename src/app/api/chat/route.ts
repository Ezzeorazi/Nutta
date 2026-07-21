import { NextResponse } from "next/server";
import { interpretMessage } from "@/lib/coach";
import { enrichExercises, enrichStrength } from "@/lib/coachEnrich";

export const maxDuration = 30;

/** Interpreta un mensaje en lenguaje natural → registros de comida/ejercicio. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: {
    message?: unknown;
    weight?: unknown;
    hour?: unknown;
    memories?: unknown;
    frequent?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const message = String(body?.message ?? "")
    .trim()
    .slice(0, 1000);
  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }
  const weight = Number(body?.weight) || 70;
  const hour = Number.isFinite(Number(body?.hour))
    ? Number(body?.hour)
    : new Date().getHours();

  // Contexto de memoria (saneado y acotado).
  const memories = Array.isArray(body?.memories)
    ? (body.memories as unknown[])
        .filter(
          (m): m is { kind: string; text: string } =>
            !!m && typeof m === "object" && "text" in m && "kind" in m,
        )
        .map((m) => ({ kind: String(m.kind), text: String(m.text) }))
        .slice(0, 40)
    : [];
  const frequent = String(body?.frequent ?? "").slice(0, 500);

  try {
    const result = await interpretMessage({
      message,
      weight,
      hour,
      memories,
      frequent,
    });

    // Post-proceso determinístico con el dataset de ejercicios (RepDB):
    // nombres canónicos + calorías por MET real. No toca la comida ni la IA.
    const enriched = {
      ...result,
      exercises: enrichExercises(result.exercises ?? [], weight),
      strength: enrichStrength(result.strength ?? []),
    };
    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { error: "No pude procesar el mensaje. Probá de nuevo." },
      { status: 502 },
    );
  }
}
