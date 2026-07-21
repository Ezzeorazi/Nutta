import { NextResponse } from "next/server";
import { estimateFood } from "@/lib/coach";
import type { FoodProduct } from "@/lib/off";

export const maxDuration = 30;

/** Estima con IA los macros (por 100 g/ml) de un alimento por su nombre. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const name = String(body?.name ?? "")
    .trim()
    .slice(0, 80);
  if (!name) {
    return NextResponse.json({ error: "Nombre vacío" }, { status: 400 });
  }

  try {
    const e = await estimateFood(name);
    const product: FoodProduct = {
      id: `ai:${name.toLowerCase()}`,
      name: e.name || name,
      brand: null,
      per100: {
        calories: Math.max(0, Math.round(e.calories)),
        protein: Math.max(0, Math.round(e.protein * 10) / 10),
        carbs: Math.max(0, Math.round(e.carbs * 10) / 10),
        fat: Math.max(0, Math.round(e.fat * 10) / 10),
      },
    };
    return NextResponse.json({ product });
  } catch (err) {
    console.error("[/api/foods/estimate]", err);
    return NextResponse.json(
      { error: "No pude estimar el alimento. Probá de nuevo." },
      { status: 502 },
    );
  }
}
