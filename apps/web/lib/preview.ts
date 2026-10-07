export type PreviewEvent = {
  id: string;
  title: string;
  type: string;
  game: string;
  startsAt: string;
  publishedAt?: string | null;
  sourceUrl: string;
  venueKey: string;
  venueName: string;
  leagueId: string | null;
  city: string;
  address: string;
  countryCode: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type PreviewVenue = {
  key: string;
  name: string;
  leagueId: string | null;
  city: string;
  address: string;
  countryCode: string;
  latitude?: number | null;
  longitude?: number | null;
  events: PreviewEvent[];
};

export type PreviewData = {
  generatedAt: string;
  scope: { country: string; start: string; end: string; days: number };
  count: number;
  events: PreviewEvent[];
};

type ApiVenue = {
  id: string;
  source: string;
  sourceVenueId?: string | null;
  leagueId?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ApiEvent = {
  sourceEventId: string;
  title: string;
  eventType?: string | null;
  game?: string | null;
  startsAt: string;
  sourceUrl?: string | null;
  venue?: ApiVenue | null;
};

type ApiPage<T> = {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const LIVE_VENUE_CACHE_MS = 60_000;
const liveVenueCache = new Map<string, { expiresAt: number; venue: PreviewVenue }>();

function displayType(value: string | null | undefined, title = "") {
  const raw = value?.trim() ?? "";
  const type = raw.toLowerCase();
  const name = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (type.includes("friendly") || /friendly|echange|bourse|initiation|apprentissage|apprendre a jouer|learn to play|trade meetup/.test(name)) return "Friendly";
  if ((type.includes("pre") && type.includes("release")) || /avant.?premiere|pre.?release|\bap\b/.test(type) || /avant.?premiere|pre.?release|\bap\b/.test(name)) return "Avant-première";
  if (type.includes("challenge")) return "Challenge";
  if (type.includes("cup")) return "Cup";
  if (type.includes("nonpremier")) return "Tournoi";
  return raw || "Événement";
}

function displayGame(value: string | null | undefined, title = "") {
  const game = value?.trim().toLowerCase() ?? "";
  if (game.includes("tcg") || game.includes("jcc")) return "JCC";
  if (game === "vg" || game.includes("vgc") || game.includes("video game")) return "VGC";
  if (game === "go" || game.includes("pokemon go")) return "GO";
  const name = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/avant.?premiere|pre.?release|\bap\b/.test(name)) return "JCC";
  return value?.trim() || "Play!";
}

function mapApiEvent(event: ApiEvent, venueKey?: string): PreviewEvent | null {
  const venue = event.venue;
  if (!venue || !event.sourceEventId || !event.startsAt) return null;

  const venueName = venue.name?.trim() || "Lieu inconnu";
  const leagueId = venue.leagueId?.trim() || null;
  const resolvedVenueKey =
    venueKey ??
    (leagueId
      ? `league:${leagueId}`
      : venue.sourceVenueId
        ? `source:${venue.source}:${venue.sourceVenueId}`
        : `name:${venueName.toLowerCase()}`);

  return {
    id: event.sourceEventId,
    title: event.title || "Événement Play! Pokémon",
    type: displayType(event.eventType, event.title),
    game: displayGame(event.game, event.title),
    startsAt: event.startsAt,
    publishedAt: null,
    sourceUrl: event.sourceUrl || "https://play.pokemon.com/",
    venueKey: resolvedVenueKey,
    venueName,
    leagueId,
    city: venue.city || "",
    address: venue.address || "",
    countryCode: venue.countryCode || "FR",
    latitude: venue.latitude ?? null,
    longitude: venue.longitude ?? null
  };
}

export async function loadUpcomingSnapshot(): Promise<PreviewData> {
  const response = await fetch(`${BASE_PATH}/data/events.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Preview data HTTP ${response.status}`);
  }

  const payload = (await response.json()) as PreviewData;
  return {
    ...payload,
    events: payload.events.map((event) => ({
      ...event,
      type: displayType(event.type, event.title),
      game: displayGame(event.game, event.title)
    }))
  };
}

/**
 * General event/venue lists deliberately use the CDN-hosted snapshot.
 * This keeps high-traffic browsing off the small Synology backend.
 */
export async function loadUpcomingFrance(): Promise<PreviewEvent[]> {
  return (await loadUpcomingSnapshot()).events.map((event) => ({
    ...event,
    type: displayType(event.type, event.title)
  }));
}

function pickApiVenue(items: ApiVenue[], fallback: PreviewVenue) {
  if (fallback.leagueId) {
    const exactLeague = items.find(
      (item) => item.leagueId?.trim() === fallback.leagueId?.trim()
    );
    if (exactLeague) return exactLeague;
  }

  const targetName = fallback.name.trim().toLowerCase();
  const targetCity = fallback.city.trim().toLowerCase();

  return (
    items.find(
      (item) =>
        item.name?.trim().toLowerCase() === targetName &&
        (!targetCity || item.city?.trim().toLowerCase() === targetCity)
    ) ?? items.find((item) => item.name?.trim().toLowerCase() === targetName)
  );
}

/**
 * Refresh one venue only. A boutique page performs a small venue lookup,
 * then requests only that venue's future events. The snapshot remains the
 * fallback if the NAS/API is unavailable.
 */
export async function refreshVenueLive(fallback: PreviewVenue): Promise<PreviewVenue> {
  if (!API_BASE_URL) return fallback;

  const cached = liveVenueCache.get(fallback.key);
  if (cached && cached.expiresAt > Date.now()) return cached.venue;

  const search = fallback.leagueId || fallback.name;
  const params = new URLSearchParams({
    search,
    countryCode: fallback.countryCode || "FR",
    limit: "20"
  });

  const venueResponse = await fetch(`${API_BASE_URL}/venues?${params.toString()}`, {
    cache: "no-store"
  });
  if (!venueResponse.ok) throw new Error(`Venue API HTTP ${venueResponse.status}`);

  const venuePayload = (await venueResponse.json()) as ApiPage<ApiVenue>;
  const apiVenue = pickApiVenue(venuePayload.items ?? [], fallback);
  if (!apiVenue) return fallback;

  const events: PreviewEvent[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const eventParams = new URLSearchParams({
      limit: String(limit),
      offset: String(offset)
    });
    const eventResponse = await fetch(
      `${API_BASE_URL}/venues/${encodeURIComponent(apiVenue.id)}/events?${eventParams.toString()}`,
      { cache: "no-store" }
    );
    if (!eventResponse.ok) throw new Error(`Venue events API HTTP ${eventResponse.status}`);

    const eventPayload = (await eventResponse.json()) as ApiPage<ApiEvent>;
    for (const event of eventPayload.items ?? []) {
      const mapped = mapApiEvent(event, fallback.key);
      if (mapped) events.push(mapped);
    }

    if (!eventPayload.pagination?.hasMore || (eventPayload.items?.length ?? 0) === 0) break;
    offset += eventPayload.items.length;
  }

  const venue: PreviewVenue = {
    key: fallback.key,
    name: apiVenue.name || fallback.name,
    leagueId: apiVenue.leagueId?.trim() || fallback.leagueId,
    city: apiVenue.city || fallback.city,
    address: apiVenue.address || fallback.address,
    countryCode: apiVenue.countryCode || fallback.countryCode,
    latitude: apiVenue.latitude ?? fallback.latitude ?? null,
    longitude: apiVenue.longitude ?? fallback.longitude ?? null,
    events: Array.from(new Map(events.map((event) => [event.id, event])).values()).sort(
      (a, b) => a.startsAt.localeCompare(b.startsAt)
    )
  };

  liveVenueCache.set(fallback.key, {
    expiresAt: Date.now() + LIVE_VENUE_CACHE_MS,
    venue
  });

  return venue;
}

export function venuesFromEvents(events: PreviewEvent[]): PreviewVenue[] {
  const map = new Map<string, PreviewVenue>();

  for (const event of events) {
    const current = map.get(event.venueKey) ?? {
      key: event.venueKey,
      name: event.venueName,
      leagueId: event.leagueId,
      city: event.city,
      address: event.address,
      countryCode: event.countryCode,
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      events: []
    };
    current.events.push(event);
    map.set(event.venueKey, current);
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const FAVORITES_KEY = "poke-event-alert:preview-favorites";
// Cloud account sync is optional until Firebase is configured.
async function syncFavoritesToFirebase() {
  try {
    const { saveLocalProfileToFirebase } = await import("./firebase-profile");
    await saveLocalProfileToFirebase();
  } catch {
    // Keep local favorites usable when the cloud is unavailable.
  }
}

export function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function toggleFavorite(key: string): string[] {
  const set = new Set(readFavorites());
  if (set.has(key)) set.delete(key);
  else set.add(key);
  const values = [...set];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(values));
  void syncFavoritesToFirebase();
  return values;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
