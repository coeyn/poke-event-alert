import type {
  EventSource,
  SourceFetchResult
} from "../types.js";
import { normalizePokeDataEvent } from "./normalize.js";

type JsonRecord = Record<string, unknown>;

const DEFAULT_ENDPOINT = "https://pokedata.ovh/events/apiv2";
const DEFAULT_MAX_PAGES = 100;

export type PokeDataSourceOptions = {
  endpoint?: string;
  maxPages?: number;
  fetchImpl?: typeof fetch;
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

function nextUrlFromPayload(payload: unknown, currentUrl: URL): URL | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;

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

  if (directNext) return new URL(directNext, currentUrl);

  const page =
    numberFrom(getPath(record, ["pagination", "page"])) ??
    numberFrom(getPath(record, ["meta", "page"])) ??
    numberFrom(record.page);

  const totalPages =
    numberFrom(getPath(record, ["pagination", "total_pages"])) ??
    numberFrom(getPath(record, ["pagination", "totalPages"])) ??
    numberFrom(getPath(record, ["meta", "total_pages"])) ??
    numberFrom(getPath(record, ["meta", "totalPages"])) ??
    numberFrom(record.total_pages) ??
    numberFrom(record.totalPages);

  if (page !== undefined && totalPages !== undefined && page < totalPages) {
    const next = new URL(currentUrl);
    next.searchParams.set("page", String(page + 1));
    return next;
  }

  return undefined;
}

export class PokeDataSource implements EventSource {
  readonly name = "pokedata";

  private readonly endpoint: string;
  private readonly maxPages: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PokeDataSourceOptions = {}) {
    this.endpoint =
      options.endpoint ?? process.env.POKEDATA_EVENTS_API_URL ?? DEFAULT_ENDPOINT;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchEvents(): Promise<SourceFetchResult> {
    const events = [];
    const warnings: string[] = [];
    const seenUrls = new Set<string>();

    let pageUrl: URL | undefined = new URL(this.endpoint);
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
      complete
    };
  }
}
