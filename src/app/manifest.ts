import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brewing Journal",
    short_name: "Brewing",
    description: "Recipes, brew sessions, problems and lessons learned.",
    start_url: "/",
    display: "standalone",
    background_color: "#edf0ee",
    theme_color: "#2b5a6b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
