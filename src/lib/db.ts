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
  },
});

export const db = init({ appId: APP_ID, schema });
export { id };
