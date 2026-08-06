/**
 * Lectura de la composición corporal: peso Y medidas, nunca el peso solo.
 *
 * La balanza sola miente. Si subís 1 kg pero bajás 1 cm de cintura y sumás 0,5
 * cm de brazo, no engordaste: estás recomponiendo. Antes la app solo miraba
 * `weights` y llamaba a eso progreso o retroceso; acá se cruzan las dos series
 * y se interpreta lo que pasó de verdad.
 *
 * Regla dura: NUNCA concluir que el usuario está peor solo porque subió de peso.
 */

import { dayDiff, type Tone } from "@/lib/athlete";
import {
  MEASURE_PARTS,
  type BodyPart,
  type MeasureEntry,
  type WeightEntry,
} from "@/lib/types";

/** Ruido de medición por debajo del cual un cambio no significa nada. */
const NOISE_KG = 0.4;
const NOISE_CM = 0.3;

/** Partes cuyo crecimiento se interpreta como músculo. La cintura va al revés. */
const MUSCLE_PARTS: BodyPart[] = ["brazo", "muslo", "pecho", "pantorrilla"];

export type BodyDelta = {
  key: "peso" | BodyPart;
  label: string;
  emoji: string;
  delta: number;
  unit: "kg" | "cm";
};

export type BodyVerdict =
  | "recomposicion"
  | "musculo"
  | "definicion"
  | "grasa"
  | "estable"
  | "sin-datos";

export type BodyReadout = {
  verdict: BodyVerdict;
  tone: Tone;
  emoji: string;
  headline: string;
  detail: string;
  /** Los cambios que sostienen la conclusión (solo los que superan el ruido). */
  deltas: BodyDelta[];
  /** Días que abarca la comparación. */
  windowDays: number;
};

type Point = { date: string; value: number };

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Cambio de una serie: promedio de la ventana reciente contra el promedio de
 * la ventana anterior. Se promedia (y no se toman dos puntos sueltos) porque el
 * peso oscila un kilo entre la mañana y la noche, y un solo dato malo daría
 * vuelta la conclusión.
 */
function windowDelta(
  points: Point[],
  today: string,
  window: number,
): number | null {
  if (points.length < 2) return null;
  const inWindow = (p: Point, from: number, to: number) => {
    const d = dayDiff(today, p.date);
    return d >= from && d < to;
  };
  const recent = points.filter((p) => inWindow(p, 0, window));
  const before = points.filter((p) => inWindow(p, window, window * 2));
  if (recent.length && before.length) {
    return avg(recent.map((p) => p.value)) - avg(before.map((p) => p.value));
  }
  // Sin dos ventanas completas se compara punta a punta, pero solo si hay al
  // menos una semana de distancia: comparar dos días seguidos no dice nada.
  const first = points[0];
  const last = points[points.length - 1];
  if (dayDiff(last.date, first.date) < 7) return null;
  return last.value - first.value;
}

const partMeta = (part: BodyPart) =>
  MEASURE_PARTS.find((p) => p.key === part)!;

const fmt = (d: number, unit: "kg" | "cm") =>
  `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} ${unit}`;

