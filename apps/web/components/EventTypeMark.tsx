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
  if (eventCategory(type) === "friendly") return <span className={`eventTypeMark friendlyMark ${size}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M3 19v-1.2A4.8 4.8 0 0 1 7.8 13h.4a4.8 4.8 0 0 1 4.8 4.8V19Zm12-5.5a4.2 4.2 0 0 1 6 3.8V19h-5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
  const logo = logoFor(type, game);
  return <span className={`eventTypeMark official ${game.toUpperCase() === "VGC" ? "vgc" : ""} ${size}`} aria-hidden="true">
    <img src={`${BASE_PATH}/logos/${logo}`} alt="" loading={size === "large" ? "eager" : "lazy"} />
  </span>;
}
