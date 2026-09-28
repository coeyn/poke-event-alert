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

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function loadUpcomingFrance(): Promise<PreviewEvent[]> {
  const response = await fetch(`${BASE_PATH}/data/events.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Preview data HTTP ${response.status}`);
  }

  const payload = (await response.json()) as PreviewData;
  return payload.events;
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
