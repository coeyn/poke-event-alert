import { createHash } from "node:crypto";
import type { SourceEvent } from "../sources/types.js";

export type EventSnapshot = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  sourceUrl: string;
  registrationUrl: string | null;
  eventType: string | null;
  game: string | null;
  venue: {
    sourceVenueId: string | null;
    leagueId: string | null;
    name: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    countryCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
};

export type SnapshotChanges = Record<
  string,
  {
    before: unknown;
    after: unknown;
  }
>;

export function eventSnapshot(event: SourceEvent): EventSnapshot {
  return {
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    sourceUrl: event.sourceUrl,
    registrationUrl: event.registrationUrl ?? null,
    eventType: event.eventType ?? null,
    game: event.game ?? null,
    venue: {
      sourceVenueId: event.sourceVenueId ?? null,
      leagueId: event.leagueId ?? null,
      name: event.venueName ?? null,
      address: event.address ?? null,
      city: event.city ?? null,
      postalCode: event.postalCode ?? null,
      countryCode: event.countryCode ?? null,
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null
    }
  };
}

export function snapshotHash(snapshot: EventSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function flatten(
  value: unknown,
  prefix = "",
  output: Record<string, unknown> = {}
): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }

  output[prefix] = value;
  return output;
}

export function diffSnapshots(
  before: EventSnapshot,
  after: EventSnapshot
): SnapshotChanges {
  const left = flatten(before);
  const right = flatten(after);
  const changes: SnapshotChanges = {};

  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!Object.is(left[key], right[key])) {
      changes[key] = {
        before: left[key],
        after: right[key]
      };
    }
  }

  return changes;
}

export function fallbackVenueId(event: SourceEvent): string {
  const identity = [
    event.leagueId ?? "",
    event.venueName ?? "",
    event.address ?? "",
    event.city ?? "",
    event.postalCode ?? "",
    event.countryCode ?? ""
  ].join("|");

  return `fallback:${createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 24)}`;
}
