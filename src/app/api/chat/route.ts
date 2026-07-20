import { NextResponse } from "next/server";
import { interpretMessage } from "@/lib/coach";

export const maxDuration = 30;

/** Interpreta un mensaje en lenguaje natural → registros de comida/ejercicio. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: { message?: unknown; weight?: unknown; hour?: unknown };
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

  try {
    const result = await interpretMessage({ message, weight, hour });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { error: "No pude procesar el mensaje. Probá de nuevo." },
      { status: 502 },
    );
  }
}
