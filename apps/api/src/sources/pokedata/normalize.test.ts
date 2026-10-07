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
    Admission: "10",
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
  assert.equal(event.admission, "10");
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

test("recognizes French avant-première events from their title and identifies them as TCG", () => {
  const event = normalizePokeDataEvent({
    guid: "ap-123",
    name: "AP ME6 1/5 manga évasion",
    type: "Non-premier",
    Start_date: "2026-10-24T10:00:00Z",
    shop: "Boutique Test",
    Products: ""
  });

  assert.ok(event);
  assert.equal(event.eventType, "prerelease");
  assert.equal(event.game, "tcg");
});


test("normalizes fields observed in the live PokéData v2 payload", () => {
  const event = normalizePokeDataEvent({
    type: "League Challenge",
    name: "Challenge de septembre",
    date: "2026-09-28",
    shop: "BOUTIQUE TEST",
    street_address: "1 RUE DU TEST, 22000 SAINT-BRIEUC, FRANCE",
    city: "Saint-Brieuc",
    country_code: "FR",
    pokemon_url:
      "https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-000001/",
    guid: "live-v2-guid",
    latitude: "48.514",
    longitude: "-2.765",
    league: "26029062",
    Products: "tcg",
    Start_date: "2026-09-28T18:30:00Z",
    Third_party_registration_website: "https://example.test/register"
  });

  assert.ok(event);
  assert.equal(event.sourceEventId, "live-v2-guid");
  assert.equal(event.title, "Challenge de septembre");
  assert.equal(event.startsAt, "2026-09-28T18:30:00.000Z");
  assert.equal(event.venueName, "BOUTIQUE TEST");
  assert.equal(event.leagueId, "26029062");
  assert.equal(event.sourceVenueId, "league:26029062");
  assert.equal(event.countryCode, "FR");
  assert.equal(event.eventType, "challenge");
  assert.equal(event.game, "tcg");
  assert.equal(
    event.sourceUrl,
    "https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-000001/"
  );
  assert.equal(event.registrationUrl, "https://example.test/register");
});

test("rejects rows without a stable id or date", () => {
  assert.equal(
    normalizePokeDataEvent({ title: "Incomplete event" }),
    undefined
  );
});
