import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poké Event Alert",
    short_name: "Poké Alert",
    description: "Ne rate plus ton prochain événement Play! Pokémon.",
    start_url: "/poke-event-alert/",
    display: "standalone",
    background_color: "#07111f",
    theme_color: "#0d1b2a",
    icons: []
  };
}
