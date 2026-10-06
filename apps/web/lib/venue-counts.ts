import type { PreviewVenue } from "./preview";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const CACHE_MS = 60_000;
const cache = new Map<string, { count: number; expiresAt: number }>();

export async function loadLiveVenueCounts(
  venues: PreviewVenue[]
): Promise<Record<string, number>> {
  if (!API_BASE_URL || venues.length === 0) return {};

  const now = Date.now();
  const result: Record<string, number> = {};
  const missing: PreviewVenue[] = [];

  for (const venue of venues.slice(0, 100)) {
    const cached = cache.get(venue.key);
    if (cached && cached.expiresAt > now) {
      result[venue.key] = cached.count;
    } else {
      missing.push(venue);
    }
  }

  if (missing.length === 0) return result;

  const response = await fetch(`${API_BASE_URL}/venues/counts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      venues: missing.map((venue) => ({
        key: venue.key,
        leagueId: venue.leagueId,
        name: venue.name,
        city: venue.city
      }))
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Venue counts API HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    counts?: Array<{ key?: string; count?: number }>;
  };

  for (const item of payload.counts ?? []) {
    if (!item.key || !Number.isFinite(item.count)) continue;
    const count = Number(item.count);
    result[item.key] = count;
    cache.set(item.key, { count, expiresAt: now + CACHE_MS });
  }

  return result;
}
