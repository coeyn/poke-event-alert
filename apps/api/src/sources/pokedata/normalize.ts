import type { SourceEvent } from "../types.js";

type JsonRecord = Record<string, unknown>;

const POKEDATA_EVENT_PAGE = "https://pokedata.ovh/events/";

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function firstValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function stringValue(record: JsonRecord, keys: string[]): string | undefined {
  const value = firstValue(record, keys);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
}

function numberValue(record: JsonRecord, keys: string[]): number | undefined {
  const value = firstValue(record, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function nestedRecords(record: JsonRecord): JsonRecord[] {
  const candidates = [
    record,
    asRecord(record.venue),
    asRecord(record.shop),
    asRecord(record.store),
    asRecord(record.league),
    asRecord(record.location)
  ];
  return candidates.filter((value): value is JsonRecord => Boolean(value));
}

function lookupString(record: JsonRecord, keys: string[]): string | undefined {
  for (const candidate of nestedRecords(record)) {
    const value = stringValue(candidate, keys);
    if (value) return value;
  }
  return undefined;
}

function lookupNumber(record: JsonRecord, keys: string[]): number | undefined {
  for (const candidate of nestedRecords(record)) {
    const value = numberValue(candidate, keys);
    if (value !== undefined) return value;
  }
  return undefined;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function combineDateAndTime(record: JsonRecord): string | undefined {
  const date = stringValue(record, ["date", "event_date", "start_date"]);
  const time = stringValue(record, ["time", "event_time", "start_time"]);
  if (!date) return undefined;
  return isoDate(time ? `${date}T${time}` : date);
}

function normalizeEventType(record: JsonRecord): string | undefined {
  const raw = stringValue(record, [
    "event_type",
    "eventType",
    "type",
    "category",
    "tournament_type"
  ]);
  if (!raw) return undefined;

  const value = raw.toLowerCase();
  if (value.includes("challenge")) return "challenge";
  if (value.includes("cup")) return "cup";
  if (value.includes("pre") && value.includes("release")) return "prerelease";
  if (value.includes("friendly")) return "friendly";
  return raw;
}

function normalizeGame(record: JsonRecord): string | undefined {
  const raw = stringValue(record, ["game", "game_type", "gameType", "discipline"]);
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (value.includes("tcg") || value.includes("jcc")) return "tcg";
  if (value.includes("vg") || value.includes("vgc")) return "vg";
  if (value.includes("go")) return "go";
  return raw;
}

export function normalizePokeDataEvent(input: unknown): SourceEvent | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  const sourceEventId = stringValue(record, [
    "guid",
    "event_guid",
    "eventGuid",
    "event_id",
    "eventId",
    "id"
  ]);

  const title =
    stringValue(record, ["name", "event_name", "eventName", "title"]) ??
    "Événement Play! Pokémon";

  const startsAt =
    isoDate(
      firstValue(record, [
        "start_datetime",
        "startDateTime",
        "starts_at",
        "startsAt",
        "datetime",
        "event_datetime"
      ])
    ) ??
    combineDateAndTime(record) ??
    isoDate(firstValue(record, ["event_date", "date", "start_date"]));

  if (!sourceEventId || !startsAt) return undefined;

  const endsAt = isoDate(
    firstValue(record, [
      "end_datetime",
      "endDateTime",
      "ends_at",
      "endsAt",
      "end_date"
    ])
  );

  const sourceUrl =
    stringValue(record, [
      "source_url",
      "sourceUrl",
      "event_url",
      "eventUrl",
      "details_url",
      "url"
    ]) ?? POKEDATA_EVENT_PAGE;

  const registrationUrl = stringValue(record, [
    "registration_url",
    "registrationUrl",
    "register_url",
    "registerUrl",
    "registration"
  ]);

  const event: SourceEvent = {
    source: "pokedata",
    sourceEventId,
    sourceUrl,
    title,
    startsAt,
    raw: input
  };

  if (endsAt) event.endsAt = endsAt;

  const venueName = lookupString(record, [
    "shop_name",
    "shopName",
    "venue_name",
    "venueName",
    "store_name",
    "storeName",
    "name"
  ]);
  if (venueName && venueName !== title) event.venueName = venueName;

  const sourceVenueId = lookupString(record, [
    "shop_id",
    "shopId",
    "venue_id",
    "venueId",
    "store_id",
    "storeId",
    "id"
  ]);
  if (sourceVenueId && sourceVenueId !== sourceEventId) {
    event.sourceVenueId = sourceVenueId;
  }

  const leagueId = lookupString(record, [
    "league_id",
    "leagueId",
    "league",
    "league_identifier"
  ]);
  if (leagueId) event.leagueId = leagueId;

  const address = lookupString(record, [
    "address",
    "address1",
    "street",
    "street_address"
  ]);
  if (address) event.address = address;

  const city = lookupString(record, ["city", "locality"]);
  if (city) event.city = city;

  const postalCode = lookupString(record, [
    "postal_code",
    "postalCode",
    "postcode",
    "zip"
  ]);
  if (postalCode) event.postalCode = postalCode;

  const countryCode = lookupString(record, [
    "country_code",
    "countryCode",
    "country"
  ]);
  if (countryCode) event.countryCode = countryCode;

  const latitude = lookupNumber(record, ["latitude", "lat"]);
  if (latitude !== undefined) event.latitude = latitude;

  const longitude = lookupNumber(record, ["longitude", "lng", "lon", "long"]);
  if (longitude !== undefined) event.longitude = longitude;

  const eventType = normalizeEventType(record);
  if (eventType) event.eventType = eventType;

  const game = normalizeGame(record);
  if (game) event.game = game;

  if (registrationUrl) event.registrationUrl = registrationUrl;

  return event;
}
