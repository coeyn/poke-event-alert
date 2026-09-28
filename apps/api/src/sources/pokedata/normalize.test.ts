import assert from "node:assert/strict";
import test from "node:test";
import { normalizePokeDataEvent } from "./normalize.js";

test("normalizes a flat PokéData-like event", () => {
  const event = normalizePokeDataEvent({
    guid: "evt-123",
    event_name: "League Challenge",
    start_datetime: "2026-10-10T14:00:00+02:00",
    shop_name: "Boutique Test",
    league_id: "26029062",
    city: "Saint-Brieuc",
    postal_code: "22000",
    country_code: "FR",
    event_type: "TCG Challenge",
    game: "TCG",
    registration_url: "https://example.test/register"
  });

  assert.ok(event);
  assert.equal(event.source, "pokedata");
  assert.equal(event.sourceEventId, "evt-123");
  assert.equal(event.startsAt, "2026-10-10T12:00:00.000Z");
  assert.equal(event.venueName, "Boutique Test");
  assert.equal(event.leagueId, "26029062");
  assert.equal(event.eventType, "challenge");
  assert.equal(event.game, "tcg");
});

test("normalizes nested venue data", () => {
  const event = normalizePokeDataEvent({
    id: 42,
    title: "Pokémon League Cup",
    event_date: "2026-11-01T10:00:00Z",
    type: "League Cup",
    venue: {
      id: "shop-8",
      name: "Card Shop",
      address: "1 rue Exemple",
      city: "Rennes",
      latitude: "48.1173",
      longitude: "-1.6778"
    }
  });

  assert.ok(event);
  assert.equal(event.sourceEventId, "42");
  assert.equal(event.sourceVenueId, "shop-8");
  assert.equal(event.venueName, "Card Shop");
  assert.equal(event.eventType, "cup");
  assert.equal(event.latitude, 48.1173);
  assert.equal(event.longitude, -1.6778);
});

test("rejects rows without a stable id or date", () => {
  assert.equal(
    normalizePokeDataEvent({ title: "Incomplete event" }),
    undefined
  );
});
