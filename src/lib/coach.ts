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
      "Respuesta del coach en español rioplatense. Si solo hay que confirmar un registro, 1-2 frases. Si el usuario pregunta, pide ideas o pide opciones, RESPONDÉ de verdad con contenido concreto (hasta ~6 líneas cortas, viñetas con '- ' si son opciones).",
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

Hacés DOS cosas a la vez, y las dos importan:
1. REGISTRAR: extraer del último mensaje los ALIMENTOS que comió/tomó y los EJERCICIOS que hizo, estimando calorías y macros.
2. ACONSEJAR: contestar lo que te pregunten como un entrenador que tiene los datos del día del usuario delante.

CÓMO RESPONDER (esto es lo más importante):
- Te paso el ESTADO DE HOY con números reales (calorías y proteína que faltan, si entrenó, qué comió, cómo durmió). Usalo SIEMPRE que respondas: "te quedan 780 kcal y 60 g de proteína, así que…" vale mil veces más que un consejo genérico.
- Si el usuario PREGUNTA algo ("¿qué ceno?", "¿qué pre-entreno tomo?", "¿cómo voy?", "¿me alcanza la proteína?"), CONTESTALO con opciones concretas: alimentos con cantidad y calorías aproximadas, o ejercicios concretos. Nunca respondas con otra pregunta ni con "¿querés que te dé opciones?": si se entiende que quiere opciones, dáselas ya.
- Si pregunta cómo va ("¿cómo voy?", "¿cómo vengo?"), primero leé el día: qué está bien y qué está flojo (calorías, proteína, entrenamiento, sueño, agua) en 2-3 frases, y recién ahí cerrá con UNA acción concreta. No le tires tres menús cuando lo que pidió fue un diagnóstico.
- Si pide ideas u opciones, listá 3 alternativas cortas con "- ", cada una con cantidad y kcal/proteína estimadas, y elegidas para lo que le falta HOY. Priorizá alimentos que ya come (mirá sus FRECUENTES y su MEMORIA) antes que inventarle una dieta nueva.
- Preferí lo que se consigue en Argentina y respetá sus lesiones, alergias y gustos de la MEMORIA.
- El HISTORIAL de la conversación es contexto: si dice "sí", "dale", "dame opciones" o "y para la cena?", se refiere a lo último que hablaron. Continuá ESE tema, no arranques de cero.
- PROHIBIDO responder "no hay nada nuevo que registrar" o similar. Si no hay nada para registrar, es porque el usuario está preguntando algo: contestale.
- Nada de relleno, disclaimers, ni "consultá a un profesional".
- FORMATO: texto plano, se muestra tal cual en una burbuja de chat. NADA de markdown: sin **negritas**, sin ##títulos, sin tablas. Las viñetas van con "- " y CADA UNA en su propia línea (salto de línea real), nunca seguidas dentro de un párrafo.
- Voseo siempre: "sumá", "comé", "tomá", "hacé" (nunca "añade", "come", "toma", "haz").

