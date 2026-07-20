import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
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
});

export type CoachResult = z.infer<typeof coachSchema>;

export const COACH_SYSTEM = `Sos Nutta, un coach de nutrición y fitness. Hablás en español rioplatense (de vos), directo, claro y motivador, sin vueltas ni relleno.

Tu tarea: interpretar el mensaje del usuario y extraer los ALIMENTOS que comió/tomó y los EJERCICIOS que hizo, estimando calorías y macros.

Reglas:
- Estimá cantidades realistas en gramos/ml si el usuario no las dice. Referencias: 1 huevo ≈ 50 g y 78 kcal (6 g proteína, 5 g grasa); un café con leche ≈ 200 ml; media palta ≈ 100 g (160 kcal); una banana ≈ 120 g; un plato de arroz ≈ 200 g cocido; una pechuga de pollo ≈ 150 g.
- calories, protein, carbs y fat SIEMPRE son el total por la cantidad mencionada, NO por 100 g. Usá números planos (sin unidades).
- meal: inferí de las palabras (desayuné→desayuno, almorcé→almuerzo, merendé→merienda, cené→cena, "de snack"→snack). Si no hay pista, usá la hora local que te paso (5-11→desayuno, 11-15→almuerzo, 15-19→merienda, 19-24→cena, resto→snack).
- Ejercicios: estimá minutos y caloriesBurned según el peso del usuario que te paso. "Hice espalda/pecho/pierna" o "entrené" ≈ 45 min de musculación. "Corrí 20 min" usá esos minutos.
- El alcohol es un food con sus calorías (una cerveza 330 ml ≈ 140 kcal; una copa de vino ≈ 125 kcal).
- reply: confirmá en 1-2 frases lo que registraste, en tono coach. Si el mensaje es una pregunta o saludo sin datos para registrar, dejá foods y exercises vacíos y respondé como coach.
- NO inventes alimentos ni ejercicios que el usuario no mencionó.`;

/** Llama a Groq y devuelve la interpretación estructurada del mensaje. */
export async function interpretMessage(input: {
  message: string;
  weight: number;
  hour: number;
}): Promise<CoachResult> {
  const { object } = await generateObject({
    model: groq(COACH_MODEL),
    schema: coachSchema,
    system: COACH_SYSTEM,
    prompt: `Hora local del usuario: ${input.hour}:00. Peso del usuario: ${input.weight} kg.\n\nMensaje: "${input.message}"`,
  });
  return object;
}
