/**
 * Deriva un emoji a partir del nombre de un alimento o actividad.
 * Se hace en el cliente (por palabras clave) para que funcione también con
 * registros viejos, sin depender de que la IA lo devuelva.
 */

const FOOD_EMOJI: [RegExp, string][] = [
  [/huevo/, "🥚"],
  [/caf[eé]/, "☕"],
  [/mate\b/, "🧉"],
  [/t[eé]\b|infusi/, "🍵"],
  [/palta|aguacate/, "🥑"],
  [/pollo|pechuga/, "🍗"],
  [/carne|bife|asado|milanesa|vaca|cerdo|lomo/, "🥩"],
  [/pescado|at[uú]n|salm[oó]n|merluza/, "🐟"],
  [/arroz/, "🍚"],
  [/pan|tostada|medialuna|factura/, "🍞"],
  [/pasta|fideos|tallarin|ravioles|ñoqui/, "🍝"],
  [/pizza/, "🍕"],
  [/hamburguesa/, "🍔"],
  [/ensalada|lechuga|verdura/, "🥗"],
  [/tomate/, "🍅"],
  [/papa|patata/, "🥔"],
  [/queso/, "🧀"],
  [/leche|yogur|yoghurt/, "🥛"],
  [/avena|cereal|granola/, "🥣"],
  [/banana|pl[aá]tano/, "🍌"],
  [/manzana/, "🍎"],
  [/naranja|mandarina|c[ií]trico/, "🍊"],
  [/frutilla|fresa|berr|ar[aá]ndano/, "🍓"],
  [/uva/, "🍇"],
  [/fruta/, "🍎"],
  [/batido|licuado|prote[ií]na|shake|whey/, "🥤"],
  [/chocolate|postre|helado|torta|dulce|galletita/, "🍫"],
  [/cerveza|birra/, "🍺"],
  [/vino/, "🍷"],
  [/trago|fernet|whisky|vodka|gin|alcohol/, "🍸"],
  [/agua/, "💧"],
  [/gaseosa|refresco|coca|jugo/, "🥤"],
  [/nuez|almendra|man[ií]|fruto seco/, "🥜"],
  [/sopa|caldo/, "🍲"],
];

const EXERCISE_EMOJI: [RegExp, string][] = [
  [/corr|trot|running|maraton/, "🏃"],
  [/camin|caminata|pasos/, "🚶"],
  [/bici|ciclis|spinning|pedal/, "🚴"],
  [/nad|natacion|pileta|piscina/, "🏊"],
  [/pesa|musculaci|gym|gimnasio|fuerza|espalda|pecho|pierna|b[ií]ceps|hombro|gl[uú]teo|abdominal|press|sentadilla/, "🏋️"],
  [/yoga|estiramiento|movilidad|pilates/, "🧘"],
  [/f[uú]tbol|futbol/, "⚽"],
  [/b[aá]squet|basket/, "🏀"],
  [/tenis|paddle|p[aá]del/, "🎾"],
  [/box|boxeo|mma|artes marciales/, "🥊"],
  [/funcional|hiit|crossfit|circuito|salt/, "🤸"],
  [/baile|zumba|danza/, "💃"],
  [/escal|monta/, "🧗"],
];

function match(name: string, table: [RegExp, string][], fallback: string) {
  const n = name.toLowerCase();
  for (const [re, emoji] of table) if (re.test(n)) return emoji;
  return fallback;
}

export const emojiForFood = (name: string) => match(name, FOOD_EMOJI, "🍽️");
export const emojiForExercise = (name: string) =>
  match(name, EXERCISE_EMOJI, "💪");
