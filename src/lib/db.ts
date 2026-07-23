import { i, id, init } from "@instantdb/react";

// App ID de InstantDB. Es una clave pública (viaja al navegador), no un secreto:
// la seguridad se maneja con las reglas de permisos de InstantDB.
const APP_ID = "8bcd1994-bd17-4415-a6a4-dc38934d780f";

const schema = i.schema({
  entities: {
    profiles: i.entity({
      owner: i.string().indexed(),
      sex: i.string(),
      age: i.number(),
      weight: i.number(),
      height: i.number(),
      activity: i.string(),
      objective: i.string(),
      targetWeight: i.number().optional(), // meta de peso (kg)
    }),
    foods: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(),
      meal: i.string(),
      name: i.string(),
      qty: i.number(),
      calories: i.number(),
      protein: i.number(),
      carbs: i.number(),
      fat: i.number(),
      createdAt: i.number().optional(), // epoch ms — para el timeline
    }),
    exercises: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(),
      name: i.string(),
      minutes: i.number(),
      caloriesBurned: i.number(),
      createdAt: i.number().optional(), // epoch ms — para el timeline
      // Métricas opcionales del reloj/smartband (Xiaomi/Mi Fitness, etc.).
      avgHeartRate: i.number().optional(), // LPM promedio
      maxHeartRate: i.number().optional(), // LPM máximo
      trainingEffect: i.number().optional(), // "Efecto del entrenamiento" (0-5)
    }),
    // Historial del chat conversacional (estilo WhatsApp).
    messages: i.entity({
      owner: i.string().indexed(),
      role: i.string(), // "user" | "assistant"
      text: i.string(),
      createdAt: i.number().indexed(), // Date.now() — para ordenar
    }),
    // Memoria del usuario: hábitos, alimentos frecuentes, lesiones, objetivos…
    // La IA la lee ("lo de siempre") y la escribe (aprende sola).
    memories: i.entity({
      owner: i.string().indexed(),
      kind: i.string(), // habito | alimento | suplemento | lesion | objetivo | rutina | nota
      text: i.string(),
      createdAt: i.number(),
    }),
    // Registro de peso corporal (un valor por día; el último gana).
    weights: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(), // YYYY-MM-DD
      kg: i.number(),
      createdAt: i.number(),
    }),
    // Medidas corporales (una fila por parte y día): cintura, pecho, brazo…
    measures: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(), // YYYY-MM-DD
      part: i.string(), // cintura | pecho | brazo | muslo | pantorrilla
      cm: i.number(),
      createdAt: i.number(),
    }),
    // Métricas diarias de bienestar (una fila por día): agua, sueño, pasos.
    metrics: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(), // YYYY-MM-DD
      water: i.number().optional(), // litros
      sleepHours: i.number().optional(),
      sleepQuality: i.number().optional(), // 1-5
      steps: i.number().optional(),
      createdAt: i.number().optional(), // epoch ms (para derivar el día local)
    }),
    // Metas personalizadas del usuario (peso, levantamiento, medida).
    customGoals: i.entity({
      owner: i.string().indexed(),
      kind: i.string(), // peso | levantamiento | medida
      label: i.string(),
      target: i.number(),
      ref: i.string().optional(), // ejercicio (levantamiento) o parte (medida)
      createdAt: i.number(),
    }),
    // Fotos de progreso (la imagen vive en storage; acá va la metadata).
    photos: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(), // YYYY-MM-DD
      path: i.string(),
      fileId: i.string(), // id en $files (para resolver url y borrar)
      createdAt: i.number(),
    }),
    // Series de entrenamiento de fuerza (una fila por serie).
    strengthSets: i.entity({
      owner: i.string().indexed(),
      date: i.string().indexed(), // YYYY-MM-DD
      exercise: i.string(),
      reps: i.number(),
      weight: i.number(), // kg
      createdAt: i.number(),
    }),
    // Recetas: combos de alimentos que se agregan de una.
    recipes: i.entity({
      owner: i.string().indexed(),
      name: i.string(),
      items: i.string(), // JSON: [{name, qty, calories, protein, carbs, fat}]
      createdAt: i.number(),
    }),
    // Alimentos favoritos (guardados para re-cargar en un toque).
    favorites: i.entity({
      owner: i.string().indexed(),
      name: i.string(),
      qty: i.number(),
      calories: i.number(),
      protein: i.number(),
      carbs: i.number(),
      fat: i.number(),
      createdAt: i.number(),
    }),
    // Suplementos que toma el usuario (su lista).
    supplements: i.entity({
      owner: i.string().indexed(),
      name: i.string(),
      dose: i.string().optional(),
      time: i.string().optional(), // "HH:MM" para recordatorio
      defaultQty: i.number().optional(), // cantidad habitual por toma (ej. 5, 30, 2)
      unit: i.string().optional(), // ej. "g", "cápsulas"
      protein: i.number().optional(), // g de proteína que aporta `defaultQty` unidades
      createdAt: i.number(),
    }),
    // Registro de toma de un suplemento en un día (presencia = tomado).
    supplementLogs: i.entity({
      owner: i.string().indexed(),
      supId: i.string().indexed(),
      date: i.string().indexed(),
      qty: i.number().optional(), // cantidad real tomada ese día (si difiere de defaultQty)
      createdAt: i.number().optional(), // epoch ms (para derivar el día local)
    }),
  },
});

export const db = init({ appId: APP_ID, schema });
export { id };
