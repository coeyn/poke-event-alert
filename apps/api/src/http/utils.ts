export function stringParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function stringList(value: unknown): string[] | null {
  const raw = stringParam(value);
  if (!raw) return null;
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

export function positiveInt(
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  const raw = stringParam(value);
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export function dateParam(value: unknown): string | null {
  const raw = stringParam(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function mapVenue(row: Record<string, unknown>) {
  const count =
    row.upcoming_event_count === undefined
      ? undefined
      : Number(row.upcoming_event_count);

  return {
    id: row.venue_id ?? row.id,
    source: row.venue_source ?? row.source,
    sourceVenueId: row.source_venue_id,
    leagueId: row.league_id,
    name: row.venue_name ?? row.name,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
    sourceUrl: row.venue_source_url ?? row.source_url,
    ...(count !== undefined ? { upcomingEventCount: count } : {})
  };
}

export function mapEvent(row: Record<string, unknown>) {
  const venue = row.venue_id
    ? mapVenue({
        venue_id: row.venue_id,
        venue_source: row.venue_source,
        source_venue_id: row.source_venue_id,
        league_id: row.league_id,
        venue_name: row.venue_name,
        address: row.address,
        city: row.city,
        postal_code: row.postal_code,
        country_code: row.country_code,
        latitude: row.latitude,
        longitude: row.longitude,
        venue_source_url: row.venue_source_url
      })
    : null;

  return {
    id: row.id,
    source: row.source,
    sourceEventId: row.source_event_id,
    title: row.title,
    eventType: row.event_type,
    game: row.game,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    registrationUrl: row.registration_url,
    sourceUrl: row.source_url,
    status: row.status,
    missingSince: iso(row.missing_since),
    venue
  };
}
