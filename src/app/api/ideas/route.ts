import { NextResponse } from "next/server";
import { suggestMeals } from "@/lib/coach";

export const maxDuration = 30;

type Macros = { calories: number; protein: number; carbs: number; fat: number };

/** Normaliza un objeto de macros que viene del cliente (nunca negativos). */
function macros(v: unknown): Macros | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (k: string) => Math.max(0, Math.round(Number(o[k]) || 0));
  return { calories: n("calories"), protein: n("protein"), carbs: n("carbs"), fat: n("fat") };
}

/** Tres ideas de comida con IA para cerrar los macros que faltan hoy. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const target = macros(body.target);
  const remaining = macros(body.remaining);
  const meal = String(body.meal ?? "").slice(0, 40);
  if (!target || !remaining || !meal) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const memories = Array.isArray(body.memories)
    ? (body.memories as { kind?: unknown; text?: unknown }[])
        .slice(0, 40)
        .map((m) => ({ kind: String(m.kind ?? ""), text: String(m.text ?? "").slice(0, 200) }))
    : [];

  try {
    const ideas = await suggestMeals({
      meal,
      target,
      remaining,
      frequent: String(body.frequent ?? "").slice(0, 2000),
      memories,
    });
    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("[/api/ideas]", err);
    return NextResponse.json(
      { error: "No pude armar ideas ahora. Probá de nuevo." },
      { status: 502 },
    );
  }
}
