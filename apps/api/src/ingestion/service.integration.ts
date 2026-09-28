import assert from "node:assert/strict";
import test from "node:test";
import { createPool } from "../db/pool.js";
import { runSourceIngestion } from "./service.js";
import type {
  EventSource,
  SourceEvent,
  SourceFetchResult
} from "../sources/types.js";

const pool = createPool();

function event(
  id: string,
  overrides: Partial<SourceEvent> = {}
): SourceEvent {
  return {
    source: "integration",
    sourceEventId: id,
    sourceUrl: `https://example.test/events/${id}`,
    title: `Event ${id}`,
    startsAt: "2026-10-10T12:00:00.000Z",
    venueName: "Boutique Test",
    sourceVenueId: "league:26029062",
    leagueId: "26029062",
    address: "1 rue du Test",
    city: "Saint-Brieuc",
    postalCode: "22000",
    countryCode: "FR",
    latitude: 48.514,
    longitude: -2.765,
    eventType: "challenge",
    game: "tcg",
    raw: { id },
    ...overrides
  };
}

class FakeSource implements EventSource {
  readonly name = "integration";

  constructor(private readonly result: SourceFetchResult) {}

  async fetchEvents(): Promise<SourceFetchResult> {
    return this.result;
  }
}

function result(events: SourceEvent[]): SourceFetchResult {
  return {
    events,
    warnings: [],
    pagesFetched: 1,
    complete: true,
    scope: {
      countryCodes: ["FR"],
      startsFrom: "2026-09-28",
      startsUntil: "2026-12-31"
    }
  };
}

test("ingestion is idempotent and detects updated/missing events", async () => {
  await pool.query(`
    TRUNCATE TABLE
      notifications,
      push_subscriptions,
      notification_preferences,
      venue_follows,
      event_revisions,
      events,
      venues,
      ingestion_runs,
      users
    RESTART IDENTITY CASCADE
  `);

  const now = new Date("2026-09-28T12:00:00.000Z");

  const first = await runSourceIngestion(
    pool,
    new FakeSource(result([
      event("one"),
      event("two", { startsAt: "2026-10-12T12:00:00.000Z" })
    ])),
    now
  );

  assert.equal(first.newEvents, 2);
  assert.equal(first.updatedEvents, 0);
  assert.equal(first.unchangedEvents, 0);
  assert.equal(first.missingEvents, 0);

  const venue = await pool.query<{ id: string }>(
    "SELECT id FROM venues WHERE source = 'integration' LIMIT 1"
  );
  const venueId = venue.rows[0]!.id;

  const user = await pool.query<{ id: string }>(
    "INSERT INTO users (display_name) VALUES ('Push Tester') RETURNING id"
  );
  const userId = user.rows[0]!.id;

  await pool.query(
    "INSERT INTO venue_follows (user_id, venue_id) VALUES ($1::uuid,$2::uuid)",
    [userId, venueId]
  );
  await pool.query(
    "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1::uuid,$2,$3,$4)",
    [userId, "https://push.example.test/integration", "p256dh", "auth"]
  );

  const second = await runSourceIngestion(
    pool,
    new FakeSource(result([
      event("one"),
      event("two", { startsAt: "2026-10-12T12:00:00.000Z" })
    ])),
    new Date("2026-09-28T13:00:00.000Z")
  );

  assert.equal(second.newEvents, 0);
  assert.equal(second.updatedEvents, 0);
  assert.equal(second.unchangedEvents, 2);
  assert.equal(second.missingEvents, 0);

  const afterUnchanged = await pool.query(
    "SELECT COUNT(*)::int AS count FROM notifications"
  );
  assert.equal(afterUnchanged.rows[0]?.count, 0);

  const third = await runSourceIngestion(
    pool,
    new FakeSource(result([
      event("one", {
        startsAt: "2026-10-10T13:00:00.000Z",
        title: "Event one — nouvelle heure"
      })
    ])),
    new Date("2026-09-28T14:00:00.000Z")
  );

  assert.equal(third.newEvents, 0);
  assert.equal(third.updatedEvents, 1);
  assert.equal(third.unchangedEvents, 0);
  assert.equal(third.missingEvents, 1);

  const events = await pool.query<{
    source_event_id: string;
    title: string;
    status: string;
    missing_since: Date | null;
  }>(`
    SELECT source_event_id, title, status, missing_since
    FROM events
    WHERE source = 'integration'
    ORDER BY source_event_id
  `);

  assert.deepEqual(
    events.rows.map((row) => ({
      id: row.source_event_id,
      title: row.title,
      status: row.status,
      missing: Boolean(row.missing_since)
    })),
    [
      {
        id: "one",
        title: "Event one — nouvelle heure",
        status: "active",
        missing: false
      },
      {
        id: "two",
        title: "Event two",
        status: "missing",
        missing: true
      }
    ]
  );

  const revisions = await pool.query<{
    changes: Record<string, { before: unknown; after: unknown }>;
  }>(`
    SELECT changes
    FROM event_revisions AS r
    JOIN events AS e ON e.id = r.event_id
    WHERE e.source = 'integration' AND e.source_event_id = 'one'
  `);

  assert.equal(revisions.rowCount, 1);
  assert.deepEqual(revisions.rows[0]?.changes.startsAt, {
    before: "2026-10-10T12:00:00.000Z",
    after: "2026-10-10T13:00:00.000Z"
  });
  assert.deepEqual(revisions.rows[0]?.changes.title, {
    before: "Event one",
    after: "Event one — nouvelle heure"
  });

  const updateNotifications = await pool.query<{
    kind: string;
    deduplication_key: string;
  }>(
    "SELECT kind, deduplication_key FROM notifications ORDER BY created_at"
  );
  assert.equal(updateNotifications.rowCount, 1);
  assert.equal(updateNotifications.rows[0]?.kind, "event_updated");

  const fourth = await runSourceIngestion(
    pool,
    new FakeSource(result([
      event("one", {
        startsAt: "2026-10-10T13:00:00.000Z",
        title: "Event one — nouvelle heure"
      }),
      event("three", { startsAt: "2026-10-20T18:00:00.000Z" })
    ])),
    new Date("2026-09-28T15:00:00.000Z")
  );

  assert.equal(fourth.newEvents, 1);
  assert.equal(fourth.updatedEvents, 0);
  assert.equal(fourth.unchangedEvents, 1);

  const allNotifications = await pool.query<{ kind: string }>(
    "SELECT kind FROM notifications ORDER BY created_at"
  );
  assert.deepEqual(
    allNotifications.rows.map((row) => row.kind).sort(),
    ["event_updated", "new_event"].sort()
  );
});

test.after(async () => {
  await pool.end();
});
