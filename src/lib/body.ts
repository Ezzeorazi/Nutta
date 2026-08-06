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

/**
 * Cuánto respaldo tiene la conclusión. Existe porque la tarjeta declaraba "el
 * mejor escenario posible" a partir de DOS mediciones tomadas con 14 días de
 * diferencia — y medio centímetro de brazo entre dos tomas suele ser la cinta
 * puesta distinto, no músculo.
 */
export type Confidence = "alta" | "media" | "baja";

export type BodyReadout = {
  verdict: BodyVerdict;
  confidence: Confidence;
  tone: Tone;
  emoji: string;
  headline: string;
  detail: string;
  /** Los cambios que sostienen la conclusión (solo los que superan el ruido). */
  deltas: BodyDelta[];
  /** Qué se comparó de verdad, para el pie de la tarjeta. */
  basis: string;
};

type Point = { date: string; value: number };

/** Cómo se calculó un cambio, además de cuánto fue. */
type SeriesDelta = {
  value: number;
  /** `ventanas` = promedio contra promedio; `puntas` = primera vs. última. */
  mode: "ventanas" | "puntas";
  /** Mediciones que respaldan el número. */
  points: number;
  /** Días entre la primera y la última medición usadas. */
  spanDays: number;
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Cambio de una serie: promedio de la ventana reciente contra el promedio de
 * la ventana anterior. Se promedia (y no se toman dos puntos sueltos) porque el
 * peso oscila un kilo entre la mañana y la noche, y un solo dato malo daría
 * vuelta la conclusión.
 *
 * Cuando no hay dos ventanas se compara punta a punta, pero eso se INFORMA
 * (`mode`) en vez de hacerlo pasar por lo mismo: son dos cosas muy distintas.
 */
function windowDelta(
  points: Point[],
  today: string,
  window: number,
): SeriesDelta | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = dayDiff(last.date, first.date);

  const inWindow = (p: Point, from: number, to: number) => {
    const d = dayDiff(today, p.date);
    return d >= from && d < to;
  };
  const recent = points.filter((p) => inWindow(p, 0, window));
  const before = points.filter((p) => inWindow(p, window, window * 2));
  if (recent.length && before.length) {
    return {
      value: avg(recent.map((p) => p.value)) - avg(before.map((p) => p.value)),
      mode: "ventanas",
      points: recent.length + before.length,
      spanDays,
    };
  }
  // Punta a punta, pero solo con al menos una semana de distancia: comparar
  // dos días seguidos no dice nada.
  if (spanDays < 7) return null;
  return {
    value: last.value - first.value,
    mode: "puntas",
    points: points.length,
    spanDays,
  };
}

const partMeta = (part: BodyPart) =>
  MEASURE_PARTS.find((p) => p.key === part)!;

const fmt = (d: number, unit: "kg" | "cm") =>
  `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} ${unit}`;

/** Cuánto respaldo tienen los números que se van a interpretar. */
function confidenceOf(all: SeriesDelta[]): Confidence {
  const byWindows = all.some((d) => d.mode === "ventanas");
  const points = Math.max(...all.map((d) => d.points));
  const span = Math.max(...all.map((d) => d.spanDays));
  if (byWindows) return points >= 4 ? "alta" : "media";
  if (points >= 4 && span >= 21) return "media";
  return "baja";
}

/** Qué se comparó realmente. Antes el pie decía siempre "las 3 semanas
 *  anteriores", incluso cuando la comparación había sido punta a punta. */
function basisOf(all: SeriesDelta[], window: number): string {
  if (all.some((d) => d.mode === "ventanas")) {
    return `Comparado con las ${Math.round(window / 7)} semanas anteriores.`;
  }
  const span = Math.max(...all.map((d) => d.spanDays));
  const points = Math.min(...all.map((d) => d.points));
  return `Comparado con tu primer registro, hace ${span} días (${
    points <= 2 ? "solo 2 mediciones" : `${points} mediciones`
  }).`;
}

