/**
 * El plan de Ezequiel de octubre 2026 (vuelta de vacaciones, más fuerte):
 * recomposición —bajar cintura sin perder la fuerza ganada—, 6 días de 60-75
 * min en Smartfit.
 *
 * Es data estática a propósito: no es una rutina que la app inventa según el
 * historial (esa ya existe en `lib/gym.ts`), es la que él decidió seguir. Vive
 * acá, separada, para poder cambiarla sin tocar lógica.
 *
 * Por qué así (PPL ondulado): cada músculo 2 veces por semana, una pesada (A,
 * 5-8 reps, para sostener la fuerza) y una de volumen (B, 8-15, la que hace
 * crecer). 16-19 series por sesión: con más no entra en 70 min con el cardio.
 *
 * Los pesos NO están escritos acá: salen de la última serie real de cada
 * ejercicio (`lastPerformance` en `lib/gym.ts`). Un número fijo queda viejo a
 * la segunda semana; el historial no.
 */

import type { Goals } from "@/lib/types";

/**
 * Metas nutricionales del plan (reemplazan a las calculadas del perfil).
 * 94 kg, mantenimiento estimado ~2.800 kcal entrenando 6 días: déficit de
 * ~350, chico a propósito para no comerse la fuerza. Proteína ~2 g/kg, grasa
 * ~0,8 g/kg y el resto carbos, concentrados alrededor del entreno.
 */
export const PLAN_GOALS: Goals = {
  calories: 2450,
  protein: 190,
  carbs: 250,
  fat: 75,
};

/**
 * Meta de peso del plan: solo siembra si no hay una propia. En recomposición
 * la balanza se mueve poco; la meta que manda es la cintura.
 */
export const PLAN_TARGET_WEIGHT = 90;

/** Cintura (cm) al arrancar y meta a 12 semanas (~0,5 cm por semana). */
export const PLAN_WAIST = { start: 104, target: 98 };

/** `weight`: solo una aclaración que el historial no dice ("o en Smith"). */
export type PlanExercise = { name: string; sets: string; weight?: string };

export type PlanDay = {
  dow: number; // 0 = domingo … 6 = sábado (Date.getDay())
  label: string;
  emoji: string;
  warning?: string;
  exercises: PlanExercise[];
  cardio?: string;
  rest?: boolean;
};

export const WEEKLY_PLAN: PlanDay[] = [
  {
    dow: 1,
    label: "Empuje A (fuerza)",
    emoji: "💪",
    exercises: [
      { name: "Press de Banca con Barra", sets: "4 × 5-7" },
      { name: "Press de Hombros con Mancuernas", sets: "3 × 6-8" },
      { name: "Press con mancuernas en banco inclinado", sets: "3 × 8-10" },
      { name: "Elevación lateral en polea", sets: "3 × 12-15" },
      { name: "Fondos en Máquina Asistida", sets: "3 × 8-10" },
    ],
    cardio: "10-15 min cinta suave",
  },
  {
    dow: 2,
    label: "Tirón A (fuerza)",
    emoji: "🔙",
    exercises: [
      { name: "Dominadas Asistidas", sets: "4 × 5-8" },
      { name: "Remo con Barra Inclinado", sets: "4 × 6-8" },
      { name: "Remo en Polea Sentado en Agarre Ancho", sets: "3 × 8-10" },
      { name: "Face Pull en Polea", sets: "3 × 12-15" },
      { name: "Curl con barra", sets: "3 × 6-8" },
    ],
    cardio: "10-15 min escaladora",
  },
  {
    dow: 3,
    label: "Pierna A (cuádriceps, fuerza)",
    emoji: "🦵",
    exercises: [
      { name: "Sentadilla Trasera con Barra", sets: "4 × 5-7", weight: "o en Smith" },
      { name: "Peso muerto rumano en Smith", sets: "3 × 6-8" },
      { name: "Prensa de Piernas", sets: "3 × 8-10" },
      { name: "Curl de Piernas Sentado", sets: "3 × 8-10" },
      { name: "Elevación de Talones de Pie", sets: "3 × 8-12" },
      { name: "Crunch con Cable", sets: "3 × 10-12" },
    ],
    cardio: "10 min caminata inclinada",
  },
  {
    dow: 4,
    label: "Empuje B (volumen)",
    emoji: "🎽",
    exercises: [
      { name: "Press Inclinado en Máquina Smith", sets: "3 × 8-10" },
      { name: "Press de Banca con Mancuernas", sets: "3 × 10-12" },
      { name: "Pec Deck", sets: "3 × 12-15" },
      { name: "Elevación lateral con mancuerna sentado", sets: "4 × 12-20" },
      { name: "Extensión de Tríceps por Encima de la Cabeza", sets: "3 × 10-15", weight: "en polea" },
      { name: "Extensión de Tríceps en Polea con Barra en V", sets: "2 × 12-15" },
    ],
    cardio: "10-15 min cinta",
  },
  {
    dow: 5,
    label: "Tirón B (volumen)",
    emoji: "🔙",
    exercises: [
      { name: "Jalón al Pecho", sets: "3 × 8-12" },
      { name: "Remo con Mancuerna a Un Brazo", sets: "3 × 10-12" },
      { name: "Jalón con Brazos Rectos", sets: "3 × 12-15" },
      { name: "Apertura de Deltoides Posterior", sets: "3 × 15-20", weight: "pec deck invertido" },
      { name: "Curl con mancuernas en banco inclinado", sets: "3 × 10-12" },
      { name: "Curl de Martillo con Mancuernas", sets: "2 × 12-15" },
    ],
    cardio: "10-15 min escaladora",
  },
  {
    dow: 6,
    label: "Pierna B (posterior y glúteo)",
    emoji: "🦵",
    exercises: [
      { name: "Hip thrust con barra", sets: "4 × 8-12" },
      { name: "Sentadilla Búlgara en Máquina Smith", sets: "3 × 8-10 por pierna" },
      { name: "Curl de Piernas Tumbado", sets: "3 × 10-12" },
      { name: "Extensión de Piernas", sets: "3 × 12-15" },
      { name: "Elevación de Talones Sentado", sets: "3 × 12-20" },
      { name: "Plancha", sets: "3 × 45-60 s" },
    ],
    cardio: "15-20 min caminata inclinada o bici",
  },
  {
    dow: 0,
    label: "Descanso",
    emoji: "🧘",
    rest: true,
    exercises: [],
    cardio: "Caminata 40 min + movilidad. Nada de gimnasio ni calistenia: el músculo crece cuando descansa.",
  },
];

