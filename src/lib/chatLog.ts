/**
 * Formato del resumen "Registrado" que el coach adjunta a su respuesta.
 *
 * Los mensajes se persisten como texto plano, así que el resumen viaja dentro
 * del mismo string que la respuesta. Estas dos funciones son las únicas que
 * conocen ese formato: `formatLog` lo arma al registrar y `splitLog` lo separa
 * para poder dibujar la lista como tarjeta en vez de un párrafo suelto.
 */

const MARKER = "\n\n📝 Registrado:\n";

/** Une la respuesta del coach con las líneas de lo que se registró. */
export function formatLog(reply: string, logged: string[]): string {
  if (logged.length === 0) return reply;
  return `${reply}${MARKER}${logged.join("\n")}`;
}

/** Separa un mensaje guardado en respuesta + líneas registradas. */
export function splitLog(text: string): { reply: string; logged: string[] } {
  const at = text.indexOf(MARKER);
  if (at === -1) return { reply: text, logged: [] };
  return {
    reply: text.slice(0, at),
    logged: text
      .slice(at + MARKER.length)
      .split("\n")
      .filter((line) => line.trim() !== ""),
  };
}

/**
 * Parte una línea registrada en sus tres piezas para poder maquetarla.
 * Formato de origen: "🥚 Huevos · 155 kcal · 13 g P".
 */
export function parseLogLine(line: string): {
  emoji: string;
  name: string;
  stats: string[];
} {
  const space = line.indexOf(" ");
  const emoji = space === -1 ? "" : line.slice(0, space);
  const rest = space === -1 ? line : line.slice(space + 1);
  const [name, ...stats] = rest.split(" · ");
  return { emoji, name, stats };
}
