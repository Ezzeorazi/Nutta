/**
 * Traduce "te faltan 45 g de proteína" a comida de verdad.
 *
 * Un contador de calorías te da el número y se lava las manos. Un entrenador te
 * dice qué comprar y cuánto poner en el plato. Los valores son de alimentos
 * crudos/comunes en Argentina, que es como se pesan en casa.
 */

type Source = {
  /** Nombre tal como va en la frase ("250 g de pollo"). */
  label: string;
  /** Gramos del macro por 100 g de alimento. */
  per100: number;
  /** Si se cuenta por unidad (huevo, lata, scoop), aporte de una unidad. */
  unit?: { each: number; one: string; many: string };
};

const PROTEIN: Source[] = [
  { label: "pechuga de pollo", per100: 23 },
  { label: "carne magra", per100: 21 },
  { label: "merluza", per100: 17 },
  { label: "yogur griego", per100: 9 },
  { label: "queso port salut", per100: 22 },
  {
    label: "atún al natural",
    per100: 24,
    unit: { each: 24, one: "1 lata de atún", many: "latas de atún" },
  },
  { label: "huevo", per100: 12, unit: { each: 6, one: "1 huevo", many: "huevos" } },
  {
    label: "proteína en polvo",
    per100: 80,
    unit: { each: 24, one: "1 scoop de proteína", many: "scoops de proteína" },
  },
];

const CARBS: Source[] = [
  { label: "arroz cocido", per100: 28 },
  { label: "fideos cocidos", per100: 25 },
  { label: "papa", per100: 17 },
  { label: "avena", per100: 60 },
  { label: "pan", per100: 50 },
  {
    label: "banana",
    per100: 23,
    unit: { each: 27, one: "1 banana", many: "bananas" },
  },
];

/** Redondea a la porción que uno serviría de verdad (múltiplos de 10 g). */
const toPortion = (g: number) => Math.max(10, Math.round(g / 10) * 10);

const byWeight = (s: Source, grams: number) =>
  `${toPortion((grams / s.per100) * 100)} g de ${s.label}`;

const byUnit = (s: Source, grams: number) => {
  const u = s.unit!;
  const n = Math.max(1, Math.round(grams / u.each));
  return n === 1 ? u.one : `${n} ${u.many}`;
};

/** Una opción concreta a partir de una fuente. */
const option = (s: Source, grams: number) =>
  s.unit ? byUnit(s, grams) : byWeight(s, grams);

/**
 * Tres formas concretas de sumar `grams` de proteína: una sólida, una rápida y
 * una combinada. La combinada existe porque nadie cena 250 g de pollo pelado.
 */
export function proteinIdeas(grams: number): string[] {
  const need = Math.round(grams);
  if (need < 10) return [];

  const pollo = PROTEIN[0];
  const atun = PROTEIN.find((s) => s.label === "atún al natural")!;
  const huevo = PROTEIN.find((s) => s.label === "huevo")!;
  const whey = PROTEIN.find((s) => s.label === "proteína en polvo")!;
  const yogur = PROTEIN.find((s) => s.label === "yogur griego")!;

  const out = [option(pollo, need)];

  // Combo: una lata de atún cubre ~24 g y el resto se completa. Los huevos se
  // topan en 4 porque "1 lata + 6 huevos" ya no es una comida, es un desafío.
  if (need >= 24) {
    const resto = need - atun.unit!.each;
    if (resto >= 6 && resto <= huevo.unit!.each * 4) {
      out.push(`${atun.unit!.one} + ${byUnit(huevo, resto)}`);
    } else if (resto > huevo.unit!.each * 4) {
      out.push(`${atun.unit!.one} + ${byWeight(pollo, resto)}`);
    } else {
      out.push(atun.unit!.one);
    }
  } else {
    out.push(byUnit(huevo, need));
  }

  out.push(need >= 20 ? option(whey, need) : option(yogur, need));
  return out;
}

/** Dos formas concretas de sumar `grams` de carbohidratos. */
export function carbIdeas(grams: number): string[] {
  const need = Math.round(grams);
  if (need < 20) return [];
  const arroz = CARBS[0];
  const papa = CARBS.find((s) => s.label === "papa")!;
  const banana = CARBS.find((s) => s.label === "banana")!;
  return [option(arroz, need), option(papa, need), option(banana, need)];
}
