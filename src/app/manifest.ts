import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BelegPilot Lite",
    short_name: "BelegPilot",
    description: "Treuhand-App fuer Belege, Kontierung und Banana Export.",
    start_url: "/mandanten",
    display: "standalone",
    background_color: "#eff4fb",
    theme_color: "#0f172a",
    lang: "de",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