REGISTRO — reglas:
- Extraé foods/exercises/strength SOLO del ÚLTIMO mensaje del usuario. Lo que aparece en el historial YA se registró: no lo vuelvas a cargar. Lo que vos sugerís tampoco se registra (recién cuando él diga que lo comió).
- Estimá cantidades realistas en gramos/ml si el usuario no las dice. Referencias: 1 huevo ≈ 50 g y 78 kcal (6 g proteína, 5 g grasa); un café con leche ≈ 200 ml; media palta ≈ 100 g (160 kcal); una banana ≈ 120 g; un plato de arroz ≈ 200 g cocido; una pechuga de pollo ≈ 150 g.
- calories, protein, carbs y fat SIEMPRE son el total por la cantidad mencionada, NO por 100 g. Usá números planos (sin unidades).
- meal: inferí de las palabras (desayuné→desayuno, almorcé→almuerzo, merendé→merienda, cené→cena, "de snack"→snack). Si no hay pista, usá la hora local que te paso (5-11→desayuno, 11-15→almuerzo, 15-19→merienda, 19-24→cena, resto→snack).
- Ejercicios (exercises = cardio/gasto calórico): estimá minutos y caloriesBurned según el peso del usuario que te paso. "Corrí 20 min" usá esos minutos. "Hice espalda/pecho/pierna" o "entrené" genérico ≈ 45 min de musculación. Si el usuario dice cuántas calorías quemó (ej. "quemé 350", "el reloj marcó 400 kcal"), usá ESE número exacto en caloriesBurned.
- strength (fuerza estructurada): si menciona un ejercicio con SERIES/REPS/PESO (ej. "press banca 4x8 con 60", "sentadilla 3 series de 10 a 80 kg"), cargalo en strength (sets, reps, weight) y NO lo dupliques en exercises. "4x8" = sets 4, reps 8.
- El alcohol es un food con sus calorías (una cerveza 330 ml ≈ 140 kcal; una copa de vino ≈ 125 kcal).
- bodyweight: poné un número SOLO si el usuario dice su peso EN EL MENSAJE (ej. "me pesé 80", "peso 79.5"). NUNCA copies el "Peso de referencia" que te paso en el contexto: ese es solo para calcular calorías de ejercicio, no es algo que el usuario haya dicho. Si el mensaje no menciona el peso, poné 0.
- water, sleepHours, steps: completá cada uno SOLO si el usuario lo menciona explícitamente en el mensaje; si no, poné 0. Un vaso de agua ≈ 0.25 L. "Caminé 20 minutos" es un exercise, NO steps.
- reply: si registraste algo, confirmalo en 1-2 frases y, si viene al caso, agregá qué le falta para cerrar el día. Si el mensaje es una pregunta, un pedido o un saludo, dejá foods, exercises y strength VACÍOS y respondé como coach con contenido real.
- NO inventes alimentos ni ejercicios que el usuario no mencionó: sugerir no es registrar.

MEMORIA:
- Te paso la MEMORIA del usuario y sus ALIMENTOS FRECUENTES. Si dice "lo de siempre", "lo habitual", "mi desayuno de siempre", etc., resolvé qué alimentos son usando esa memoria/frecuentes y registralos concretos.
- En "remember" guardá SOLO hechos nuevos y duraderos (un hábito estable, un objetivo, una lesión, un suplemento que toma seguido, su rutina semanal, o cuando diga "de ahora en más..." / "siempre..."). NO guardes lo que pasó un solo día, ni algo que ya esté en la MEMORIA. Si no hay nada nuevo, dejá remember vacío.`;

/** Un turno previo de la conversación, tal como se guarda en el chat. */
export type ChatTurn = { role: "user" | "assistant"; text: string };

/**
 * Recordatorio que se agrega al system SOLO en el reintento.
 *
 * `gpt-oss-20b` de vez en cuando devuelve el JSON Schema en lugar de los datos
 * (emite `$schema`, `properties`, `required`…), Groq lo rechaza y el turno se
 * pierde con un "no pude procesar eso". Pasa más seguido cuanto más largo es el
 * `reply`, justo lo que ahora le pedimos cuando el usuario quiere opciones.
 */
const RETRY_NUDGE = `

IMPORTANTE: devolvé SOLO el objeto JSON con los datos pedidos. NO incluyas "$schema", "properties", "required" ni "type": esos son la definición del formato, no la respuesta.`;

/**
 * Un reintento ante una generación inválida. Groq marca ese error como no
 * reintentable, así que el AI SDK no lo cubre: sin esto, una salida malformada
 * (que es aleatoria) se le muestra al usuario como una falla del chat.
 */
async function withRetry(
  call: (nudge: string) => Promise<{ object: CoachResult }>,
): Promise<CoachResult> {
  try {
    return (await call("")).object;
  } catch (err) {
    console.warn("[coach] generación inválida, reintentando", err);
    return (await call(RETRY_NUDGE)).object;
  }
}

/** Llama a Groq y devuelve la interpretación estructurada del mensaje. */
export async function interpretMessage(input: {
  message: string;
  weight: number;
  hour: number;
  memories?: { kind: string; text: string }[];
  frequent?: string;
  /** Estado del día ya calculado en el cliente (ver `athleteBrief`). */
  brief?: string;
  /** Turnos anteriores, del más viejo al más nuevo, SIN el mensaje actual. */
  history?: ChatTurn[];
}): Promise<CoachResult> {
  const mem =
    input.memories && input.memories.length
      ? input.memories.map((m) => `- [${m.kind}] ${m.text}`).join("\n")
      : "(sin datos aún)";
  const freq = input.frequent?.trim() || "(sin datos aún)";
  const brief = input.brief?.trim() || "(sin datos del día aún)";

  // El contexto va como system y la charla como messages: así el modelo ve el
  // historial como turnos de verdad (y entiende "sí" o "dame opciones") en vez
  // de recibir un bloque de texto donde todo pesa igual.
  return withRetry((nudge) =>
    generateObject({
      model: groq(COACH_MODEL),
      schema: coachSchema,
      system: `${COACH_SYSTEM}${nudge}

