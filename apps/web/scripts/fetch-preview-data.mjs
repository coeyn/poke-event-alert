import { mkdir, writeFile } from "node:fs/promises";
import { normalizePokeDataEvent } from "@poke-event-alert/pokedata-normalization";

const API = "https://www.pokedata.ovh/events/tableapi/index_table.php";
const DAYS = Number(process.env.PREVIEW_DAYS ?? 30);
const MAX_PAGES = Number(process.env.PREVIEW_MAX_PAGES ?? 40);

function dateOnly(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (key) => parts.find((part) => part.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function normalize(row) {
  const event = normalizePokeDataEvent(row);
  if (!event?.venueName) return null;
  return {
    id: event.id,
    title: event.title,
    type: ({ prerelease: "Avant-première", challenge: "Challenge", cup: "Cup", session_play: "Session Play", tournament: "Tournoi" })[event.type] ?? event.type ?? "Événement",
    game: ({ tcg: "JCC", vg: "VGC", go: "GO" })[event.game] ?? "Play!",
    admission: event.admission ?? null,
    startsAt: event.startsAt,
    allDay: event.allDay,
    publishedAt: (typeof row.date_added === "string" && row.date_added.trim()) || (typeof row.created_at === "string" && row.created_at.trim()) || (typeof row.published_at === "string" && row.published_at.trim()) || null,
    sourceUrl: event.sourceUrl || "https://play.pokemon.com/",
    venueKey: event.leagueId ? `league:${event.leagueId}` : event.venueId ? `pokedata:${event.venueId}` : `name:${event.venueName.toLowerCase()}`,
    venueName: event.venueName,
    leagueId: event.leagueId ?? null,
    city: event.city ?? "",
    address: event.address ?? "",
    countryCode: event.countryCode || "FR",
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null
  };
}

const now = new Date();
const start = dateOnly(now);
const end = dateOnly(addDays(now, DAYS));
const events = [];
let page = 0;
let hasMorePages = true;

while (page < MAX_PAGES && hasMorePages) {
  console.log(`Fetch PokéData table page ${page + 1}`);

  const response = await fetch(API, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "poke-event-alert-preview/0.1"
    },
    body: JSON.stringify({
      page,
      past: false,
      country: "FR",
      city: "",
      shop: "",
      league: "",
      states: "[]",
      postcode: "",
      cups: true,
      challenges: true,
      vcups: true,
      vchallenges: true,
      prereleases: true,
      premier: true,
      go: true,
      gocup: true,
      mss: true,
      ftcg: true,
      fvg: true,
      fgo: true,
      latitude: 0,
      longitude: 0,
      radius: 0,
      unit: "km",
      width: 1200
    })
  });

  if (!response.ok) {
    throw new Error(`PokéData HTTP ${response.status} on page ${page}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("PokéData table returned an invalid event list");
  if (rows.length === 0) break;

  for (const row of rows) {
    const item = normalize(row);
    const eventDay = item ? dateOnly(new Date(item.startsAt)) : "";
    if (item && eventDay >= start && eventDay <= end) events.push(item);
  }

  hasMorePages = rows.length === 100 && String(rows.at(-1)?.date ?? "") <= end;
  page += 1;
}

if (hasMorePages && page >= MAX_PAGES) {
  console.warn(`Stopped after MAX_PAGES=${MAX_PAGES}; remaining PokéData pages were outside the preview window or not fetched.`);
}

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