/** Lo que se puede afirmar, según lo que se puede sostener. */
function withConfidence(
  base: {
    verdict: BodyVerdict;
    tone: Tone;
    emoji: string;
    headline: string;
    detail: string;
    advice: string;
  },
  confidence: Confidence,
  basis: string,
  deltas: BodyDelta[],
): BodyReadout {
  const common = { verdict: base.verdict, emoji: base.emoji, confidence, basis, deltas };
  // "Estable" no afirma nada, así que no hace falta atenuarlo.
  if (confidence === "baja" && base.verdict !== "estable") {
    return {
      ...common,
      // El verde de "todo bien" se guarda para cuando esté confirmado.
      tone: base.tone === "good" ? "info" : base.tone,
      headline: `Señal preliminar: ${base.headline[0].toLowerCase()}${base.headline.slice(1)}`,
      detail: `${base.detail} Esto sale de pocas mediciones: medio centímetro de brazo o muslo entre dos tomas suele ser la cinta puesta distinto, no músculo. Seguí midiendo un par de semanas antes de darlo por hecho.`,
    };
  }
  return {
    ...common,
    tone: base.tone,
    headline: base.headline,
    detail:
      confidence === "media"
        ? `${base.detail} ${base.advice} Con un par de semanas más de registro te lo confirmo.`
        : `${base.detail} ${base.advice}`,
  };
}

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

  const measureDeltas = new Map<BodyPart, SeriesDelta>();
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
      confidence: "baja",
      tone: "info",
      emoji: "📏",
      headline: "Todavía no puedo leer tu composición corporal",
      detail:
        "Registrá peso y medidas (cintura, brazo, muslo…) un par de semanas y te digo si lo que cambia es músculo o grasa.",
      deltas: [],
      basis: "",
    };
  }

  const series = [
    ...(weightDelta ? [weightDelta] : []),
    ...measureDeltas.values(),
  ];
  const confidence = confidenceOf(series);
  const basis = basisOf(series, window);

  const valueOf = (p: BodyPart) => measureDeltas.get(p)?.value ?? 0;

  // Deltas visibles: solo los que superan el ruido de medición.
  const deltas: BodyDelta[] = [];
  if (weightDelta != null && Math.abs(weightDelta.value) >= NOISE_KG) {
    deltas.push({
      key: "peso",
      label: "Peso",
      emoji: "⚖️",
      delta: weightDelta.value,
      unit: "kg",
    });
  }
  for (const [part, d] of measureDeltas) {
    if (Math.abs(d.value) < NOISE_CM) continue;
    const meta = partMeta(part);
    deltas.push({
      key: part,
      label: meta.label,
      emoji: meta.emoji,
      delta: d.value,
      unit: "cm",
    });
  }

  const waist = measureDeltas.has("cintura") ? valueOf("cintura") : null;
  const muscleUp = MUSCLE_PARTS.filter((p) => valueOf(p) >= NOISE_CM);
  const muscleDown = MUSCLE_PARTS.filter((p) => valueOf(p) <= -NOISE_CM);
  const kg = weightDelta?.value ?? 0;

  const resumen = deltas
    .map((d) => `${d.label} ${fmt(d.delta, d.unit)}`)
    .join(" · ");
  const musculos = muscleUp.map((p) => partMeta(p).label.toLowerCase());
  const listar = (xs: string[]) =>
    xs.length <= 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`;

  // Lo que bajó también se cuenta. Antes el veredicto miraba solo lo que crecía
  // y se salteaba el dato que no encajaba: la grilla mostraba "Pecho −1.0 cm"
  // en naranja y el texto hablaba únicamente de los músculos que subieron.
  const caida = muscleDown.length
    ? ` Ojo: ${muscleDown
        .map((p) => `${partMeta(p).label.toLowerCase()} ${fmt(valueOf(p), "cm")}`)
        .join(", ")}.`
    : "";

  const done = (base: {
    verdict: BodyVerdict;
    tone: Tone;
    emoji: string;
    headline: string;
    detail: string;
    advice: string;
  }) => withConfidence(base, confidence, basis, deltas);

  // 1. Recomposición: la cintura baja y algún músculo crece. Es lo mejor que
  //    puede pasar, y es justo lo que la balanza sola no muestra.
  if (waist != null && waist <= -NOISE_CM && muscleUp.length > 0) {
    return done({
      verdict: "recomposicion",
      tone: "good",
      emoji: "🔥",
      headline: "Estás recomponiendo tu cuerpo",
      detail: `${listar(musculos)} ${muscleUp.length === 1 ? "creció" : "crecieron"} mientras la cintura bajó${
        kg > NOISE_KG
          ? `, y eso pasó aun subiendo ${kg.toFixed(1)} kg en la balanza: ese peso es músculo, no grasa`
          : ""
      }.${caida}`,
      advice: "Es el mejor escenario posible: seguí igual.",
    });
  }

  // 2. Ganancia de músculo: sube el peso, la cintura no acompaña.
  if (kg >= NOISE_KG && (waist == null || waist <= NOISE_CM) && muscleUp.length > 0) {
    return done({
      verdict: "musculo",
      tone: "good",
      emoji: "💪",
      headline: "Estás ganando masa muscular",
      detail: `Subiste ${kg.toFixed(1)} kg y ${listar(musculos)} ${
        muscleUp.length === 1 ? "creció" : "crecieron"
      }, con la cintura estable.${caida}`,
      advice: "Ese peso está yendo al músculo.",
    });
  }

  // 3. Definición: baja el peso y baja la cintura, sin perder músculo.
  if (kg <= -NOISE_KG && muscleDown.length === 0) {
    return done({
      verdict: "definicion",
      tone: "good",
      emoji: "✂️",
      headline: "Estás perdiendo grasa sin perder músculo",
      detail: `Bajaste ${Math.abs(kg).toFixed(1)} kg${
        waist != null && waist <= -NOISE_CM
          ? ` y ${Math.abs(waist).toFixed(1)} cm de cintura`
          : ""
      } manteniendo tus medidas.`,
      advice: "Sostené la proteína alta para que siga así.",
    });
  }

  // 4. Peso y cintura suben juntos: recién acá se puede hablar de grasa, y aun
  //    así con una acción concreta, no con un reto.
  if (kg >= NOISE_KG && waist != null && waist >= NOISE_CM && muscleUp.length === 0) {
    return done({
      verdict: "grasa",
      tone: "warn",
      emoji: "📈",
      headline: "El peso está subiendo con la cintura",
      detail: `${resumen}. Cuando suben las dos juntas y las medidas de músculo no se mueven, conviene ajustar.`,
      advice:
        "Bajá un poco las calorías de los días sin entrenar y sostené la proteína.",
    });
  }

  return done({
    verdict: "estable",
    tone: "info",
    emoji: "➖",
    headline: "Tu composición está estable",
    detail: deltas.length
      ? `${resumen}.${caida}`
      : "No hay cambios significativos todavía.",
    advice: deltas.length
      ? "Son cambios chicos: dales unas semanas más antes de tocar nada."
      : "Seguí registrando peso y medidas para ver la tendencia.",
  });
}
