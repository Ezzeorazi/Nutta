/**
 * El plan de Ezequiel de agosto 2026: metas, rutina semanal fija y plantillas
 * de comida, tal como salió del análisis de sus registros (20/7-8/8).
 *
 * Es data estática a propósito: no es una rutina que la app inventa según el
 * historial (esa ya existe en `lib/gym.ts`), es la que él decidió seguir este
 * mes. Vive acá, separada, para poder cambiarla mes a mes sin tocar lógica.
 */

import type { Goals } from "@/lib/types";

/** Metas nutricionales del plan (reemplazan a las calculadas del perfil). */
export const PLAN_GOALS: Goals = {
  calories: 2350,
  protein: 190,
  carbs: 240,
  fat: 72,
};

/** Meta de peso del plan (10-12 semanas desde el 8/8). */
export const PLAN_TARGET_WEIGHT = 92;

export type PlanExercise = { name: string; sets: string; weight: string };

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
    label: "Empuje A (pecho enfocado)",
    emoji: "💪",
    exercises: [
      { name: "Press en banco inclinado con barra", sets: "4 × 6-8", weight: "45 kg" },
      { name: "Press con mancuernas plano", sets: "3 × 8-10", weight: "20 kg c/u" },
      { name: "Press de pecho con cable (medio)", sets: "3 × 10-12", weight: "8 kg" },
      { name: "Pec Deck", sets: "3 × 12-15", weight: "45 kg" },
      { name: "Elevación lateral en polea", sets: "3 × 12-15", weight: "12-17 kg" },
      { name: "Fondos en máquina asistida", sets: "3 × 8-10", weight: "40 kg asistencia" },
      { name: "Extensión de tríceps con cable a una mano", sets: "3 × 12", weight: "4,5 kg" },
    ],
    cardio: "15 min cinta trote suave",
  },
  {
    dow: 2,
    label: "Tirón A (espalda gruesa)",
    emoji: "🔙",
    exercises: [
      { name: "Remo con barra inclinado", sets: "4 × 6-8", weight: "35 kg" },
      { name: "Jalón al pecho", sets: "4 × 8-10", weight: "50 kg" },
      { name: "Remo en polea sentado agarre ancho", sets: "3 × 10-12", weight: "39-45 kg" },
      { name: "Remo con mancuernas con apoyo en el pecho", sets: "3 × 10-12", weight: "10 kg c/u" },
      { name: "Face pull con TRX", sets: "3 × 12-15", weight: "peso corporal" },
      { name: "Curl con barra", sets: "3 × 8-10", weight: "20 kg" },
      { name: "Curl con mancuernas en banco inclinado", sets: "3 × 10-12", weight: "12-14 kg" },
    ],
    cardio: "12 min escaladora",
  },
  {
    dow: 3,
    label: "Pierna A (cuádriceps enfocado)",
    emoji: "🦵",
    warning: "Tu día más flojo — no lo saltees.",
    exercises: [
      { name: "Sentadilla en máquina Smith", sets: "4 × 8-10", weight: "60 kg" },
      { name: "Sentadilla búlgara en Smith", sets: "3 × 8 por pierna", weight: "40 kg" },
      { name: "Curl de piernas sentado", sets: "4 × 10-12", weight: "45 kg" },
      { name: "Abducción de cadera en máquina", sets: "3 × 12-15", weight: "57 kg" },
      { name: "Aductor en máquina", sets: "3 × 12-15", weight: "50 kg" },
      { name: "Pantorrillas de pie", sets: "4 × 12-15", weight: "desde 20 kg" },
      { name: "Crunch con cable", sets: "3 × 12-15", weight: "36-50 kg" },
    ],
    cardio: "20 min caminata inclinada",
  },
  {
    dow: 4,
    label: "Empuje B (hombro enfocado)",
    emoji: "🎽",
    exercises: [
      { name: "Press Arnold", sets: "4 × 8-10", weight: "12 kg c/u" },
      { name: "Press de banca con barra", sets: "4 × 6-8", weight: "45 kg" },
      { name: "Press con mancuernas en banco inclinado", sets: "3 × 8-10", weight: "18 kg c/u" },
      { name: "Elevación lateral con mancuerna sentado", sets: "4 × 12-15", weight: "9 kg" },
      { name: "Elevación de deltoides posterior en banco inclinado", sets: "3 × 15", weight: "8-9 kg" },
      { name: "Jalón de tríceps con cable tras nuca", sets: "3 × 10-12", weight: "12 kg" },
    ],
    cardio: "15 min cinta",
  },
  {
    dow: 5,
    label: "Tirón B (espalda ancha)",
    emoji: "🔙",
    exercises: [
      { name: "Dominadas asistidas", sets: "4 × 6-8", weight: "30 kg asistencia" },
      { name: "Jalón al pecho con agarre ancho", sets: "3 × 10-12", weight: "45-52 kg" },
      { name: "Remo sentado en máquina a un brazo", sets: "3 × 10 por lado", weight: "20 kg" },
      { name: "Jalón con brazos rectos", sets: "3 × 12-15", weight: "19 kg" },
      { name: "Extensión de espalda", sets: "3 × 12-15", weight: "10 kg" },
      { name: "Curl predicador con mancuerna", sets: "3 × 8-10", weight: "8-10 kg" },
      { name: "Curl en banco Scott", sets: "3 × 10-12", weight: "20 kg" },
    ],
    cardio: "12 min escaladora",
  },
  {
    dow: 6,
    label: "Pierna B (posterior) + cardio largo",
    emoji: "🦵",
    exercises: [
      { name: "Peso muerto rumano en Smith", sets: "4 × 8-10", weight: "50 kg" },
      { name: "Hip thrust con barra", sets: "4 × 10-12", weight: "40 kg" },
      { name: "Sentadilla trasera con barra", sets: "3 × 8", weight: "50 kg" },
      { name: "Puente de glúteos / abducción en máquina", sets: "3 × 15", weight: "50-57 kg" },
      { name: "Pantorrillas sentado", sets: "4 × 15", weight: "20 kg" },
      { name: "Oblicuos con cable + plancha", sets: "3 × 12 / 3 × 45 s", weight: "12 kg" },
    ],
    cardio: "35-40 min: natación o trote suave",
  },
  {
    dow: 0,
    label: "Descanso",
    emoji: "🧘",
    rest: true,
    exercises: [],
    cardio: "Caminata 40 min + estiramiento. Nada de gimnasio.",
  },
];

