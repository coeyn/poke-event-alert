import { eventCategory } from "../lib/event-category";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function logoFor(type: string, game: string) {
  const category = eventCategory(type);
  if (category === "prerelease") return "prerelease.png";
  if (category === "other") return "pokemon-league.png";

  const format = game.toUpperCase();
  const prefix = format === "GO" ? "go" : format === "VGC" ? "vgc" : format === "JCC" ? "tcg" : null;
  return prefix ? `${prefix}-${category}.png` : "pokemon-league.png";
}

export function EventTypeMark({ type, game, size = "normal" }: { type: string; game: string; size?: "normal" | "small" | "large" }) {
  const logo = logoFor(type, game);
  return <span className={`eventTypeMark official ${game.toUpperCase() === "VGC" ? "vgc" : ""} ${size}`} aria-hidden="true">
    <img src={`${BASE_PATH}/logos/${logo}`} alt="" loading={size === "large" ? "eager" : "lazy"} />
  </span>;
}
