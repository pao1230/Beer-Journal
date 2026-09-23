import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brewing Journal",
    short_name: "Brewing",
    description: "Recipes, brew sessions, problems and lessons learned.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#b45309",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