/** El día del plan que corresponde a una fecha YYYY-MM-DD. */
export function getPlanDay(iso: string): PlanDay {
  const dow = new Date(`${iso}T00:00:00`).getDay();
  return WEEKLY_PLAN.find((d) => d.dow === dow) ?? WEEKLY_PLAN[6];
}

export type DietMeal = { time: string; desc: string; kcal: number; protein: number };
export type DietTemplate = {
  id: string;
  label: string;
  summary: string;
  meals: DietMeal[];
};

export const DIET_TEMPLATES: DietTemplate[] = [
  {
    id: "A",
    label: "Plantilla A — día de entrenamiento fuerte",
    summary: "~2.350 kcal · 195 P / 240 C / 70 G",
    meals: [
      { time: "09:00 · Desayuno", desc: "3 huevos (150 g) + 2 tostadas integrales (60 g) + 60 g de palta + café solo", kcal: 500, protein: 27 },
      { time: "12:30 · Almuerzo", desc: "200 g de pechuga de pollo + 200 g de arroz cocido + 150 g de verduras salteadas + 1 cda de aceite de oliva", kcal: 640, protein: 55 },
      { time: "16:00 · Pre-entreno", desc: "1 banana + 30 g de granola + 200 g de yogur griego natural", kcal: 400, protein: 20 },
      { time: "18:30 · Post-entreno", desc: "Batido: 40 g de proteína en polvo + 250 ml de leche descremada", kcal: 250, protein: 42 },
      { time: "21:00 · Cena", desc: "200 g de carne magra o pescado + 250 g de papa/batata + ensalada grande", kcal: 560, protein: 50 },
    ],
  },
  {
    id: "B",
    label: "Plantilla B — día liviano o de descanso",
    summary: "~2.050 kcal · 185 P / 180 C / 65 G",
    meals: [
      { time: "09:00", desc: "3 huevos + 1 tostada + 30 g de queso + café solo", kcal: 440, protein: 30 },
      { time: "13:00", desc: "220 g de pollo + 150 g de arroz o legumbres + brócoli/zapallito abundante", kcal: 570, protein: 60 },
      { time: "17:00", desc: "200 g de yogur griego + 20 g de granola + puñado de nueces (15 g)", kcal: 340, protein: 22 },
      { time: "21:00", desc: "220 g de pescado o carne magra + 200 g de papa + ensalada con aceite", kcal: 600, protein: 55 },
      { time: "Extra si falta proteína", desc: "1 batido de 30 g de proteína", kcal: 140, protein: 25 },
    ],
  },
  {
    id: "C",
    label: "Plantilla C — día apurado / afuera",
    summary: "~2.300 kcal · 180 P / 230 C / 80 G",
    meals: [
      { time: "Mañana", desc: "Batido de proteína con banana y leche + 2 tostadas con palta", kcal: 600, protein: 40 },
      { time: "Mediodía", desc: "Lo que haya afuera: proteína del tamaño de tu palma y media + verduras sí o sí. Si son empanadas, máximo 3 + ensalada.", kcal: 0, protein: 0 },
      { time: "Tarde", desc: "200 g de yogur + fruta", kcal: 250, protein: 18 },
      { time: "Noche", desc: "250 g de pollo/carne + guarnición de vegetales + 150 g de arroz o papa", kcal: 650, protein: 60 },
    ],
  },
];

export const PLAN_RULES: string[] = [
  "Proteína primero: si llegás a 190 g, el resto se acomoda casi solo (~4 tomas de 45-50 g).",
  "Cargá la comida cuando la comés, no a la noche. Sin datos reales no se puede ajustar nada.",
  "Cortá de comer 2 h antes de dormir.",
  "La granola es el alimento con peor relación calorías/saciedad: pesala o bajala a 25-30 g.",
  "Agua 3,5 L — ya lo venís cumpliendo, sostenelo.",
];

export const PLAN_CHECKPOINTS: { freq: string; text: string }[] = [
  { freq: "Cada semana", text: "Peso en ayunas 3 mañanas y promediá. Si no bajó en 2 semanas seguidas, restá 150 kcal." },
  { freq: "Cada 2 semanas", text: "Cintura: de 101 a 92 cm es la meta más ambiciosa, se mueve más lento que el peso." },
  { freq: "Cada 4 semanas", text: "Brazo, muslo, pantorrilla, pecho + foto de progreso." },
];
