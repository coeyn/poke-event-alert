export type BlockedVenue = { key: string; name: string; city: string };

const KEY = "poke-event-alert:blocked-venues";

export function readBlockedVenues(): BlockedVenue[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is BlockedVenue =>
      typeof item?.key === "string" && typeof item?.name === "string" && typeof item?.city === "string"
    );
  } catch {
    return [];
  }
}

export function setVenueBlocked(venue: BlockedVenue, blocked: boolean): BlockedVenue[] {
  const next = readBlockedVenues().filter((item) => item.key !== venue.key);
  if (blocked) next.push(venue);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("poke-settings-changed"));
  void saveLocalProfileToFirebase().catch(() => undefined);
  return next;
}
import { saveLocalProfileToFirebase } from "./firebase-profile";
