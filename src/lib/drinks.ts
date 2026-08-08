/**
 * Catálogo de cervezas y tragos clásicos de México, para carga rápida con un
 * botón. Los ml y las kcal son valores de referencia (porción habitual de
 * venta); alcanza para llevar el impacto calórico, no para nutricionistas.
 */

export type DrinkCategory = "cerveza" | "trago";

export type DrinkOption = {
  id: string;
  name: string;
  brand: string;
  category: DrinkCategory;
  ml: number;
  calories: number;
  emoji: string;
};

export const DRINKS: DrinkOption[] = [
  // --- Cervezas ---
  { id: "corona", name: "Corona Extra", brand: "Corona", category: "cerveza", ml: 355, calories: 148, emoji: "🍺" },
  { id: "modelo", name: "Modelo Especial", brand: "Modelo", category: "cerveza", ml: 355, calories: 147, emoji: "🍺" },
  { id: "victoria", name: "Victoria", brand: "Victoria", category: "cerveza", ml: 355, calories: 150, emoji: "🍺" },
  { id: "tecate", name: "Tecate", brand: "Tecate", category: "cerveza", ml: 355, calories: 145, emoji: "🍺" },
  { id: "pacifico", name: "Pacífico", brand: "Pacífico", category: "cerveza", ml: 355, calories: 145, emoji: "🍺" },
  { id: "sol", name: "Sol", brand: "Sol", category: "cerveza", ml: 355, calories: 140, emoji: "🍺" },
  { id: "indio", name: "Indio", brand: "Indio", category: "cerveza", ml: 355, calories: 150, emoji: "🍺" },
  { id: "bohemia", name: "Bohemia", brand: "Bohemia", category: "cerveza", ml: 355, calories: 155, emoji: "🍺" },
  { id: "dos-equis", name: "Dos Equis Lager", brand: "Dos Equis", category: "cerveza", ml: 355, calories: 130, emoji: "🍺" },
  { id: "leon", name: "León", brand: "León", category: "cerveza", ml: 355, calories: 145, emoji: "🍺" },

  // --- Tragos ---
  { id: "tequila", name: "Tequila (caballito)", brand: "Tequila", category: "trago", ml: 45, calories: 97, emoji: "🥃" },
  { id: "mezcal", name: "Mezcal (caballito)", brand: "Mezcal", category: "trago", ml: 45, calories: 95, emoji: "🥃" },
  { id: "michelada", name: "Michelada", brand: "Cerveza + Clamato", category: "trago", ml: 400, calories: 180, emoji: "🌶️" },
  { id: "paloma", name: "Paloma", brand: "Tequila + toronja", category: "trago", ml: 300, calories: 180, emoji: "🍹" },
  { id: "margarita", name: "Margarita", brand: "Tequila + triple sec", category: "trago", ml: 200, calories: 250, emoji: "🍸" },
  { id: "vampiro", name: "Vampiro", brand: "Tequila + sangrita", category: "trago", ml: 300, calories: 200, emoji: "🍹" },
  { id: "cuba-libre", name: "Cuba Libre", brand: "Ron + cola", category: "trago", ml: 300, calories: 180, emoji: "🥤" },
  { id: "charro-negro", name: "Charro Negro", brand: "Tequila + cola", category: "trago", ml: 300, calories: 170, emoji: "🥤" },
  { id: "mojito", name: "Mojito", brand: "Ron + menta", category: "trago", ml: 250, calories: 215, emoji: "🍹" },
  { id: "tequila-sunrise", name: "Tequila Sunrise", brand: "Tequila + naranja", category: "trago", ml: 250, calories: 230, emoji: "🍹" },
];

/**
 * Ordena el catálogo dejando primero lo que más toma el usuario (conteo de
 * registros históricos por `catalogId`). Empate → se respeta el orden del
 * catálogo (sort estable), así los botones no bailan sin motivo.
 */
export function sortByUsage<T extends { catalogId: string }>(
  catalog: DrinkOption[],
  entries: T[],
): DrinkOption[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.catalogId, (counts.get(e.catalogId) ?? 0) + 1);
  return [...catalog].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  );
}
