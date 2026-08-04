import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

/**
 * Lee una captura de pantalla del reloj y saca los números.
 *
 * Es la única vía viable para un reloj Xiaomi desde una PWA: Xiaomi no publica
 * API, la de Strava pasó a ser paga en junio de 2026 (y ni siquiera recibe
 * pasos ni sueño), y Health Connect es nativa de Android. Sacarle una foto a
 * la pantalla del reloj sí cubre todo, gratis.
 *
 * OJO con el modelo: Groq dejó de ofrecer los Llama 4 y hoy el único de su
 * catálogo que acepta imágenes es `qwen/qwen3.6-27b` (verificado contra
 * /v1/models y probando el resto, que rechaza el formato multimodal). Si algún
 * día lo saca también, esto deja de funcionar y hay que revisar la lista.
 *
 * Como además es un modelo de razonamiento, se le pide que esconda su cadena de
 * pensamiento y no razone: sin eso antepone un bloque `<think>` y el JSON queda
 * enterrado. Por las dudas igual se parsea tolerante (ver `parseLoose`), y por
 * eso tampoco se usa `generateObject`.
 */
export const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

export type WatchReading = {
  /** Qué pantalla era: el detalle de una actividad o el resumen del día. */
  kind: "entrenamiento" | "resumen" | "nada";
  exercise?: {
    name: string;
    minutes: number;
    caloriesBurned: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    trainingEffect?: number;
  };
  metrics?: {
    steps?: number;
    sleepHours?: number;
  };
};

const PROMPT = `Leés capturas de pantalla de relojes y smartbands (Xiaomi Mi Fitness, Amazfit, Garmin, Apple Watch).

Respondé SOLO con un JSON válido, sin explicaciones ni bloques de código, con esta forma exacta:
{"kind":"entrenamiento","name":"","minutes":0,"calories":0,"avgHr":0,"maxHr":0,"effect":0,"steps":0,"sleepHours":0}

Reglas:
- "kind" es "entrenamiento" si la imagen muestra UNA actividad (correr, bici, natación, cinta…); "resumen" si muestra el día (pasos, sueño, calorías totales); "nada" si no es la pantalla de un reloj.
- Poné 0 (o "" en name) en todo lo que NO aparezca en la imagen. No inventes ni estimes nada.
- "name": el nombre de la actividad tal como figura, en español (ej. "Correr", "Cinta", "Bici").
- "minutes": duración en minutos enteros (1 h 05 min → 65).
- "calories": calorías de ESA actividad si es un entrenamiento, o del día si es un resumen.
- "avgHr" y "maxHr": pulsaciones por minuto, promedio y máxima.
- "effect": el "efecto del entrenamiento" de 0 a 5, si aparece.
- "steps": pasos, sin separador de miles.
- "sleepHours": sueño en horas decimales (7 h 30 min → 7.5).`;

/** Rescata el JSON aunque el modelo lo envuelva en razonamiento o en ```. */
function parseLoose(text: string): Record<string, unknown> | null {
  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json|```/gi, "");

  // Se busca el ÚLTIMO objeto balanceado, no del primer `{` al último `}`: si
  // el modelo dejó texto con llaves antes (razonando, o citando el formato
  // pedido), el que vale es el del final.
  const end = clean.lastIndexOf("}");
  if (end === -1) return null;
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    if (clean[i] === "}") depth++;
    else if (clean[i] === "{" && --depth === 0) {
      try {
        return JSON.parse(clean.slice(i, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Número positivo o `undefined` — el 0 del modelo significa "no estaba". */
const pos = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * @param image base64 crudo de la captura (sin el prefijo `data:`)
 * @param mediaType tipo MIME de la imagen
 */
export async function scanWatchScreen(
  image: string,
  mediaType: string,
): Promise<WatchReading> {
  const { text } = await generateText({
    model: groq(VISION_MODEL),
    temperature: 0, // es transcripción, no creatividad
    maxOutputTokens: 500,
    providerOptions: {
      groq: { reasoningFormat: "hidden", reasoningEffort: "none" },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image", image, mediaType },
        ],
      },
    ],
  });

  const raw = parseLoose(text);
  if (!raw) throw new Error(`respuesta no parseable: ${text.slice(0, 200)}`);

  const steps = pos(raw.steps);
  const sleepHours = pos(raw.sleepHours);
  const minutes = pos(raw.minutes);
  const kind = raw.kind === "entrenamiento" || raw.kind === "resumen" ? raw.kind : "nada";

  // El "kind" del modelo es una pista, no la verdad: manda lo que realmente
  // pudo leer. Una captura sin minutos no es un entrenamiento por más que lo diga.
  if (kind === "entrenamiento" && minutes) {
    return {
      kind,
      exercise: {
        name: String(raw.name ?? "").trim() || "Entrenamiento",
        minutes: Math.round(minutes),
        caloriesBurned: Math.round(pos(raw.calories) ?? 0),
        ...(pos(raw.avgHr) && { avgHeartRate: Math.round(Number(raw.avgHr)) }),
        ...(pos(raw.maxHr) && { maxHeartRate: Math.round(Number(raw.maxHr)) }),
        ...(pos(raw.effect) && {
          trainingEffect: Math.round(Number(raw.effect) * 10) / 10,
        }),
      },
    };
  }

  if (steps || sleepHours) {
    return {
      kind: "resumen",
      metrics: {
        ...(steps && { steps: Math.round(steps) }),
        ...(sleepHours && { sleepHours: Math.round(sleepHours * 10) / 10 }),
      },
    };
  }

  return { kind: "nada" };
}