/** El nombre del entrenamiento sin la coletilla entre paréntesis: "Tirón A". */
export const shortPlanLabel = (d: PlanDay) => d.label.replace(/\s*\(.*\)$/, "");

/** Abreviatura del día de la semana de un `dow` (0 = domingo). */
export const DOW_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** El día del plan que corresponde a una fecha YYYY-MM-DD. */
export function getPlanDay(iso: string): PlanDay {
  const dow = new Date(`${iso}T00:00:00`).getDay();
  return WEEKLY_PLAN.find((d) => d.dow === dow) ?? WEEKLY_PLAN[6];
}

/**
 * Cómo se reparte el día. Sin gramos fijos a propósito: las comidas concretas
 * las arma la IA con lo que él come de verdad ("Ideas de comida" en Hoy).
 * Entrena entre el desayuno y el almuerzo; se levanta 8:30-9 y se acuesta a 00.
 */
export const PLAN_MEALS: { time: string; text: string }[] = [
  { time: "9:00 · Desayuno", text: "Proteína + carbos, lo que te sostiene el entreno (~40 g P)." },
  { time: "10:30-12 · Entreno", text: "Si desayunaste hace más de 2 h, una banana antes." },
  { time: "13:00 · Almuerzo", text: "La comida más grande y la de más carbos: es la post-entreno (~50 g P)." },
  { time: "17:00 · Merienda", text: "Liviana y con proteína: yogur, batido o huevos (~35 g P)." },
  { time: "21:00 · Cena", text: "Proteína + verduras, carbos moderados (~50 g P). Cortá a las 22." },
];

export const PLAN_RULES: string[] = [
  "Semana 1 de calibración: buscá tu peso en cada ejercicio nuevo, que la última serie quede a 1-2 reps del fallo. Desde ahí la app te sugiere el peso con tu historial.",
  "Doble progresión: cuando hacés el tope del rango en TODAS las series, la próxima subí el peso (2,5 kg en barra, 1-2 kg en mancuerna) y volvé al piso del rango.",
  "Proteína primero: 190 g en 4 tomas de 40-50 g. Si llegás, el resto se acomoda.",
  "La cintura manda, no la balanza: en recomposición el peso puede quedarse quieto mientras la panza baja.",
  "El domingo es descanso de verdad. La calistenia de golpe te dejó roto: si la querés sumar, liviana y entre semana.",
  "Dormí 7,5-8 h: entrenando 6 días, el sueño es lo que más pesa en la recuperación.",
];

export const PLAN_CHECKPOINTS: { freq: string; text: string }[] = [
  { freq: "Cada semana", text: "Peso en ayunas 3 mañanas y promediá + cintura a la altura del ombligo. Si la cintura no bajó en 2 semanas, restá 150 kcal." },
  { freq: "Si la fuerza cae", text: "2 sesiones seguidas peor en los básicos = mucho déficit o poco sueño. Sumá 150 kcal de carbos antes de tocar otra cosa." },
  { freq: "2 de noviembre", text: "Revisión del mes: brazo, muslo, pecho, cintura + foto. Ahí elegimos qué músculos priorizar." },
];
