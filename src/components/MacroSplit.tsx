"use client";

/** Calorías que aporta cada gramo de macronutriente (factores de Atwater). */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Lectura en vivo de lo que estás por registrar: calorías grandes y el reparto
 * de macros.
 *
 * Es lectura, no formulario, y esa es la idea: mientras ajustás la cantidad los
 * números se mueven solos. Antes había que mirar cuatro campos numéricos para
 * entender qué estabas cargando.
 *
 * La barra reparte por CALORÍAS, no por gramos: 10 g de grasa pesan más del
 * doble que 10 g de proteína, y mostrarlos iguales daría una idea equivocada.
 */
export default function MacroSplit({
  calories,
  protein,
  carbs,
  fat,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  const parts = [
    { key: "protein", label: "Proteínas", g: protein, color: "var(--primary)" },
    { key: "carbs", label: "Carbos", g: carbs, color: "var(--accent)" },
    { key: "fat", label: "Grasas", g: fat, color: "var(--success)" },
  ] as const;

  const kcal = parts.map(
    (p) => Math.max(0, p.g) * KCAL_PER_G[p.key as keyof typeof KCAL_PER_G],
  );
  const totalKcal = kcal.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3 rounded-card bg-sunken p-4">
      <p className="text-3xl font-bold tabular-nums">
        {Math.round(calories) || 0}
        <span className="ml-1.5 text-base font-normal text-muted">kcal</span>
      </p>

      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {totalKcal > 0 ? (
          parts.map((p, i) => (
            <span
              key={p.key}
              className="h-full transition-[flex-grow] duration-(--duration-slow)"
              style={{
                flexGrow: kcal[i],
                flexBasis: 0,
                backgroundColor: p.color,
              }}
            />
          ))
        ) : (
          <span className="h-full w-full bg-border" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key} className="flex flex-col">
            <span
              className="text-base font-semibold tabular-nums"
              style={{ color: p.color }}
            >
              {Math.round(p.g * 10) / 10} g
            </span>
            <span className="text-xs text-muted">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
