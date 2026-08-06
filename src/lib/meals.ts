/**
 * Traduce "te faltan 45 g de proteína" a comida de verdad.
 *
 * Un contador de calorías te da el número y se lava las manos. Un entrenador te
 * dice qué comprar y cuánto poner en el plato. Los valores son de alimentos
 * crudos/comunes en Argentina, que es como se pesan en casa.
 *
 * Regla que aprendimos a los golpes: lo que falta EN EL DÍA no es lo que entra
 * EN UNA COMIDA. Sin ese tope, un hueco de 460 g de carbos salía como
 * "17 bananas" o "2710 g de papa" — matemáticamente cierto e inservible.
 */

type Source = {
  /** Nombre tal como va en la frase ("250 g de pollo"). */
  label: string;
  /** Gramos del macro por 100 g de alimento. */
  per100: number;
  /**
   * Porción máxima razonable: gramos, o unidades si tiene `unit`. Es el segundo
   * techo, y hace falta: topear el macro no alcanza, porque 120 g de carbos en
   * papa siguen siendo 710 g de papa. Si la porción no entra, la opción se
   * descarta y se ofrece un alimento más denso.
   */
  max: number;
  /** Si se cuenta por unidad (huevo, lata, scoop), aporte de una unidad. */
  unit?: { each: number; one: string; many: string };
};

/** Techo de lo que una persona come de una sentada, por macro. */
const MAX_MEAL_PROTEIN = 50;
const MAX_MEAL_CARBS = 90;

const POLLO: Source = { label: "pechuga de pollo", per100: 23, max: 350 };
const ATUN: Source = {
  label: "atún al natural",
  per100: 24,
  max: 2,
  unit: { each: 24, one: "1 lata de atún", many: "latas de atún" },
};
const HUEVO: Source = {
  label: "huevo",
  per100: 12,
  max: 4,
  unit: { each: 6, one: "1 huevo", many: "huevos" },
};
const WHEY: Source = {
  label: "proteína en polvo",
  per100: 80,
  max: 3,
  unit: { each: 24, one: "1 scoop de proteína", many: "scoops de proteína" },
};
const YOGUR: Source = { label: "yogur griego", per100: 9, max: 400 };
const CARNE: Source = { label: "carne magra", per100: 21, max: 350 };

const ARROZ: Source = { label: "arroz cocido", per100: 28, max: 400 };
const FIDEOS: Source = { label: "fideos cocidos", per100: 25, max: 400 };
const PAPA: Source = { label: "papa", per100: 17, max: 400 };
const AVENA: Source = { label: "avena", per100: 60, max: 150 };
const PAN: Source = { label: "pan", per100: 50, max: 200 };
const BANANA: Source = {
  label: "banana",
  per100: 23,
  max: 3,
  unit: { each: 27, one: "1 banana", many: "bananas" },
};

/** Redondea a la porción que uno serviría de verdad (múltiplos de 10 g). */
const toPortion = (g: number) => Math.max(10, Math.round(g / 10) * 10);

/** Una opción concreta, o `null` si la porción que haría falta es irreal. */
function option(s: Source, grams: number): string | null {
  if (s.unit) {
    const n = Math.max(1, Math.round(grams / s.unit.each));
    if (n > s.max) return null;
    return n === 1 ? s.unit.one : `${n} ${s.unit.many}`;
  }
  const g = toPortion((grams / s.per100) * 100);
  return g > s.max ? null : `${g} g de ${s.label}`;
}

/** Primeras `n` opciones que dan una porción realista. */
const pick = (candidates: (string | null)[], n = 3) =>
  candidates.filter((c): c is string => c !== null).slice(0, n);

export type MealPlan = {
  /** Lo que falta en TODO el día. */
  missing: number;
  /** A lo que conviene apuntar en la próxima comida (missing, topeado). */
  target: number;
  /** true cuando lo que falta no entra en una sola comida. */
  split: boolean;
  /** En cuántas comidas conviene repartirlo (solo si `split`). */
  meals: number;
  /** Opciones concretas para cubrir `target`. */
  ideas: string[];
};

function plan(missing: number, max: number, ideas: (g: number) => string[]) {
  const need = Math.round(missing);
  const target = Math.min(need, max);
  return {
    missing: need,
    target,
    split: need > max,
    meals: Math.ceil(need / max),
    ideas: ideas(target),
  };
}

/**
 * Cómo cubrir la proteína que falta. Si no entra en una comida, las opciones
 * son para la PRÓXIMA y el plan avisa en cuántas conviene repartir el resto.
 */
export function proteinPlan(missing: number): MealPlan | null {
  if (missing < 10) return null;
  return plan(missing, MAX_MEAL_PROTEIN, proteinIdeas);
}

/** Ídem para los carbohidratos. */
export function carbPlan(missing: number): MealPlan | null {
  if (missing < 20) return null;
  return plan(missing, MAX_MEAL_CARBS, carbIdeas);
}

/**
 * Formas concretas de sumar `grams` de proteína: una sólida, una combinada y
 * una rápida. La combinada existe porque nadie cena 250 g de pollo pelado.
 */
export function proteinIdeas(grams: number): string[] {
  const need = Math.round(grams);
  if (need < 10) return [];

  // Combo atún + lo que reste, en huevos si alcanzan o en pollo si no.
  const resto = need - ATUN.unit!.each;
  const combo =
    need >= 24 && resto >= 6
      ? (() => {
          const extra = option(HUEVO, resto) ?? option(POLLO, resto);
          return extra ? `${ATUN.unit!.one} + ${extra}` : null;
        })()
      : need >= 24
        ? ATUN.unit!.one
        : option(HUEVO, need);

  return pick([
    option(POLLO, need),
    combo,
    option(WHEY, need),
    option(CARNE, need),
    option(YOGUR, need),
  ]);
}

/** Formas concretas de sumar `grams` de carbohidratos. */
export function carbIdeas(grams: number): string[] {
  const need = Math.round(grams);
  if (need < 20) return [];
  // Orden: primero lo que se sirve en un plato, después lo denso. Cada opción
  // se descarta sola si la porción no es realista (ver `option`).
  return pick([
    option(ARROZ, need),
    option(FIDEOS, need),
    option(PAPA, need),
    option(AVENA, need),
    option(PAN, need),
    option(BANANA, need),
  ]);
}
