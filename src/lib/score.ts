import {
  INTENSITY_PHRASE,
  clamp,
  rate,
  type AthleteState,
  type EnergyLevel,
} from "@/lib/athlete";
import { STEPS_GOAL, type FoodEntry } from "@/lib/types";

/** Bebidas alcohólicas (penalizan el score). */
const ALCOHOL =
  /cerveza|birra|vino|fernet|whisky|whiskey|vodka|\bgin\b|trago|alcohol|champ[aá]n|licor|aperol|c[au]ipi|daiquiri|margarita|ron\b|tequila/i;

export type ScorePart = {
  label: string;
  emoji: string;
  points: number;
  max: number;
  /** Por qué sacó esos puntos. Siempre presente: el número solo no enseña nada. */
  detail: string;
  /** `false` cuando no hay dato: no suma pero tampoco resta. */
  logged: boolean;
};

export type DailyScore = {
  score: number; // 0-100
  label: string;
  /** Una frase que explica de dónde sale el número. */
  summary: string;
  parts: ScorePart[];
  tips: string[];
};

function label(score: number): string {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Muy bien";
  if (score >= 50) return "Bien";
  if (score >= 30) return "Flojo";
  return "A arrancar";
}

/**
 * Score diario 0-100.
 *
 * Reparto: entrenamiento 30, proteína 25, sueño 20, agua 10, pasos 10 y
 * calorías 5. Las calorías pesan poco a propósito: llegar a la meta calórica
 * comiendo cualquier cosa y sin entrenar no es un buen día, y el score no
 * debería decir que sí. El entrenamiento cuenta TANTO la fuerza como el cardio
 * (antes solo miraba el cardio: una sesión entera de gym daba cero).
 *
 * Lo que no se registró se excluye del reparto en vez de puntuar cero: no
 * cargar el sueño no es dormir mal. Cada factor explica por qué sacó lo que
 * sacó, y eso también se le muestra al usuario.
 */
/**
 * Puntos de calorías por nivel de balance. Antes era un `closeness()` simétrico
 * y quedarse 900 kcal abajo costaba lo mismo que pasarse 900: para alguien en
 * déficit buscado, el desvío hacia abajo dentro de la banda ES el objetivo.
 * Un día abierto no se juzga: puntúa completo hasta que cierra.
 */
const CALORIE_POINTS: Record<EnergyLevel, number> = {
  "sin-registro": 0,
  "en-curso": 5,
  adecuado: 5,
  "deficit-alto": 4,
  "deficit-excesivo": 2,
  exceso: 3,
  "exceso-alto": 1,
};

