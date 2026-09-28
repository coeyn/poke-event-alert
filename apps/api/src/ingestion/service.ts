import type { Pool, PoolClient } from "pg";
import type {
  EventSource,
  SourceEvent,
  SourceFetchResult,
  SourceFetchScope
} from "../sources/types.js";
import {
  diffSnapshots,
  eventSnapshot,
  fallbackVenueId,
  snapshotHash,
  type EventSnapshot
} from "./snapshot.js";

type ExistingEventRow = {
  id: string;
  content_hash: string;
  normalized_payload: EventSnapshot;
  status: "active" | "missing" | "cancelled";
};

export type IngestionSummary = {
  source: string;
  runId: string;
  pagesFetched: number;
  newEvents: number;
  updatedEvents: number;
  unchangedEvents: number;
  missingEvents: number;
  warnings: string[];
};

function hasVenueData(event: SourceEvent): boolean {
  return Boolean(
    event.sourceVenueId ||
      event.leagueId ||
      event.venueName ||
      event.address ||
      event.city ||
      event.postalCode
  );
}

async function upsertVenue(
  client: PoolClient,
  event: SourceEvent,
  now: Date
): Promise<string | null> {
  if (!hasVenueData(event)) return null;

  const sourceVenueId = event.sourceVenueId ?? fallbackVenueId(event);
  const name =
    event.venueName ??
    (event.leagueId ? `Ligue ${event.leagueId}` : "Lieu non renseigné");

  const result = await client.query<{ id: string }>(
    `
      INSERT INTO venues (
        source,
        source_venue_id,
        league_id,
        name,
        address,
        city,
        postal_code,
        country_code,
        latitude,
        longitude,
        last_seen_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (source, source_venue_id)
      DO UPDATE SET
        league_id = COALESCE(EXCLUDED.league_id, venues.league_id),
        name = CASE
          WHEN EXCLUDED.name = 'Lieu non renseigné' THEN venues.name
          ELSE EXCLUDED.name
        END,
        address = COALESCE(EXCLUDED.address, venues.address),
        city = COALESCE(EXCLUDED.city, venues.city),
        postal_code = COALESCE(EXCLUDED.postal_code, venues.postal_code),
        country_code = COALESCE(EXCLUDED.country_code, venues.country_code),
        latitude = COALESCE(EXCLUDED.latitude, venues.latitude),
        longitude = COALESCE(EXCLUDED.longitude, venues.longitude),
        last_seen_at = EXCLUDED.last_seen_at
      RETURNING id
    `,
    [
      event.source,
      sourceVenueId,
      event.leagueId ?? null,
      name,
      event.address ?? null,
      event.city ?? null,
      event.postalCode ?? null,
      event.countryCode ?? null,
      event.latitude ?? null,
      event.longitude ?? null,
      now
    ]
  );

  return result.rows[0]?.id ?? null;
}

async function ingestOne(
  client: PoolClient,
  event: SourceEvent,
  now: Date
): Promise<"new" | "updated" | "unchanged"> {
  const snapshot = eventSnapshot(event);
  const hash = snapshotHash(snapshot);
  const venueId = await upsertVenue(client, event, now);

  const existing = await client.query<ExistingEventRow>(
    `
      SELECT id, content_hash, normalized_payload, status
      FROM events
      WHERE source = $1 AND source_event_id = $2
      FOR UPDATE
    `,
    [event.source, event.sourceEventId]
  );

  const previous = existing.rows[0];

  if (!previous) {
    await client.query(
      `
        INSERT INTO events (
          source,
          source_event_id,
          venue_id,
          title,
          event_type,
          game,
          starts_at,
          ends_at,
          registration_url,
          source_url,
          status,
          content_hash,
          first_seen_at,
          last_seen_at,
          raw_payload,
          normalized_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12,$12,$13,$14)
      `,
      [
        event.source,
        event.sourceEventId,
        venueId,
        event.title,
        event.eventType ?? null,
        event.game ?? null,
        event.startsAt,
        event.endsAt ?? null,
        event.registrationUrl ?? null,
        event.sourceUrl,
        hash,
        now,
        event.raw,
        snapshot
      ]
    );

    return "new";
  }

  const reappeared = previous.status === "missing";
  const changed = previous.content_hash !== hash;

  if (!changed && !reappeared) {
    await client.query(
      `
        UPDATE events
        SET
          venue_id = $2,
          last_seen_at = $3,
          raw_payload = $4,
          status = 'active',
          missing_since = NULL
        WHERE id = $1
      `,
      [previous.id, venueId, now, event.raw]
    );
    return "unchanged";
  }

  const changes = changed
    ? diffSnapshots(previous.normalized_payload, snapshot)
    : {
        status: {
          before: previous.status,
          after: "active"
        }
      };

  await client.query(
    `
      INSERT INTO event_revisions (
        event_id,
        detected_at,
        previous_hash,
        new_hash,
        changes
      )
      VALUES ($1,$2,$3,$4,$5)
    `,
    [previous.id, now, previous.content_hash, hash, changes]
  );

  await client.query(
    `
      UPDATE events
      SET
        venue_id = $2,
        title = $3,
        event_type = $4,
        game = $5,
        starts_at = $6,
        ends_at = $7,
        registration_url = $8,
        source_url = $9,
        status = 'active',
        content_hash = $10,
        last_seen_at = $11,
        missing_since = NULL,
        raw_payload = $12,
        normalized_payload = $13
      WHERE id = $1
    `,
    [
      previous.id,
      venueId,
      event.title,
      event.eventType ?? null,
      event.game ?? null,
      event.startsAt,
      event.endsAt ?? null,
      event.registrationUrl ?? null,
      event.sourceUrl,
      hash,
      now,
      event.raw,
      snapshot
    ]
  );

  return "updated";
}

