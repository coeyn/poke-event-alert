const EVENT_IDS = ["guid", "Guid", "event_guid", "eventGuid", "event_id", "eventId", "id"];
const STARTS = ["start_datetime", "startDateTime", "Start_date", "when", "starts_at", "startsAt", "datetime", "event_datetime"];
const normalizeText = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : undefined; }
function value(row, keys) {
  for (const key of keys) {
    const item = row?.[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number" || typeof item === "bigint") return String(item);
  }
  return "";
}
function nestedValues(row, keys) {
  for (const candidate of [row, record(row?.venue), record(row?.shop), record(row?.store), record(row?.league), record(row?.location)]) {
    const found = value(candidate, keys);
    if (found) return found;
  }
  return "";
}
function nestedNumber(row, keys) {
  for (const candidate of [row, record(row?.venue), record(row?.shop), record(row?.store), record(row?.league), record(row?.location)]) {
    const found = number(candidate, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}
function number(row, keys) {
  const raw = value(row, keys);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function parisOffsetMinutes(instant) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
    .formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  return match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0;
}
function parseDate(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const wall = Date.UTC(+match[1], +match[2] - 1, +match[3], +(match[4] ?? 0), +(match[5] ?? 0), +(match[6] ?? 0));
  let instant = wall - parisOffsetMinutes(wall) * 60_000;
  instant = wall - parisOffsetMinutes(instant) * 60_000;
  return new Date(instant);
}
function date(row, keys) {
  for (const key of keys) {
    const parsed = parseDate(row?.[key]);
    if (parsed) return parsed;
  }
  return undefined;
}
function eventType(raw, title, admission) {
  const type = normalizeText(raw);
  const name = normalizeText(title);
  if ((type.includes("pre") && type.includes("release")) || /avant.?premiere|pre.?release|\bap\b/.test(type) || /avant.?premiere|pre.?release|\bap\b/.test(name)) return "prerelease";
  if (type.includes("challenge")) return "challenge";
  if (type.includes("cup")) return "cup";
  if (type.includes("friendly") || /friendly|echange|bourse|initiation|apprentissage|apprendre a jouer|learn to play|trade meetup|entrainement|training/.test(name)) return "session_play";
  if (type.includes("nonpremier") || type.includes("tournament") || type.includes("tournoi")) return admission.trim() ? "tournament" : "session_play";
  return raw || undefined;
}
function game(raw, title) {
  const value = raw.toLowerCase();
  if (value.includes("tcg") || value.includes("jcc")) return "tcg";
  if (value.includes("vg") || value.includes("vgc")) return "vg";
  if (value.includes("go")) return "go";
  if (/avant.?premiere|pre.?release|\bap\b/.test(normalizeText(title))) return "tcg";
  return raw || undefined;
}

/** Canonical field mapping for PokéData's table and v2 endpoints. */
export function normalizePokeDataEvent(input) {
  const row = record(input);
  if (!row) return undefined;
  const id = value(row, EVENT_IDS);
  const title = value(row, ["name", "Name", "event_name", "eventName", "title"]) || "Événement Play! Pokémon";
  const startsAt = date(row, STARTS)?.toISOString() ?? (() => {
    const day = value(row, ["date", "event_date", "start_date"]);
    const time = value(row, ["time", "event_time", "start_time"]);
    return day ? parseDate(time ? `${day}T${time}` : day)?.toISOString() : undefined;
  })();
  if (!id || !startsAt) return undefined;
  const admission = value(row, ["cost", "Cost", "Admission", "admission", "entry_fee", "entryFee"]);
  let venueName = nestedValues(row, ["shop_name", "shopName", "venue_name", "venueName", "store_name", "storeName", "shop", "name"]);
  if (venueName === title) venueName = [row.venue, row.shop, row.store, row.location].map((nested) => value(record(nested), ["name", "shop_name", "venue_name"])).find((candidate) => candidate && candidate !== title) ?? "";
  const leagueId = nestedValues(row, ["league_id", "leagueId", "league", "league_identifier"]);
  const venueId = value(row, ["shop_id", "shopId", "venue_id", "venueId", "store_id", "storeId"])
    || [row.venue, row.shop, row.store, row.location].map((nested) => value(record(nested), ["id", "shop_id", "shopId", "venue_id", "venueId", "store_id", "storeId"])).find(Boolean)
    || (leagueId ? `league:${leagueId}` : undefined);
  const startSource = STARTS.some((key) => row[key] != null && row[key] !== "") ? row[STARTS.find((key) => row[key] != null && row[key] !== "")] : value(row, ["date", "event_date", "start_date"]);
  const endsAt = date(row, ["end_datetime", "endDateTime", "ends_at", "endsAt", "end_date"])?.toISOString();
  const latitude = nestedNumber(row, ["latitude", "lat"]);
  const longitude = nestedNumber(row, ["longitude", "lng", "lon", "long"]);
  const output = {
    id,
    title,
    type: eventType(value(row, ["event_type", "eventType", "type", "Subtype", "category", "tournament_type"]), title, admission),
    game: game(value(row, ["game", "game_type", "gameType", "discipline", "Products", "product"]), title),
    admission: admission || undefined,
    startsAt,
    endsAt,
    allDay: !/[T ]\d{2}:\d{2}/.test(String(startSource ?? "")),
    sourceUrl: value(row, ["source_url", "sourceUrl", "event_url", "eventUrl", "details_url", "pokemon_url", "Event_website", "url"]) || "https://pokedata.ovh/events/",
    registrationUrl: value(row, ["registration_url", "registrationUrl", "register_url", "registerUrl", "Third_party_registration_website", "registration"]) || undefined,
    venueName: venueName && venueName !== title ? venueName : undefined,
    venueId: venueId && venueId !== id ? venueId : undefined,
    leagueId: leagueId || undefined,
    address: nestedValues(row, ["address", "address1", "street", "street_address"] ) || undefined,
    city: nestedValues(row, ["city", "locality"]) || undefined,
    postalCode: nestedValues(row, ["postal_code", "postalCode", "postcode", "zip"]) || undefined,
    countryCode: nestedValues(row, ["country_code", "countryCode", "country"]) || undefined,
    latitude: latitude !== undefined && Math.abs(latitude) <= 90 ? latitude : undefined,
    longitude: longitude !== undefined && Math.abs(longitude) <= 180 ? longitude : undefined
  };
  return output;
}
