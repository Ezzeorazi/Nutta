/**
 * Valores MET (Compendium of Physical Activities).
 * Calorías quemadas = MET × peso(kg) × horas.
 */
export type MetActivity = {
  name: string;
  met: number;
  category: string;
};

export const MET_ACTIVITIES: MetActivity[] = [
  // Cardio
  { name: "Caminar (lento)", met: 2.8, category: "Cardio" },
  { name: "Caminar (moderado)", met: 3.5, category: "Cardio" },
  { name: "Caminar rápido", met: 5.0, category: "Cardio" },
  { name: "Trotar", met: 7.0, category: "Cardio" },
  { name: "Correr (~8 km/h)", met: 8.3, category: "Cardio" },
  { name: "Correr (~11 km/h)", met: 11.0, category: "Cardio" },
  { name: "Ciclismo (moderado)", met: 7.5, category: "Cardio" },
  { name: "Ciclismo (intenso)", met: 10.0, category: "Cardio" },
  { name: "Spinning", met: 8.5, category: "Cardio" },
  { name: "Elíptica", met: 5.0, category: "Cardio" },
  { name: "Natación (moderada)", met: 6.0, category: "Cardio" },
  { name: "Natación (intensa)", met: 9.8, category: "Cardio" },
  { name: "Saltar la cuerda", met: 11.0, category: "Cardio" },
  { name: "Remo (máquina)", met: 7.0, category: "Cardio" },

  // Fuerza
  { name: "Musculación (moderada)", met: 3.5, category: "Fuerza" },
  { name: "Musculación (intensa)", met: 6.0, category: "Fuerza" },
  { name: "HIIT", met: 8.0, category: "Fuerza" },
  { name: "Calistenia", met: 4.0, category: "Fuerza" },
  { name: "CrossFit", met: 8.0, category: "Fuerza" },

  // Flexibilidad
  { name: "Yoga", met: 2.5, category: "Flexibilidad" },
  { name: "Pilates", met: 3.0, category: "Flexibilidad" },
  { name: "Estiramiento", met: 2.3, category: "Flexibilidad" },

  // Deportes
  { name: "Fútbol", met: 7.0, category: "Deportes" },
  { name: "Básquet", met: 6.5, category: "Deportes" },
  { name: "Tenis", met: 7.3, category: "Deportes" },
  { name: "Pádel", met: 6.0, category: "Deportes" },
  { name: "Vóley", met: 4.0, category: "Deportes" },
  { name: "Boxeo", met: 7.8, category: "Deportes" },
  { name: "Escalada", met: 8.0, category: "Deportes" },

  // Otras
  { name: "Baile", met: 5.0, category: "Otras" },
  { name: "Senderismo", met: 6.0, category: "Otras" },
  { name: "Jardinería", met: 3.8, category: "Otras" },
];

/** Calorías quemadas según MET, peso (kg) y minutos. */
export function caloriesFromMet(
  met: number,
  weightKg: number,
  minutes: number,
): number {
  return Math.round(met * weightKg * (minutes / 60));
}
