type Row = Record<string, string | number | undefined>;

/** Convierte filas a CSV (con escape de comillas/comas/saltos). */
export function toCSV(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}

/** Dispara la descarga de un archivo de texto. */
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const blob = new Blob(["﻿", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const downloadCSV = (filename: string, rows: Row[]) =>
  downloadText(filename, toCSV(rows));

/** Abre una ventana con HTML e invoca la impresión (el usuario guarda como PDF). */
export function printHTML(title: string, bodyHTML: string) {
  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;margin:32px;line-height:1.5}
  h1{color:#16a34a;margin:0 0 4px}
  h2{margin:24px 0 8px;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .muted{color:#666;font-size:13px}
  table{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}
  td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f4f6f5}
  .grid{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
  .tile{border:1px solid #ddd;border-radius:8px;padding:12px 16px;min-width:120px}
  .tile b{display:block;font-size:20px}
</style></head><body>${bodyHTML}
<script>window.onload=function(){window.print()}</script>
</body></html>`);
  w.document.close();
}
