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

type PokeDataPayload = {
  metadata?: {
    current_page?: number;
    total_pages?: number;
  };
  events?: Record<string, unknown>[];
};

const API = "https://pokedata.ovh/events/apiv2";
const MAX_PAGES = 15;

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function text(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeType(value: string) {
  const type = value.toLowerCase();
  if (type.includes("challenge")) return "Challenge";
  if (type.includes("cup")) return "Cup";
  if (type.includes("pre") && type.includes("release")) return "Avant-première";
  if (type.includes("nonpremier")) return "Tournoi";
  return value || "Événement";
}

function normalizeGame(row: Record<string, unknown>) {
  const raw = text(row, "Products", "product", "game", "type").toLowerCase();
  if (raw.includes("tcg")) return "JCC";
  if (raw.includes("vg")) return "VGC";
  if (raw.includes("go")) return "GO";
  return "Play!";
}

function normalize(row: Record<string, unknown>): PreviewEvent | null {
  const id = text(row, "guid", "Guid", "id");
  const venueName = text(row, "shop", "shop_name", "venue_name");
  const leagueId = text(row, "league", "league_id") || null;
  const when = text(row, "Start_date", "when", "start_datetime", "event_date", "date");
  const date = new Date(when.includes("T") ? when : when.replace(" ", "T"));
  if (!id || !venueName || Number.isNaN(date.getTime())) return null;

  const venueKey = leagueId ? `league:${leagueId}` : `name:${venueName.toLowerCase()}`;

  return {
    id,
    title: text(row, "name", "Name", "title") || "Événement Play! Pokémon",
    type: normalizeType(text(row, "type", "Subtype", "category")),
    game: normalizeGame(row),
    startsAt: date.toISOString(),
    sourceUrl: text(row, "pokemon_url", "Event_website", "url") || "https://play.pokemon.com/",
    venueKey,
    venueName,
    leagueId,
    city: text(row, "city"),
    address: text(row, "street_address", "address"),
    countryCode: text(row, "country_code") || "FR"
  };
}

export async function loadUpcomingFrance(days = 30): Promise<PreviewEvent[]> {
  const today = new Date();
  const start = dateOnly(today);
  const end = dateOnly(addDays(today, days));
  const base = `${API}/_country/FR/_start/${start}/_end/${end}`;

  const events: PreviewEvent[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = page === 1 ? base : `${base}/_page/${page}`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`PokéData HTTP ${response.status}`);

    const payload = (await response.json()) as PokeDataPayload;
    totalPages = Math.min(payload.metadata?.total_pages ?? 1, MAX_PAGES);

    for (const row of payload.events ?? []) {
      const item = normalize(row);
      if (item) events.push(item);
    }
    page += 1;
  } while (page <= totalPages);

  return Array.from(new Map(events.map((event) => [event.id, event])).values())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
