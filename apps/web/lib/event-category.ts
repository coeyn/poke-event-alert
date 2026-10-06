import type { PreviewEvent } from "./preview";

export type EventCategory = "cup" | "challenge" | "prerelease" | "other";

export const EVENT_CATEGORIES: { key: EventCategory; label: string; short: string }[] = [
  { key: "cup", label: "Cup", short: "C" },
  { key: "challenge", label: "Challenge", short: "Ch" },
  { key: "prerelease", label: "Avant-première", short: "AP" },
  { key: "other", label: "Autres", short: "+" }
];

export function eventCategory(type: string): EventCategory {
  const value = type.toLocaleLowerCase("fr-FR");
  if (value.includes("cup")) return "cup";
  if (value.includes("challenge")) return "challenge";
  if (value.includes("avant") || value.includes("prerelease")) return "prerelease";
  return "other";
}

export function eventCategoryCounts(events: PreviewEvent[]): Record<EventCategory, number> {
  const counts: Record<EventCategory, number> = { cup: 0, challenge: 0, prerelease: 0, other: 0 };
  for (const event of events) counts[eventCategory(event.type)] += 1;
  return counts;
}

export function eventCategorySummary(events: PreviewEvent[]): string {
  const counts = eventCategoryCounts(events);
  return EVENT_CATEGORIES.filter(({ key }) => counts[key] > 0)
    .map(({ key, label }) => {
      const name = key === "other" ? (counts[key] > 1 ? "autres événements" : "autre événement")
        : counts[key] > 1 ? `${label}s` : label;
      return `${counts[key]} ${name}`;
    })
    .join(", ");
}
