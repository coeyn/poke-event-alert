export type PreviewEvent = {
  id: string;
  title: string;
  type: string;
  game: string;
  startsAt: string;
  sourceUrl: string;
  venueKey: string;
  venueName: string;
  leagueId: string | null;
  city: string;
  address: string;
  countryCode: string;
};

export type PreviewVenue = {
  key: string;
  name: string;
  leagueId: string | null;
  city: string;
  address: string;
  countryCode: string;
  events: PreviewEvent[];
};

type PreviewData = {
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

type ApiPage = {
  items: ApiEvent[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

function displayType(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  const type = raw.toLowerCase();
  if (type.includes("challenge")) return "Challenge";
  if (type.includes("cup")) return "Cup";
  if (type.includes("pre") && type.includes("release")) return "Avant-première";
  if (type.includes("nonpremier")) return "Tournoi";
  return raw || "Événement";
}

function mapApiEvent(event: ApiEvent): PreviewEvent | null {
  const venue = event.venue;
  if (!venue || !event.sourceEventId || !event.startsAt) return null;

  const venueName = venue.name?.trim() || "Lieu inconnu";
  const leagueId = venue.leagueId?.trim() || null;
  const venueKey = leagueId
    ? `league:${leagueId}`
    : venue.sourceVenueId
      ? `source:${venue.source}:${venue.sourceVenueId}`
      : `name:${venueName.toLowerCase()}`;

  return {
    id: event.sourceEventId,
    title: event.title || "Événement Play! Pokémon",
    type: displayType(event.eventType),
    game: event.game || "Play!",
    startsAt: event.startsAt,
    sourceUrl: event.sourceUrl || "https://play.pokemon.com/",
    venueKey,
    venueName,
    leagueId,
    city: venue.city || "",
    address: venue.address || "",
    countryCode: venue.countryCode || "FR"
  };
}

async function loadLiveUpcomingFrance(): Promise<PreviewEvent[]> {
  if (!API_BASE_URL) throw new Error("Live API not configured");

  const items: PreviewEvent[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      countryCode: "FR",
      limit: String(limit),
      offset: String(offset)
    });

    const response = await fetch(`${API_BASE_URL}/events?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Live API HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ApiPage;
    for (const event of payload.items ?? []) {
      const mapped = mapApiEvent(event);
      if (mapped) items.push(mapped);
    }

    if (!payload.pagination?.hasMore || (payload.items?.length ?? 0) === 0) break;
    offset += payload.items.length;
  }

  return Array.from(new Map(items.map((event) => [event.id, event])).values()).sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt)
  );
}

async function loadStaticUpcomingFrance(): Promise<PreviewEvent[]> {
  const response = await fetch(`${BASE_PATH}/data/events.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Preview data HTTP ${response.status}`);
  }

  const payload = (await response.json()) as PreviewData;
  return payload.events;
}

export async function loadUpcomingFrance(): Promise<PreviewEvent[]> {
  try {
    return await loadLiveUpcomingFrance();
  } catch {
    return loadStaticUpcomingFrance();
  }
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
      events: []
    };
    current.events.push(event);
    map.set(event.venueKey, current);
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const FAVORITES_KEY = "poke-event-alert:preview-favorites";

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