/** Interpreta peso + medidas de las últimas `window` semanas. */
export function readBody(
  weights: WeightEntry[],
  measures: MeasureEntry[],
  today: string,
  window = 21,
): BodyReadout {
  const weightPoints: Point[] = weights.map((w) => ({
    date: w.date,
    value: w.kg,
  }));
  const weightDelta = windowDelta(weightPoints, today, window);

  const measureDeltas = new Map<BodyPart, number>();
  for (const { key } of MEASURE_PARTS) {
    const pts: Point[] = measures
      .filter((m) => m.part === key)
      .map((m) => ({ date: m.date, value: m.cm }));
    const d = windowDelta(pts, today, window);
    if (d != null) measureDeltas.set(key, d);
  }

  if (weightDelta == null && measureDeltas.size === 0) {
    return {
      verdict: "sin-datos",
      tone: "info",
      emoji: "📏",
      headline: "Todavía no puedo leer tu composición corporal",
      detail:
        "Registrá peso y medidas (cintura, brazo, muslo…) un par de semanas y te digo si lo que cambia es músculo o grasa.",
      deltas: [],
      windowDays: window,
    };
  }

  // Deltas visibles: solo los que superan el ruido de medición.
  const deltas: BodyDelta[] = [];
  if (weightDelta != null && Math.abs(weightDelta) >= NOISE_KG) {
    deltas.push({
      key: "peso",
      label: "Peso",
      emoji: "⚖️",
      delta: weightDelta,
      unit: "kg",
    });
  }
  for (const [part, d] of measureDeltas) {
    if (Math.abs(d) < NOISE_CM) continue;
    const meta = partMeta(part);
    deltas.push({
      key: part,
      label: meta.label,
      emoji: meta.emoji,
      delta: d,
      unit: "cm",
    });
  }

  const waist = measureDeltas.get("cintura") ?? null;
  const muscleUp = MUSCLE_PARTS.filter(
    (p) => (measureDeltas.get(p) ?? 0) >= NOISE_CM,
  );
  const muscleDown = MUSCLE_PARTS.filter(
    (p) => (measureDeltas.get(p) ?? 0) <= -NOISE_CM,
  );
  const kg = weightDelta ?? 0;

  const resumen = deltas
    .map((d) => `${d.label} ${fmt(d.delta, d.unit)}`)
    .join(" · ");
  const musculos = muscleUp.map((p) => partMeta(p).label.toLowerCase());
  const listar = (xs: string[]) =>
    xs.length <= 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`;

  // 1. Recomposición: la cintura baja y algún músculo crece. Es lo mejor que
  //    puede pasar, y es justo lo que la balanza sola no muestra.
  if (waist != null && waist <= -NOISE_CM && muscleUp.length > 0) {
    return {
      verdict: "recomposicion",
      tone: "good",
      emoji: "🔥",
      headline: "Estás recomponiendo tu cuerpo",
      detail: `${listar(musculos)} ${muscleUp.length === 1 ? "creció" : "crecieron"} mientras la cintura bajó${
        kg > NOISE_KG
          ? `, y eso pasó aun subiendo ${kg.toFixed(1)} kg en la balanza: ese peso es músculo, no grasa`
          : ""
      }. Es el mejor escenario posible: seguí igual.`,
      deltas,
      windowDays: window,
    };
  }

  // 2. Ganancia de músculo: sube el peso, la cintura no acompaña.
  if (kg >= NOISE_KG && (waist == null || waist <= NOISE_CM) && muscleUp.length > 0) {
    return {
      verdict: "musculo",
      tone: "good",
      emoji: "💪",
      headline: "Estás ganando masa muscular",
      detail: `Subiste ${kg.toFixed(1)} kg y ${listar(musculos)} ${
        muscleUp.length === 1 ? "creció" : "crecieron"
      }, con la cintura estable. Ese peso está yendo al músculo.`,
      deltas,
      windowDays: window,
    };
  }

  // 3. Definición: baja el peso y baja la cintura, sin perder músculo.
  if (kg <= -NOISE_KG && muscleDown.length === 0) {
    return {
      verdict: "definicion",
      tone: "good",
      emoji: "✂️",
      headline: "Estás perdiendo grasa sin perder músculo",
      detail: `Bajaste ${Math.abs(kg).toFixed(1)} kg${
        waist != null && waist <= -NOISE_CM
          ? ` y ${Math.abs(waist).toFixed(1)} cm de cintura`
          : ""
      } manteniendo tus medidas. Sostené la proteína alta para que siga así.`,
      deltas,
      windowDays: window,
    };
  }

  // 4. Peso y cintura suben juntos: recién acá se puede hablar de grasa, y aun
  //    así con una acción concreta, no con un reto.
  if (kg >= NOISE_KG && waist != null && waist >= NOISE_CM && muscleUp.length === 0) {
    return {
      verdict: "grasa",
      tone: "warn",
      emoji: "📈",
      headline: "El peso está subiendo con la cintura",
      detail: `${resumen}. Cuando suben las dos juntas y las medidas de músculo no se mueven, conviene ajustar: bajá un poco las calorías de los días sin entrenar y sostené la proteína.`,
      deltas,
      windowDays: window,
    };
  }

  return {
    verdict: "estable",
    tone: "info",
    emoji: "➖",
    headline: "Tu composición está estable",
    detail: deltas.length
      ? `${resumen}. Son cambios chicos: dales unas semanas más antes de tocar nada.`
      : "No hay cambios significativos todavía. Seguí registrando peso y medidas para ver la tendencia.",
    deltas,
    windowDays: window,
  };
}
