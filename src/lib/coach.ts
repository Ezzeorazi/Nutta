import { groq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";
import { z } from "zod";

/**
 * Modelo de Groq (gratis). Se puede override con GROQ_MODEL.
 * IMPORTANTE: debe soportar `response_format: json_schema` para generateObject.
 * Los Llama de Groq NO lo soportan; los `openai/gpt-oss-*` sí.
 */
export const COACH_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

/**
 * Estructura que la IA debe devolver: una respuesta de coach + los registros
 * de comida y ejercicio extraídos del mensaje en lenguaje natural.
 */
export const coachSchema = z.object({
  reply: z
    .string()
    .describe(
      "Respuesta breve (1-2 frases) del coach en español rioplatense, confirmando lo registrado o respondiendo la consulta.",
    ),
  foods: z
    .array(
      z.object({
        name: z.string().describe("Nombre del alimento o bebida"),
        meal: z.enum(["desayuno", "almuerzo", "merienda", "cena", "snack"]),
        qty: z.number().describe("Cantidad total en gramos (o ml)"),
        calories: z.number().describe("Calorías totales por esa cantidad"),
        protein: z.number().describe("Proteínas en gramos, total"),
        carbs: z.number().describe("Carbohidratos en gramos, total"),
        fat: z.number().describe("Grasas en gramos, total"),
      }),
    )
    .describe("Alimentos y bebidas que el usuario consumió. Vacío si no hay."),
  exercises: z
    .array(
      z.object({
        name: z.string().describe("Nombre de la actividad"),
        minutes: z.number().describe("Duración estimada en minutos"),
        caloriesBurned: z.number().describe("Calorías quemadas estimadas"),
      }),
    )
    .describe("Ejercicios que el usuario hizo. Vacío si no hay."),
  bodyweight: z
    .number()
    .describe(
      "Peso corporal en kg SOLO si el usuario dice cuánto pesa (ej. 'me pesé 80', 'peso 79.5 kg'). 0 si no lo menciona.",
    ),
  water: z
    .number()
    .describe(
      "Litros de agua que tomó SOLO si lo menciona (ej. 'tomé 2 litros'→2, '3 vasos'→0.75, 'un vaso de agua'→0.25). 0 si no.",
    ),
  sleepHours: z
    .number()
    .describe(
      "Horas que durmió SOLO si lo menciona (ej. 'dormí 7 horas'→7, 'dormí mal 5hs'→5). 0 si no.",
    ),
  steps: z
    .number()
    .describe(
      "Cantidad de pasos SOLO si menciona un número de pasos (ej. 'caminé 8000 pasos'→8000). 0 si no. (Caminar X minutos NO es esto, es un ejercicio.)",
    ),
  strength: z
    .array(
      z.object({
        exercise: z.string().describe("Nombre del ejercicio de fuerza"),
        sets: z.number().describe("Cantidad de series"),
        reps: z.number().describe("Repeticiones por serie"),
        weight: z.number().describe("Peso en kg (0 si es peso corporal)"),
      }),
    )
    .describe(
      "Ejercicios de FUERZA con series/reps/peso SOLO si los menciona (ej. 'press banca 4x8 con 60'→sets 4, reps 8, weight 60). Vacío si no.",
    ),
  remember: z
    .array(
      z.object({
        kind: z.enum([
          "habito",
          "alimento",
          "suplemento",
          "lesion",
          "objetivo",
          "rutina",
          "nota",
        ]),
        text: z.string().describe("El hecho a recordar, breve y en 3ª persona"),
      }),
    )
    .describe(
      "Hechos NUEVOS y duraderos del usuario para recordar. Vacío si no hay nada nuevo.",
    ),
});

export type CoachResult = z.infer<typeof coachSchema>;

export const COACH_SYSTEM = `Sos Nutta, un coach de nutrición y fitness. Hablás en español rioplatense (de vos), directo, claro y motivador, sin vueltas ni relleno.

Tu tarea: interpretar el mensaje del usuario y extraer los ALIMENTOS que comió/tomó y los EJERCICIOS que hizo, estimando calorías y macros.

Reglas:
- Estimá cantidades realistas en gramos/ml si el usuario no las dice. Referencias: 1 huevo ≈ 50 g y 78 kcal (6 g proteína, 5 g grasa); un café con leche ≈ 200 ml; media palta ≈ 100 g (160 kcal); una banana ≈ 120 g; un plato de arroz ≈ 200 g cocido; una pechuga de pollo ≈ 150 g.
- calories, protein, carbs y fat SIEMPRE son el total por la cantidad mencionada, NO por 100 g. Usá números planos (sin unidades).
- meal: inferí de las palabras (desayuné→desayuno, almorcé→almuerzo, merendé→merienda, cené→cena, "de snack"→snack). Si no hay pista, usá la hora local que te paso (5-11→desayuno, 11-15→almuerzo, 15-19→merienda, 19-24→cena, resto→snack).
- Ejercicios (exercises = cardio/gasto calórico): estimá minutos y caloriesBurned según el peso del usuario que te paso. "Corrí 20 min" usá esos minutos. "Hice espalda/pecho/pierna" o "entrené" genérico ≈ 45 min de musculación.
- strength (fuerza estructurada): si menciona un ejercicio con SERIES/REPS/PESO (ej. "press banca 4x8 con 60", "sentadilla 3 series de 10 a 80 kg"), cargalo en strength (sets, reps, weight) y NO lo dupliques en exercises. "4x8" = sets 4, reps 8.
- El alcohol es un food con sus calorías (una cerveza 330 ml ≈ 140 kcal; una copa de vino ≈ 125 kcal).
- bodyweight: poné un número SOLO si el usuario dice su peso EN EL MENSAJE (ej. "me pesé 80", "peso 79.5"). NUNCA copies el "Peso de referencia" que te paso en el contexto: ese es solo para calcular calorías de ejercicio, no es algo que el usuario haya dicho. Si el mensaje no menciona el peso, poné 0.
- water, sleepHours, steps: completá cada uno SOLO si el usuario lo menciona explícitamente en el mensaje; si no, poné 0. Un vaso de agua ≈ 0.25 L. "Caminé 20 minutos" es un exercise, NO steps.
- reply: confirmá en 1-2 frases lo que registraste, en tono coach. Si el mensaje es una pregunta o saludo sin datos para registrar, dejá foods y exercises vacíos y respondé como coach.
- NO inventes alimentos ni ejercicios que el usuario no mencionó.

MEMORIA:
- Te paso la MEMORIA del usuario y sus ALIMENTOS FRECUENTES. Si dice "lo de siempre", "lo habitual", "mi desayuno de siempre", etc., resolvé qué alimentos son usando esa memoria/frecuentes y registralos concretos.
- En "remember" guardá SOLO hechos nuevos y duraderos (un hábito estable, un objetivo, una lesión, un suplemento que toma seguido, su rutina semanal, o cuando diga "de ahora en más..." / "siempre..."). NO guardes lo que pasó un solo día, ni algo que ya esté en la MEMORIA. Si no hay nada nuevo, dejá remember vacío.`;

/** Llama a Groq y devuelve la interpretación estructurada del mensaje. */
export async function interpretMessage(input: {
  message: string;
  weight: number;
  hour: number;
  memories?: { kind: string; text: string }[];
  frequent?: string;
}): Promise<CoachResult> {
  const mem =
    input.memories && input.memories.length
      ? input.memories.map((m) => `- [${m.kind}] ${m.text}`).join("\n")
      : "(sin datos aún)";
  const freq = input.frequent?.trim() || "(sin datos aún)";

  const { object } = await generateObject({
    model: groq(COACH_MODEL),
    schema: coachSchema,
    system: COACH_SYSTEM,
    prompt: `Hora local del usuario: ${input.hour}:00. Peso de referencia para calcular calorías de ejercicio (NO es bodyweight, no lo copies): ${input.weight} kg.

MEMORIA DEL USUARIO:
${mem}

ALIMENTOS FRECUENTES POR COMIDA (histórico):
${freq}

Mensaje: "${input.message}"`,
  });
  return object;
}

export const COACH_ANALYSIS_SYSTEM = `Sos Nutta, entrenador personal. Analizás los datos reales de la semana del usuario y le hablás DIRECTO, como un coach de verdad: sin rodeos, concreto y motivador pero honesto. Español rioplatense (de vos), 4-6 frases como máximo.

Estructura: 1) destacá lo que hizo bien, 2) marcá sin vueltas lo que está fallando, 3) cerrá con 1-2 acciones claras para la semana que viene. NO inventes datos que no estén en el resumen. Nada de listas largas ni palabrería de ChatGPT.`;

/** Análisis semanal en tono entrenador, a partir del resumen de datos. */
export async function analyzeWeek(input: {
  summary: string;
  memories?: { kind: string; text: string }[];
}): Promise<string> {
  const mem =
    input.memories && input.memories.length
      ? input.memories.map((m) => `- [${m.kind}] ${m.text}`).join("\n")
      : "(sin datos)";

  const { text } = await generateText({
    model: groq(COACH_MODEL),
    system: COACH_ANALYSIS_SYSTEM,
    prompt: `Datos de la última semana:\n${input.summary}\n\nMEMORIA DEL USUARIO:\n${mem}\n\nDale tu análisis de coach y las recomendaciones.`,
  });
  return text.trim();
}
