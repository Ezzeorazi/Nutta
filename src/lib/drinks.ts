/**
 * Catálogo de cervezas y tragos clásicos de México, para carga rápida con un
 * botón.
 *
 * Las cervezas guardan su densidad calórica (kcal/100 ml), no las kcal de una
 * porción fija: la misma chela se vende en botellita, lata, medio litro o
 * caguama, y entre una y otra hay 250 kcal de diferencia. La presentación la
 * elige el usuario y las calorías se derivan de ahí.
 *
 * Los tragos van con su porción de referencia —una margarita no se sirve en
 * caguama— pero usan el mismo campo, así se calculan todos igual.
 */

export type DrinkCategory = "cerveza" | "trago";

/** Presentación de cerveza, con los ml con que se vende en México. */
export type BeerSize = { id: string; label: string; ml: number };

export const BEER_SIZES: BeerSize[] = [
  { id: "botellita", label: "Botellita", ml: 325 },
  { id: "lata", label: "Lata", ml: 355 },
  { id: "lata-grande", label: "Lata grande", ml: 473 },
  { id: "medio-litro", label: "Medio litro", ml: 500 },
  { id: "caguama", label: "Caguama", ml: 940 },
  { id: "caguamon", label: "Caguamón", ml: 1200 },
];

/** La lata: la presentación más común, y un punto medio razonable. */
export const DEFAULT_BEER_SIZE = "lata";

export type DrinkOption = {
  id: string;
  name: string;
  brand: string;
  category: DrinkCategory;
  /** Porción de referencia. En cervezas la pisa la presentación elegida. */
  ml: number;
  /** Densidad calórica: lo que permite escalar a cualquier presentación. */
  kcalPer100ml: number;
  emoji: string;
};

/** kcal de una porción concreta de `ml`. */
export const caloriesFor = (opt: DrinkOption, ml: number) =>
  Math.round((ml * opt.kcalPer100ml) / 100);

/** Cerveza: la porción se define por presentación, no por marca. */
const beer = (
  id: string,
  name: string,
  kcalPer100ml: number,
  emoji = "🍺",
): DrinkOption => ({
  id,
  name,
  brand: name,
  category: "cerveza",
  ml: 355,
  kcalPer100ml,
  emoji,
});

/** Trago: receta con porción fija, la densidad sale de esa porción. */
const drink = (
  id: string,
  name: string,
  brand: string,
  ml: number,
  calories: number,
  emoji: string,
): DrinkOption => ({
  id,
  name,
  brand,
  category: "trago",
  ml,
  kcalPer100ml: Math.round((calories / ml) * 100 * 10) / 10,
  emoji,
});

export const BEERS: DrinkOption[] = [
  beer("corona", "Corona Extra", 41),
  beer("modelo", "Modelo Especial", 41),
  beer("victoria", "Victoria", 40),
  beer("tecate", "Tecate", 40),
  beer("pacifico", "Pacífico", 41),
  beer("sol", "Sol", 39),
  beer("indio", "Indio", 42),
  beer("bohemia", "Bohemia", 44),
  beer("dos-equis", "Dos Equis Lager", 37),
  beer("leon", "León", 41),
  beer("heineken", "Heineken", 40),
  beer("negra-modelo", "Negra Modelo", 48, "🍺"),
  beer("dos-equis-ambar", "Dos Equis Ámbar", 41),
  beer("montejo", "Montejo", 42),
  beer("carta-blanca", "Carta Blanca", 41),
  beer("superior", "Superior", 41),
  beer("estrella-jalisco", "Estrella Jalisco", 41),
  beer("corona-familiar", "Corona Familiar", 44),
  beer("stella", "Stella Artois", 43),
  beer("modelo-oro", "Modelo Oro", 25),
  beer("corona-light", "Corona Light", 28),
  beer("tecate-light", "Tecate Light", 30),
  beer("michelob-ultra", "Michelob Ultra", 27),
  beer("amstel-ultra", "Amstel Ultra", 27),
  beer("heineken-silver", "Heineken Silver", 33),
  beer("artesanal-ipa", "Artesanal / IPA", 60),
];

export const COCKTAILS: DrinkOption[] = [
  drink("tequila", "Tequila (caballito)", "Tequila", 45, 97, "🥃"),
  drink("mezcal", "Mezcal (caballito)", "Mezcal", 45, 95, "🥃"),
  drink("michelada", "Michelada", "Cerveza + Clamato", 400, 180, "🌶️"),
  drink("chelada", "Chelada", "Cerveza + limón", 355, 150, "🍋"),
  drink("paloma", "Paloma", "Tequila + toronja", 300, 180, "🍹"),
  drink("cantarito", "Cantarito", "Tequila + cítricos", 350, 220, "🍊"),
  drink("margarita", "Margarita", "Tequila + triple sec", 200, 250, "🍸"),
  drink("vampiro", "Vampiro", "Tequila + sangrita", 300, 200, "🍹"),
  drink("bandera", "Bandera", "Tequila + sangrita + limón", 135, 140, "🇲🇽"),
  drink("batanga", "Batanga", "Tequila + cola + limón", 300, 170, "🥤"),
  drink("charro-negro", "Charro Negro", "Tequila + cola", 300, 170, "🥤"),
  drink("cuba-libre", "Cuba Libre", "Ron + cola", 300, 180, "🥤"),
  drink("carajillo", "Carajillo", "Licor 43 + espresso", 120, 220, "☕"),
  drink("mojito", "Mojito", "Ron + menta", 250, 215, "🌿"),
  drink("tequila-sunrise", "Tequila Sunrise", "Tequila + naranja", 250, 230, "🌅"),
  drink("negroni", "Negroni", "Gin + Campari + vermut", 90, 195, "🍸"),
  drink("gin-tonic", "Gin Tonic", "Gin + tónica", 300, 180, "🍸"),
  drink("aperol-spritz", "Aperol Spritz", "Aperol + prosecco", 200, 180, "🍊"),
  drink("old-fashioned", "Old Fashioned", "Whisky + angostura", 90, 155, "🥃"),
  drink("martini", "Martini", "Gin + vermut seco", 90, 175, "🍸"),
  drink("cosmopolitan", "Cosmopolitan", "Vodka + arándano", 150, 200, "🍸"),
  drink("moscow-mule", "Moscow Mule", "Vodka + ginger beer", 250, 180, "🍹"),
  drink("daiquiri", "Daiquirí", "Ron + limón", 150, 220, "🍹"),
  drink("pina-colada", "Piña Colada", "Ron + piña + coco", 250, 380, "🍍"),
  drink("espresso-martini", "Espresso Martini", "Vodka + café", 120, 230, "☕"),
  drink("whisky-rocas", "Whisky en las rocas", "Whisky", 45, 105, "🥃"),
  drink("ron-shot", "Ron (caballito)", "Ron", 45, 97, "🥃"),
  drink("vodka-shot", "Vodka (caballito)", "Vodka", 45, 97, "🥃"),
  drink("vino-tinto", "Vino tinto (copa)", "Vino tinto", 150, 125, "🍷"),
  drink("vino-blanco", "Vino blanco (copa)", "Vino blanco", 150, 120, "🥂"),
  drink("sangria", "Sangría", "Vino + fruta", 250, 200, "🍷"),
  drink("clericot", "Clericot", "Vino blanco + fruta", 250, 190, "🍇"),
  drink("tepache", "Tepache", "Piña fermentada", 250, 110, "🍍"),
  drink("pulque", "Pulque", "Agave fermentado", 250, 90, "🌵"),
];

export const DRINKS: DrinkOption[] = [...BEERS, ...COCKTAILS];

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
