import { NextResponse } from "next/server";
import { normalizeProduct, type OffProduct } from "@/lib/off";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ product: null, error: "Código inválido" });
  }

  const url =
    `https://world.openfoodfacts.org/api/v2/product/${code}?` +
    new URLSearchParams({
      fields: "code,product_name,product_name_es,brands,nutriments",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Nutta/0.1 (nutricion app)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    const data = (await res.json()) as {
      status?: number;
      product?: OffProduct;
    };

    const product = data.product ? normalizeProduct(data.product) : null;
    if (!product) {
      return NextResponse.json({
        product: null,
        error: "Producto sin datos nutricionales o no encontrado",
      });
    }
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json(
      { product: null, error: "No se pudo consultar el código" },
      { status: 502 },
    );
  }
}
