/**
 * Reduce una imagen del lado del cliente antes de subirla (las fotos de celular
 * pesan varios MB). Devuelve un JPEG redimensionado al lado mayor `max`.
 */
export async function downscaleImage(
  file: File,
  max = 1280,
  quality = 0.82,
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    return blob ?? file;
  } catch {
    // Si el navegador no soporta el pipeline, se sube el original.
    return file;
  }
}
