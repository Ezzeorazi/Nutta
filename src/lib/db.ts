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
    // Suplementos que toma el usuario (su lista).
    supplements: i.entity({
      owner: i.string().indexed(),
      name: i.string(),
      dose: i.string().optional(),
      time: i.string().optional(), // "HH:MM" para recordatorio
      createdAt: i.number(),
    }),
    // Registro de toma de un suplemento en un día (presencia = tomado).
    supplementLogs: i.entity({
      owner: i.string().indexed(),
      supId: i.string().indexed(),
      date: i.string().indexed(),
    }),
  },
});

export const db = init({ appId: APP_ID, schema });
export { id };
