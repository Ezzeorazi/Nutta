import { NextResponse } from "next/server";
import { scanWatchScreen } from "@/lib/watchScan";

export const maxDuration = 30;

/** Tope del base64 recibido (~3 MB). El cliente ya redimensiona a 1280 px. */
const MAX_CHARS = 4_000_000;

/** Lee una captura de pantalla del reloj y devuelve los números que encontró. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: { image?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  // Llega como data URL: `data:image/jpeg;base64,…`
  const dataUrl = String(body?.image ?? "");
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ error: "Imagen inválida" }, { status: 400 });
  }
  const [, mediaType, base64] = match;
  if (base64.length > MAX_CHARS) {
    return NextResponse.json({ error: "La imagen pesa demasiado" }, { status: 413 });
  }

  try {
    return NextResponse.json(await scanWatchScreen(base64, mediaType));
  } catch (err) {
    console.error("[/api/watch/scan]", err);
    return NextResponse.json(
      { error: "No pude leer la captura. Probá con una más nítida." },
      { status: 502 },
    );
  }
}
