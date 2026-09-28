import { mkdir, writeFile } from "node:fs/promises";

const API = "https://pokedata.ovh/events/apiv2";
const DAYS = Number(process.env.PREVIEW_DAYS ?? 30);
const MAX_PAGES = Number(process.env.PREVIEW_MAX_PAGES ?? 15);

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function text(row, ...keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeType(value) {
  const type = value.toLowerCase();
  if (type.includes("challenge")) return "Challenge";
  if (type.includes("cup")) return "Cup";
  if (type.includes("pre") && type.includes("release")) return "Avant-première";
  if (type.includes("nonpremier")) return "Tournoi";
  return value || "Événement";
}

function normalizeGame(row) {
  const raw = text(row, "Products", "product", "game", "type").toLowerCase();
  if (raw.includes("tcg")) return "JCC";
  if (raw.includes("vg")) return "VGC";
  if (raw.includes("go")) return "GO";
  return "Play!";
}

function normalize(row) {
  const id = text(row, "guid", "Guid", "id");
  const venueName = text(row, "shop", "shop_name", "venue_name");
  const leagueId = text(row, "league", "league_id") || null;
  const when = text(row, "Start_date", "when", "start_datetime", "event_date", "date");
  const date = new Date(when.includes("T") ? when : when.replace(" ", "T"));

  if (!id || !venueName || Number.isNaN(date.getTime())) return null;

  return {
    id,
    title: text(row, "name", "Name", "title") || "Événement Play! Pokémon",
    type: normalizeType(text(row, "type", "Subtype", "category")),
    game: normalizeGame(row),
    startsAt: date.toISOString(),
    sourceUrl: text(row, "pokemon_url", "Event_website", "url") || "https://play.pokemon.com/",
    venueKey: leagueId ? `league:${leagueId}` : `name:${venueName.toLowerCase()}`,
    venueName,
    leagueId,
    city: text(row, "city"),
    address: text(row, "street_address", "address"),
    countryCode: text(row, "country_code") || "FR"
  };
}

const now = new Date();
const start = dateOnly(now);
const end = dateOnly(addDays(now, DAYS));
const base = `${API}/_country/FR/_start/${start}/_end/${end}`;

const events = [];
let page = 1;
let totalPages = 1;

do {
  const url = page === 1 ? base : `${base}/_page/${page}`;
  console.log(`Fetch ${url}`);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "poke-event-alert-preview/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`PokéData HTTP ${response.status} on page ${page}`);
  }

  const payload = await response.json();
  totalPages = Math.min(payload.metadata?.total_pages ?? 1, MAX_PAGES);

  for (const row of payload.events ?? []) {
    const item = normalize(row);
    if (item) events.push(item);
  }

  page += 1;
} while (page <= totalPages);

const unique = Array.from(new Map(events.map((event) => [event.id, event])).values())
  .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

const output = {
  generatedAt: new Date().toISOString(),
  scope: { country: "FR", start, end, days: DAYS },
  count: unique.length,
  events: unique
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/data/events.json", import.meta.url),
  JSON.stringify(output),
  "utf8"
);

console.log(`Wrote ${unique.length} events to public/data/events.json`);
