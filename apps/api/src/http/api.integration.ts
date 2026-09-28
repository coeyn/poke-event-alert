import assert from "node:assert/strict";
import test from "node:test";
import { createPool } from "../db/pool.js";
import { createApp } from "./app.js";

process.env.NODE_ENV = "test";
process.env.WEB_PUSH_PUBLIC_KEY = "test-public-key";

const pool = createPool();
const app = createApp(pool);

test("HTTP API exposes events, venues, follows and preferences", async () => {
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

  const venue = await pool.query<{ id: string }>(`
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
      longitude
    )
    VALUES (
      'pokedata',
      'league:26029062',
      '26029062',
      'BD TEST',
      '1 rue du Test',
      'Saint-Brieuc',
      '22000',
      'FR',
      48.514,
      -2.765
    )
    RETURNING id
  `);

  const venueId = venue.rows[0]!.id;

  const event = await pool.query<{ id: string }>(
    `
      INSERT INTO events (
        source,
        source_event_id,
        venue_id,
        title,
        event_type,
        game,
        starts_at,
        source_url,
        status,
        content_hash
      )
      VALUES (
        'pokedata',
        'event-api-test',
        $1::uuid,
        'League Challenge de test',
        'challenge',
        'tcg',
        now() + INTERVAL '30 days',
        'https://example.test/event',
        'active',
        'api-test-hash'
      )
      RETURNING id
    `,
    [venueId]
  );

  const eventId = event.rows[0]!.id;

  const health = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: "https://coeyn.github.io" }
  });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true });
  assert.equal(
    health.headers["access-control-allow-origin"],
    "https://coeyn.github.io"
  );

  const venueSearch = await app.inject({
    method: "GET",
    url: "/venues?search=26029062&countryCode=FR"
  });
  assert.equal(venueSearch.statusCode, 200);
  const venuePayload = venueSearch.json();
  assert.equal(venuePayload.pagination.total, 1);
  assert.equal(venuePayload.items[0].id, venueId);
  assert.equal(venuePayload.items[0].name, "BD TEST");
  assert.equal(venuePayload.items[0].upcomingEventCount, 1);

  const events = await app.inject({
    method: "GET",
    url: "/events?eventType=challenge&game=tcg&countryCode=FR"
  });
  assert.equal(events.statusCode, 200);
  const eventsPayload = events.json();
  assert.equal(eventsPayload.pagination.total, 1);
  assert.equal(eventsPayload.items[0].id, eventId);
  assert.equal(eventsPayload.items[0].venue.id, venueId);
  assert.equal(eventsPayload.items[0].venue.leagueId, "26029062");

  const eventDetail = await app.inject({
    method: "GET",
    url: `/events/${eventId}`
  });
  assert.equal(eventDetail.statusCode, 200);
  assert.equal(eventDetail.json().title, "League Challenge de test");

  const calendar = await app.inject({
    method: "GET",
    url: `/events/${eventId}/calendar.ics`
  });
  assert.equal(calendar.statusCode, 200);
  assert.match(calendar.headers["content-type"] ?? "", /^text\/calendar/);
  assert.match(calendar.body, /BEGIN:VCALENDAR/);
  assert.match(calendar.body, /SUMMARY:League Challenge de test/);
  assert.match(calendar.body, /LOCATION:BD TEST/);
  assert.match(calendar.body, /END:VCALENDAR/);

  const user = await app.inject({
    method: "POST",
    url: "/users",
    payload: { displayName: "Testeur" }
  });
  assert.equal(user.statusCode, 201);
  const userId = user.json().id as string;
  assert.ok(userId);

  const pushKey = await app.inject({
    method: "GET",
    url: "/push/public-key"
  });
  assert.equal(pushKey.statusCode, 200);
  assert.deepEqual(pushKey.json(), { publicKey: "test-public-key" });

  const subscribe = await app.inject({
    method: "POST",
    url: `/users/${userId}/push-subscriptions`,
    payload: {
      endpoint: "https://push.example.test/subscription",
      keys: {
        p256dh: "test-p256dh",
        auth: "test-auth"
      }
    }
  });
  assert.equal(subscribe.statusCode, 201);
  assert.equal(subscribe.json().subscribed, true);

  const follow = await app.inject({
    method: "POST",
    url: `/users/${userId}/follows/${venueId}`
  });
  assert.equal(follow.statusCode, 201);
  assert.equal(follow.json().followed, true);

  const follows = await app.inject({
    method: "GET",
    url: `/users/${userId}/follows`
  });
  assert.equal(follows.statusCode, 200);
  assert.equal(follows.json().items.length, 1);
  assert.equal(follows.json().items[0].id, venueId);

  const defaults = await app.inject({
    method: "GET",
    url: `/users/${userId}/preferences`
  });
  assert.equal(defaults.statusCode, 200);
  assert.deepEqual(defaults.json(), {
    userId,
    eventTypes: [],
    newEventEnabled: true,
    eventUpdateEnabled: true,
    reminderEnabled: false,
    reminderHoursBefore: 24
  });

  const preferences = await app.inject({
    method: "PUT",
    url: `/users/${userId}/preferences`,
    payload: {
      eventTypes: ["challenge", "cup", "challenge"],
      newEventEnabled: true,
      eventUpdateEnabled: true,
      reminderEnabled: true,
      reminderHoursBefore: 12
    }
  });
  assert.equal(preferences.statusCode, 200);
  assert.deepEqual(preferences.json(), {
    userId,
    eventTypes: ["challenge", "cup"],
    newEventEnabled: true,
    eventUpdateEnabled: true,
    reminderEnabled: true,
    reminderHoursBefore: 12
  });

  const remove = await app.inject({
    method: "DELETE",
    url: `/users/${userId}/follows/${venueId}`
  });
  assert.equal(remove.statusCode, 200);
  assert.equal(remove.json().followed, false);

  const followsAfter = await app.inject({
    method: "GET",
    url: `/users/${userId}/follows`
  });
  assert.equal(followsAfter.json().items.length, 0);

  const unsubscribe = await app.inject({
    method: "DELETE",
    url: `/users/${userId}/push-subscriptions`,
    payload: { endpoint: "https://push.example.test/subscription" }
  });
  assert.equal(unsubscribe.statusCode, 200);
  assert.equal(unsubscribe.json().subscribed, false);
});

test.after(async () => {
  await app.close();
  await pool.end();
});
