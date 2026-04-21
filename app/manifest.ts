import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SuperBad",
    short_name: "SuperBad",
    description: "SuperBad operations platform.",
    start_url: "/lite/cockpit",
    display: "standalone",
    background_color: "#1A1A18",
    theme_color: "#1A1A18",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