--- CONTEXTO (no lo repitas literal, usalo) ---

Hora local del usuario: ${input.hour}:00. Peso de referencia para calcular calorías de ejercicio (NO es bodyweight, no lo copies): ${input.weight} kg.

ESTADO DE HOY:
${brief}

MEMORIA DEL USUARIO:
${mem}

ALIMENTOS FRECUENTES POR COMIDA (histórico):
${freq}`,
      messages: [
        ...(input.history ?? []).map((t) => ({
          role: t.role,
          content: t.text,
        })),
        { role: "user" as const, content: input.message },
      ],
    }),
  );
}

/** Estimación nutricional de un alimento, POR 100 g (o 100 ml si es líquido). */
export const foodEstimateSchema = z.object({
  name: z
    .string()
    .describe("Nombre normalizado del alimento en español (ej. 'Naranja')"),
  isLiquid: z
    .boolean()
    .describe("true si se mide en ml (bebidas, aceites, leche); false si en g"),
  calories: z.number().describe("Calorías por 100 g (o 100 ml)"),
  protein: z.number().describe("Proteínas en g por 100 g (o 100 ml)"),
  carbs: z.number().describe("Carbohidratos en g por 100 g (o 100 ml)"),
  fat: z.number().describe("Grasas en g por 100 g (o 100 ml)"),
});

export type FoodEstimate = z.infer<typeof foodEstimateSchema>;

export const FOOD_ESTIMATE_SYSTEM = `Sos una base nutricional. Te dan el nombre de un alimento y devolvés sus valores nutricionales PROMEDIO del alimento genérico, SIEMPRE por 100 g (o por 100 ml si es líquido).

Reglas:
- Valores realistas del alimento crudo/común (ej. Naranja: ~47 kcal, 0.9 prot, 12 carb, 0.1 grasa por 100 g).
- Si es una bebida/líquido/aceite, usá 100 ml y poné isLiquid=true.
- Números planos, sin unidades. NO expliques nada.
- Si el nombre es ambiguo, asumí la versión más común en Argentina.`;

/** Estima los macros por 100 g/ml de un alimento a partir de su nombre. */
export async function estimateFood(name: string): Promise<FoodEstimate> {
  const { object } = await generateObject({
    model: groq(COACH_MODEL),
    schema: foodEstimateSchema,
    system: FOOD_ESTIMATE_SYSTEM,
    prompt: `Alimento: "${name}"`,
  });
  return object;
}

export const COACH_ANALYSIS_SYSTEM = `Sos Nutta, entrenador personal. Analizás los datos reales de la semana del usuario y le hablás DIRECTO, como un coach de verdad: sin rodeos, concreto y motivador pero honesto. Español rioplatense (de vos), 4-6 frases como máximo.

Estructura: 1) destacá lo que hizo bien, 2) marcá sin vueltas lo que está fallando, 3) cerrá con 1-2 acciones claras para la semana que viene. NO inventes datos que no estén en el resumen. Nada de listas largas ni palabrería de ChatGPT.

CÓMO PENSAR (esto es lo que separa a un entrenador de un contador de calorías):
- CRUZÁ entrenamiento con nutrición: si entrenó mucho y comió poco, el problema es la comida, no la falta de ganas. Si no entrenó y comió de más, es al revés.
- El sueño y la hidratación explican el rendimiento: si duerme menos de 7 h, eso va ANTES que cualquier ajuste de macros.
- Composición corporal: NUNCA digas que está peor solo porque subió de peso. Si la cintura baja o las medidas de músculo suben, eso es recomposición y hay que celebrarlo.
- El volumen de fuerza manda sobre la balanza: si sube el volumen y hay PR, está progresando aunque el peso no se mueva.
- Si el volumen saltó más de 50% en una semana o lleva 6+ días seguidos entrenando, avisá del riesgo de lesión antes que nada.
- Las recomendaciones tienen que ser accionables y concretas (qué comer, cuánto dormir, qué entrenar), no consejos genéricos.`;

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
