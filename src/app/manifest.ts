import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nutta — Nutrición y ejercicio",
    short_name: "Nutta",
    description:
      "Registrá tu alimentación y ejercicio: calorías, proteínas, carbohidratos y grasas.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8faf9",
    theme_color: "#16a34a",
    categories: ["health", "fitness", "lifestyle"],
    lang: "es",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
