import type {
  EventSource,
  SourceEvent,
  SourceFetchResult
} from "../types.js";
import { normalizePokeDataEvent } from "./normalize.js";

type JsonRecord = Record<string, unknown>;

const DEFAULT_ENDPOINT = "https://pokedata.ovh/events/apiv2";
const DEFAULT_MAX_PAGES = 100;
const DEFAULT_COUNTRIES = ["FR"];
const DEFAULT_DAYS_AHEAD = 180;

export type PokeDataSourceOptions = {
  endpoint?: string;
  maxPages?: number;
  fetchImpl?: typeof fetch;
  countryCodes?: string[];
  startDate?: string;
  endDate?: string;
  daysAhead?: number;
  now?: Date;
};

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function getPath(record: JsonRecord | undefined, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    const object = asRecord(current);
    if (!object) return undefined;
    current = object[key];
  }
  return current;
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];

  const candidates = [
    record.events,
    record.results,
    record.data,
    record.items,
    getPath(record, ["data", "events"]),
    getPath(record, ["data", "results"]),
    getPath(record, ["data", "items"])
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function envCountries(): string[] {
  const raw = process.env.POKEDATA_COUNTRIES;
  if (!raw) return DEFAULT_COUNTRIES;
  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function appendSegments(url: URL, segments: string[]): URL {
  const result = new URL(url);
  const existing = result.pathname.replace(/\/$/, "");
  const encoded = segments.map((segment) => encodeURIComponent(segment));
  result.pathname = `${existing}/${encoded.join("/")}`;
  return result;
}

function buildFilteredUrl(
  endpoint: string,
  countryCodes: string[],
  startDate: string,
  endDate: string
): URL {
  let url = new URL(endpoint);

  if (countryCodes.length > 0) {
    url = appendSegments(url, ["_country", ...countryCodes]);
  }

  url = appendSegments(url, ["_start", startDate, "_end", endDate]);
  return url;
}

function pageUrl(currentUrl: URL, page: number): URL {
  const result = new URL(currentUrl);
  const segments = result.pathname.split("/").filter(Boolean);
  const pageIndex = segments.lastIndexOf("_page");

  if (pageIndex >= 0) {
    if (segments[pageIndex + 1] !== undefined) {
      segments[pageIndex + 1] = String(page);
    } else {
      segments.push(String(page));
    }
  } else {
    segments.push("_page", String(page));
  }

  result.pathname = `/${segments.join("/")}`;
  return result;
}

function nextUrlFromPayload(payload: unknown, currentUrl: URL): URL | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;

  const currentPage =
    numberFrom(getPath(record, ["metadata", "current_page"])) ??
    numberFrom(getPath(record, ["pagination", "page"])) ??
    numberFrom(getPath(record, ["meta", "page"])) ??
    numberFrom(record.page);

  const totalPages =
    numberFrom(getPath(record, ["metadata", "total_pages"])) ??
    numberFrom(getPath(record, ["pagination", "total_pages"])) ??
    numberFrom(getPath(record, ["pagination", "totalPages"])) ??
    numberFrom(getPath(record, ["meta", "total_pages"])) ??
    numberFrom(getPath(record, ["meta", "totalPages"])) ??
    numberFrom(record.total_pages) ??
    numberFrom(record.totalPages);

  if (
    currentPage !== undefined &&
    totalPages !== undefined &&
    currentPage < totalPages
  ) {
    return pageUrl(currentUrl, currentPage + 1);
  }

  const directNext = [
    record.next,
    record.next_url,
    record.nextUrl,
    getPath(record, ["links", "next"]),
    getPath(record, ["pagination", "next"]),
    getPath(record, ["meta", "next"])
  ]
    .map(stringFrom)
    .find(Boolean);

  return directNext ? new URL(directNext, currentUrl) : undefined;
}

export class PokeDataSource implements EventSource {
  readonly name = "pokedata";

  private readonly endpoint: string;
  private readonly maxPages: number;
  private readonly fetchImpl: typeof fetch;
  private readonly countryCodes: string[];
  private readonly startDate: string;
  private readonly endDate: string;

  constructor(options: PokeDataSourceOptions = {}) {
    const now = options.now ?? new Date();
    const daysAhead =
      options.daysAhead ??
      Number(process.env.POKEDATA_DAYS_AHEAD ?? DEFAULT_DAYS_AHEAD);

    this.endpoint =
      options.endpoint ?? process.env.POKEDATA_EVENTS_API_URL ?? DEFAULT_ENDPOINT;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.countryCodes = (options.countryCodes ?? envCountries()).map((code) =>
      code.toUpperCase()
    );
    this.startDate = options.startDate ?? dateOnly(now);
    this.endDate = options.endDate ?? dateOnly(addDays(now, daysAhead));
  }

  async fetchEvents(): Promise<SourceFetchResult> {
    const events: SourceEvent[] = [];
    const warnings: string[] = [];
    const seenUrls = new Set<string>();

    let pageUrl: URL | undefined = buildFilteredUrl(
      this.endpoint,
      this.countryCodes,
      this.startDate,
      this.endDate
    );
    let pagesFetched = 0;
    let complete = true;

    while (pageUrl && pagesFetched < this.maxPages) {
      if (seenUrls.has(pageUrl.toString())) {
        warnings.push(`Pagination loop detected at ${pageUrl.toString()}`);
        complete = false;
        break;
      }
      seenUrls.add(pageUrl.toString());

      const response = await this.fetchImpl(pageUrl, {
        headers: {
          accept: "application/json",
          "user-agent": "poke-event-alert/0.1 (+https://github.com/coeyn/poke-event-alert)"
        },
        signal: AbortSignal.timeout(20_000)
      });

      if (!response.ok) {
        throw new Error(
          `PokéData request failed: ${response.status} ${response.statusText} (${pageUrl.toString()})`
        );
      }

      const payload: unknown = await response.json();
      pagesFetched += 1;

      const rows = extractRows(payload);
      if (rows.length === 0) {
        warnings.push(`No event rows found on page ${pagesFetched}`);
      }

      for (const row of rows) {
        const normalized = normalizePokeDataEvent(row);
        if (normalized) {
          events.push(normalized);
        } else {
          warnings.push(
            `Skipped one PokéData row without a stable id or valid start date on page ${pagesFetched}`
          );
        }
      }

      pageUrl = nextUrlFromPayload(payload, pageUrl);
    }

    if (pageUrl && pagesFetched >= this.maxPages) {
      complete = false;
      warnings.push(
        `Stopped after maxPages=${this.maxPages}; more PokéData pages may exist`
      );
    }

    const uniqueEvents = Array.from(
      new Map(events.map((event) => [event.sourceEventId, event])).values()
    );

    if (uniqueEvents.length !== events.length) {
      warnings.push(
        `Deduplicated ${events.length - uniqueEvents.length} event(s) by sourceEventId`
      );
    }

    return {
      events: uniqueEvents,
      warnings,
      pagesFetched,
      complete,
      scope: {
        countryCodes: [...this.countryCodes],
        startsFrom: this.startDate,
        startsUntil: this.endDate
      }
    };
  }
}