export function dailyScore(
  state: AthleteState,
  foodsOfDay: FoodEntry[],
): DailyScore {
  const { training, nutrition, energy, status } = state;
  const goals = nutrition.goals;
  const consumed = nutrition.consumed;
  const hasAlcohol = foodsOfDay.some((f) => ALCOHOL.test(f.name));

  const row = (key: string) => status.find((s) => s.key === key)!;
  const sleep = row("sueno");
  const water = row("agua");
  const steps = row("pasos");

  const parts: ScorePart[] = [
    {
      label: "Entrenamiento",
      emoji: "🏋️",
      max: 30,
      logged: true,
      points: Math.round(30 * row("entrenamiento").ratio),
      detail: training.rest
        ? "Día de descanso: cuenta como cumplido, es parte del plan."
        : training.kind === "ligera"
          ? `Actividad ligera · ${training.cardioMinutes} min: suma movimiento, no entrenamiento.`
          : training.trained
            ? `${INTENSITY_PHRASE[training.intensity]}${
                training.volume > 0
                  ? ` · ${training.sets} series · ${Math.round(training.volume).toLocaleString("es-AR")} kg`
                  : ` · ${training.cardioMinutes} min`
              }.`
            : "No registraste entrenamiento (ni fuerza ni cardio).",
    },
    {
      label: "Proteína",
      emoji: "🥩",
      max: 25,
      logged: true,
      points: Math.round(
        25 * clamp(consumed.protein / (goals.protein || 1), 0, 1),
      ),
      detail: `${consumed.protein} de ${goals.protein} g${
        nutrition.remaining.protein > 0
          ? ` · faltan ${Math.round(nutrition.remaining.protein)} g`
          : " · meta cumplida"
      }.`,
    },
    {
      label: "Sueño",
      emoji: "😴",
      max: 20,
      logged: sleep.logged,
      points: sleep.logged ? Math.round(20 * sleep.ratio) : 0,
      detail: sleep.logged
        ? `${sleep.value} · ${rate(sleep.ratio).toLowerCase()} (ideal 7-9 h).`
        : "Sin registrar: no suma ni resta.",
    },
    {
      label: "Agua",
      emoji: "💧",
      max: 10,
      logged: water.logged,
      points: water.logged ? Math.round(10 * water.ratio) : 0,
      detail: water.logged
        ? `${water.value}.`
        : "Sin registrar: no suma ni resta.",
    },
    {
      label: "Pasos",
      emoji: "👣",
      max: 10,
      logged: steps.logged,
      points: steps.logged ? Math.round(10 * steps.ratio) : 0,
      detail: steps.logged
        ? `${steps.value} de ${STEPS_GOAL.toLocaleString("es-AR")}.`
        : "Sin registrar: no suma ni resta.",
    },
    {
      label: "Calorías",
      emoji: energy.emoji,
      max: 5,
      // Netas (consumidas − quemadas), igual que el anillo de arriba.
      logged: energy.level !== "sin-registro",
      points: CALORIE_POINTS[energy.level],
      detail: `${energy.label} · ${energy.detail}${
        nutrition.carbDelta !== 0 ? " (meta ajustada a tu entrenamiento)" : ""
      }.`,
    },
  ];

  // Solo entran al reparto los factores con dato: no cargar el agua no puede
  // costar 10 puntos, o el score castigaría no registrar en vez de no hacer.
  const counted = parts.filter((p) => p.logged);
  const totalMax = counted.reduce((s, p) => s + p.max, 0) || 1;
  const base = (counted.reduce((s, p) => s + p.points, 0) / totalMax) * 100;
  const alcPen = hasAlcohol ? 15 : 0;
  const score = clamp(Math.round(base - alcPen), 0, 100);

  if (alcPen) {
    parts.push({
      label: "Alcohol",
      emoji: "🍺",
      points: -alcPen,
      max: 0,
      logged: true,
      detail: "Registraste alcohol: −15 puntos.",
    });
  }

  // La explicación: qué lo sostuvo y qué lo hundió.
  const rated = counted
    .filter((p) => p.max >= 10)
    .map((p) => ({ ...p, ratio: p.points / p.max }));
  const best = [...rated].sort((a, b) => b.ratio - a.ratio)[0];
  const worst = [...rated].sort((a, b) => a.ratio - b.ratio)[0];
  const omitted = parts.filter((p) => !p.logged).map((p) => p.label);
  const summary =
    best && worst && best.label !== worst.label
      ? `${best.label} te sube el score y ${worst.label.toLowerCase()} te lo baja.`
      : best
        ? `${best.label} es lo que más pesa hoy.`
        : "Registrá tu día para calcular el score.";

  const tips: string[] = [];
  if (score >= 85) tips.push("Gran día, seguí así 💪");
  if (nutrition.remaining.protein > goals.protein * 0.2) {
    tips.push(
      `Te falta proteína: sumá ~${Math.round(nutrition.remaining.protein)} g.`,
    );
  }
  if (training.kind === "sin-registro") {
    tips.push("Hoy no registraste entrenamiento.");
  } else if (training.kind === "ligera") {
    tips.push("Solo actividad ligera: suma, pero no reemplaza una sesión.");
  }
  // El consejo calórico depende del lado del desvío Y de si el día cerró: a
  // media tarde "te falta" no es un problema, es un día sin terminar.
  if (energy.level === "exceso-alto") {
    tips.push("Te pasaste bastante de calorías; ojo con las porciones.");
  } else if (energy.level === "deficit-excesivo") {
    tips.push(
      `Cerraste ${Math.abs(Math.round(energy.delta))} kcal por debajo: sostenido, un déficit así te cuesta músculo.`,
    );
  } else if (energy.level === "deficit-alto" && training.trained) {
    tips.push("Déficit alto para un día que entrenaste: mañana comé un poco más.");
  }
  if (sleep.logged && sleep.ratio < 0.7) {
    tips.push(`Dormiste poco (${sleep.value}); apuntá a 7-8.`);
  }
  if (water.logged && water.ratio < 0.6) {
    tips.push("Tomá más agua para llegar a tu meta.");
  }
  if (steps.logged && steps.ratio < 0.6) {
    tips.push("Te faltó movimiento fuera del gym: sumá una caminata.");
  }
  if (omitted.length) {
    tips.push(
      `${omitted.join(", ")} sin registrar: no cuentan en el score de hoy.`,
    );
  }
  if (hasAlcohol) tips.push("El alcohol sumó calorías y bajó tu score.");

  return { score, label: label(score), summary, parts, tips };
}