async function markMissing(
  client: PoolClient,
  source: string,
  seenSourceEventIds: string[],
  now: Date,
  scope?: SourceFetchScope
): Promise<number> {
  const countryCodes =
    scope?.countryCodes && scope.countryCodes.length > 0
      ? scope.countryCodes
      : null;

  const result = await client.query(
    `
      UPDATE events AS e
      SET
        status = 'missing',
        missing_since = COALESCE(e.missing_since, $2)
      WHERE
        e.source = $1
        AND e.status = 'active'
        AND e.starts_at >= $2
        AND ($4::date IS NULL OR e.starts_at >= $4::date)
        AND ($5::date IS NULL OR e.starts_at < ($5::date + INTERVAL '1 day'))
        AND (
          $6::text[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM venues AS v
            WHERE
              v.id = e.venue_id
              AND UPPER(v.country_code) = ANY($6::text[])
          )
        )
        AND NOT (e.source_event_id = ANY($3::text[]))
    `,
    [
      source,
      now,
      seenSourceEventIds,
      scope?.startsFrom ?? null,
      scope?.startsUntil ?? null,
      countryCodes?.map((code) => code.toUpperCase()) ?? null
    ]
  );

  return result.rowCount ?? 0;
}

async function persistFetchResult(
  client: PoolClient,
  sourceName: string,
  result: SourceFetchResult,
  now: Date
): Promise<Omit<IngestionSummary, "source" | "runId" | "pagesFetched">> {
  let newEvents = 0;
  let updatedEvents = 0;
  let unchangedEvents = 0;

  for (const event of result.events) {
    const kind = await ingestOne(client, event, now);
    if (kind === "new") newEvents += 1;
    if (kind === "updated") updatedEvents += 1;
    if (kind === "unchanged") unchangedEvents += 1;
  }

  const warnings = [...result.warnings];
  let missingEvents = 0;

  if (!result.complete) {
    warnings.push(
      "Missing-event detection skipped because the source fetch was incomplete."
    );
  } else if (result.events.length === 0) {
    warnings.push(
      "Missing-event detection skipped because the complete fetch returned zero normalized events."
    );
  } else {
    missingEvents = await markMissing(
      client,
      sourceName,
      result.events.map((event) => event.sourceEventId),
      now,
      result.scope
    );
  }

  return {
    newEvents,
    updatedEvents,
    unchangedEvents,
    missingEvents,
    warnings
  };
}

export async function runSourceIngestion(
  pool: Pool,
  source: EventSource,
  now = new Date()
): Promise<IngestionSummary> {
  const run = await pool.query<{ id: string }>(
    `
      INSERT INTO ingestion_runs (source, started_at, status)
      VALUES ($1,$2,'running')
      RETURNING id
    `,
    [source.name, now]
  );
  const runId = run.rows[0]?.id;

  if (!runId) throw new Error("Could not create ingestion run");

  try {
    const result = await source.fetchEvents();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const stats = await persistFetchResult(client, source.name, result, now);

      await client.query(
        `
          UPDATE ingestion_runs
          SET
            finished_at = now(),
            status = 'succeeded',
            pages_fetched = $2,
            event_count = $3,
            warnings = $4
          WHERE id = $1
        `,
        [
          runId,
          result.pagesFetched,
          result.events.length,
          stats.warnings
        ]
      );

      await client.query("COMMIT");

      return {
        source: source.name,
        runId,
        pagesFetched: result.pagesFetched,
        ...stats
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await pool.query(
      `
        UPDATE ingestion_runs
        SET
          finished_at = now(),
          status = 'failed',
          error = $2
        WHERE id = $1
      `,
      [runId, error instanceof Error ? error.message : String(error)]
    );
    throw error;
  }
}
