import { NextResponse } from "next/server";
import { analyzeWeek } from "@/lib/coach";

export const maxDuration = 30;

/** Análisis semanal del coach a partir de un resumen de datos. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: { summary?: unknown; memories?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const summary = String(body?.summary ?? "").slice(0, 2000);
  if (!summary.trim()) {
    return NextResponse.json({ error: "Sin datos" }, { status: 400 });
  }
  const memories = Array.isArray(body?.memories)
    ? (body.memories as unknown[])
        .filter(
          (m): m is { kind: string; text: string } =>
            !!m && typeof m === "object" && "text" in m && "kind" in m,
        )
        .map((m) => ({ kind: String(m.kind), text: String(m.text) }))
        .slice(0, 40)
    : [];

  try {
    const analysis = await analyzeWeek({ summary, memories });
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[/api/coach]", err);
    return NextResponse.json(
      { error: "No pude generar el análisis. Probá de nuevo." },
      { status: 502 },
    );
  }
}
