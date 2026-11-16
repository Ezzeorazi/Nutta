/**
 * El plan de Ezequiel de noviembre 2026: misma recomposición, mismos 6 días,
 * revisado con los datos de las 7 semanas que llevaba del plan de octubre.
 *
 * Es data estática a propósito: no es una rutina que la app inventa según el
 * historial (esa ya existe en `lib/gym.ts`), es la que él decidió seguir. Vive
 * acá, separada, para poder cambiarla sin tocar lógica.
 *
 * Por qué así (PPL ondulado): cada músculo 2 veces por semana, una pesada (A,
 * 5-8 reps, para sostener la fuerza) y una de volumen (B, 8-15, la que hace
 * crecer). 16-19 series por sesión: con más no entra en 70 min con el cardio.
 *
 * QUÉ CAMBIÓ Y POR QUÉ (637 series, 35 sesiones, 5 días/semana reales):
 *
 * - **Los rangos de reps se cerraron.** Era el problema de fondo: con "3 × 8-12"
 *   se quedaba en 10 reps para siempre, porque el tope quedaba lejos y el peso
 *   nunca subía. Rangos de 2-3 reps (8-10, 6-8) hacen que topear sea alcanzable
 *   y el aviso de subir carga salte cuando corresponde.
 * - **Los ejercicios son los que hace de verdad.** "Press Inclinado en Máquina
 *   Smith" era el único del plan que nunca cargó en 7 semanas: en su lugar hace
 *   press en banco inclinado con barra, así que ese entra. Sobre 28 ejercicios
 *   registrados fuera del plan, los que repite entraron al que corresponde.
 * - **Core de 3,7 a ~9 series por semana.** Era lo único claramente corto
 *   (piernas 24,6 y espalda 21,6 por semana contra 3,7 de core).
 * - **Lo del Smith con banco se queda el fin de semana.** Hip thrust y búlgara
 *   necesitan Smith Y banco a la vez, que entre semana no se consigue. El resto
 *   de la semana no depende del Smith (el peso muerto rumano no lleva banco).
 *
 * Lo que NO se tocó: el split de 6 días, porque funciona —cumplió 5 de 6 días
 * casi todas las semanas— y los básicos pesados suben solos (prensa +10 kg,
 * hip thrust +15, búlgara +20, sentadilla +10 en 7 semanas).
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
      { name: "Press de Banca con Barra", sets: "4 × 5-8" },
      { name: "Press con mancuernas en banco inclinado", sets: "3 × 8-10" },
      { name: "Press de Hombros con Mancuernas", sets: "3 × 8-10" },
      { name: "Fondos en Máquina Asistida", sets: "3 × 8-10" },
      { name: "Elevación lateral en polea", sets: "3 × 12-15" },
      { name: "Elevación de Piernas Colgado", sets: "3 × 10-15" },
    ],
    cardio: "10-15 min cinta suave",
  },
  {
    dow: 2,
    label: "Tirón A (fuerza)",
    emoji: "🔙",
    exercises: [
      { name: "Remo con Barra Inclinado", sets: "4 × 6-8" },
      { name: "Dominadas Asistidas", sets: "4 × 6-8" },
      { name: "Remo en Polea Sentado en Agarre Ancho", sets: "3 × 8-10" },
      { name: "Face Pull en Polea", sets: "3 × 12-15" },
      { name: "Curl con barra", sets: "3 × 8-10" },
    ],
    cardio: "10-15 min escaladora",
  },
  {
    dow: 3,
    label: "Pierna A (cuádriceps, fuerza)",
    emoji: "🦵",
    exercises: [
      { name: "Sentadilla Trasera con Barra", sets: "4 × 5-8", weight: "o en Smith" },
      { name: "Prensa de Piernas", sets: "3 × 8-10" },
      { name: "Peso muerto rumano en Smith", sets: "3 × 8-10" },
      { name: "Curl de Piernas Sentado", sets: "3 × 10-12" },
      { name: "Elevación de Talones de Pie", sets: "4 × 10-12" },
      { name: "Crunch con Cable", sets: "3 × 12-15" },
    ],
    cardio: "10 min caminata inclinada",
  },
  {
    dow: 4,
    label: "Empuje B (volumen)",
    emoji: "🎽",
    exercises: [
      { name: "Press en banco inclinado con barra", sets: "4 × 6-8" },
      { name: "Press de Banca con Mancuernas", sets: "3 × 8-10" },
      { name: "Pec Deck", sets: "3 × 10-12" },
      { name: "Elevación lateral con mancuerna sentado", sets: "4 × 10-12" },
      { name: "Extensión de Tríceps por Encima de la Cabeza", sets: "3 × 10-12", weight: "en polea" },
      { name: "Extensión de Tríceps en Polea con Barra en V", sets: "2 × 12-15" },
    ],
    cardio: "10-15 min cinta",
  },
  {
    dow: 5,
    label: "Tirón B (volumen)",
    emoji: "🔙",
    exercises: [
      { name: "Jalón al Pecho", sets: "3 × 8-10" },
      { name: "Remo con Mancuerna a Un Brazo", sets: "3 × 8-10" },
      { name: "Jalón con Brazos Rectos", sets: "3 × 12-15" },
      { name: "Apertura de Deltoides Posterior", sets: "3 × 12-15", weight: "pec deck invertido" },
      { name: "Curl con mancuernas en banco inclinado", sets: "3 × 8-10" },
      { name: "Curl de Martillo con Mancuernas", sets: "3 × 10-12" },
    ],
    cardio: "10-15 min escaladora",
  },
  {
    dow: 6,
    label: "Pierna B (posterior y glúteo)",
    emoji: "🦵",
    // El día del Smith con banco: hip thrust y búlgara necesitan las dos cosas
    // a la vez y entre semana el gimnasio no las da. Por eso van al finde, que
    // además es el día que más se corre (sábado o domingo, lo decide él con el
    // selector del Gym).
    exercises: [
      { name: "Hip thrust con barra", sets: "4 × 8-12" },
      { name: "Sentadilla Búlgara en Máquina Smith", sets: "3 × 6-8 por pierna" },
      { name: "Curl de Piernas Tumbado", sets: "3 × 10-12" },
      { name: "Extensión de Piernas", sets: "3 × 10-12" },
      { name: "Elevación de Pantorrillas en Máquina", sets: "3 × 12-15" },
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
    cardio:
      "Caminata 40 min + movilidad. Nada de gimnasio: el músculo crece cuando descansa. Si querés descansar otro día, movelo con «Entrenar otro día de la rutina» en el Gym.",
  },
];

/** El nombre del entrenamiento sin la coletilla entre paréntesis: "Tirón A". */
export const shortPlanLabel = (d: PlanDay) => d.label.replace(/\s*\(.*\)$/, "");

/** Abreviatura del día de la semana de un `dow` (0 = domingo). */
export const DOW_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * La semana como se lee: de lunes a domingo. `WEEKLY_PLAN` guarda el domingo
 * con `dow` 0, así que ordenar por el número crudo lo pondría primero.
 */
export const weekOrdered = (plan: PlanDay[] = WEEKLY_PLAN): PlanDay[] =>
  [...plan].sort((a, b) => ((a.dow + 6) % 7) - ((b.dow + 6) % 7));

/**
 * El día del plan que corresponde a una fecha YYYY-MM-DD. `plan` es la semana
 * vigente (con los días editados, ver `lib/routine.ts`); por defecto, la fija.
 */
export function getPlanDay(iso: string, plan: PlanDay[] = WEEKLY_PLAN): PlanDay {
  const dow = new Date(`${iso}T00:00:00`).getDay();
  return (
    plan.find((d) => d.dow === dow) ??
    WEEKLY_PLAN.find((d) => d.dow === dow) ??
    WEEKLY_PLAN[6]
  );
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
