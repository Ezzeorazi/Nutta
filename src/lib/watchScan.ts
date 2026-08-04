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
    /** Día que mostraba la captura (YYYY-MM-DD). Puede no ser hoy. */
    date?: string;
    /** Hora de inicio "HH:MM", si la captura la mostraba. */
    time?: string;
  };
  metrics?: {
    steps?: number;
    sleepHours?: number;
    date?: string;
  };
};

const PROMPT = `Leés capturas de pantalla de relojes y smartbands (Xiaomi Mi Fitness, Amazfit, Garmin, Apple Watch).

Respondé SOLO con un JSON válido, sin explicaciones ni bloques de código, con esta forma exacta:
{"kind":"entrenamiento","name":"","duration":"","date":"","time":"","calories":0,"avgHr":0,"maxHr":0,"effect":0,"steps":0,"sleepHours":0}

Reglas:
- "kind" es "entrenamiento" si la imagen muestra UNA actividad (correr, bici, natación, cinta…); "resumen" si muestra el día (pasos, sueño, calorías totales); "nada" si no es la pantalla de un reloj.
- Poné "" o 0 en todo lo que NO aparezca en la imagen. No inventes ni estimes nada.
- "name": el nombre de la actividad tal como figura, en español (ej. "Correr", "Cinta", "Bici").
- "duration": la duración COPIADA TAL CUAL de la pantalla, sin convertir nada. Si dice "01:48:26" escribí "01:48:26"; si dice "45 min" escribí "45 min". NO calcules minutos: de eso me encargo yo.
- "date": la fecha del entrenamiento en formato AAAA-MM-DD. En pantalla suele estar como día/mes/año: "2/8/2026" es el 2 de AGOSTO de 2026 → "2026-08-02".
- "time": la hora de inicio como "HH:MM" (de "2/8/2026, 14:07" sacás "14:07").
- "calories": calorías de ESA actividad si es un entrenamiento, o del día si es un resumen. Si hay varias cifras de calorías, usá la más destacada (la grande), no el total.
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
 * Minutos a partir de la duración tal cual la muestra el reloj.
 *
 * La cuenta se hace acá y no en el prompt porque los modelos transcriben bien
 * pero calculan mal: con "01:48:26" en pantalla devolvían 48 minutos en vez de
 * 108, y el error pasaba desapercibido porque 48 es un número plausible.
 */
export function minutesFrom(raw: unknown): number | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;

  // Formato reloj: HH:MM:SS o MM:SS.
  const clock = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (clock) {
    const [, a, b, c] = clock;
    const mins = c
      ? Number(a) * 60 + Number(b) + Number(c) / 60
      : Number(a) + Number(b) / 60;
    return mins > 0 ? Math.round(mins) : undefined;
  }

  // Formato con letras: "1 h 48 min", "48 min", "1h".
  const h = /(\d+)\s*h/i.exec(s);
  const m = /(\d+)\s*m/i.exec(s);
  const mins = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  if (mins > 0) return mins;

  // Último recurso: un número suelto son minutos.
  return pos(Number(s));
}

/**
 * Fecha de la captura (YYYY-MM-DD), descartando lo imposible: si sale una
 * fecha futura es que se leyó mal (el clásico es día y mes cambiados), y ahí
 * es preferible caer en el día que el usuario está mirando.
 */
export function dateFrom(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const parsed = new Date(`${s}T12:00:00Z`).getTime();
  if (!Number.isFinite(parsed)) return undefined;
  // Un día de margen: el server corre en UTC y el reloj está en otro huso.
  if (parsed > Date.now() + 86_400_000) return undefined;
  if (parsed < Date.now() - 5 * 365 * 86_400_000) return undefined;
  return s;
}

/** Hora de inicio "HH:MM" si es válida. */
const timeFrom = (raw: unknown): string | undefined => {
  const s = String(raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
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
  const minutes = minutesFrom(raw.duration) ?? pos(raw.minutes);
  const date = dateFrom(raw.date);
  const time = timeFrom(raw.time);
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
        ...(date && { date }),
        ...(time && { time }),
      },
    };
  }

  if (steps || sleepHours) {
    return {
      kind: "resumen",
      metrics: {
        ...(steps && { steps: Math.round(steps) }),
        ...(sleepHours && { sleepHours: Math.round(sleepHours * 10) / 10 }),
        ...(date && { date }),
      },
    };
  }

  return { kind: "nada" };
}
