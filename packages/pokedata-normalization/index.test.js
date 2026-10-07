import assert from "node:assert/strict";
import test from "node:test";
import { normalizePokeDataEvent } from "./index.js";

test("normalizes shared PokéData fields and Paris local time", () => {
  const event = normalizePokeDataEvent({
    Guid: "evt-1", name: "League Challenge", type: "League Challenge", Products: "tcg",
    Start_date: "2026-10-10T14:00:00", cost: "8€", shop: "Boutique test", league: "123",
    street_address: "1 rue du Test", city: "Rennes", country_code: "FR"
  });
  assert.ok(event);
  assert.equal(event.id, "evt-1");
  assert.equal(event.type, "challenge");
  assert.equal(event.game, "tcg");
  assert.equal(event.startsAt, "2026-10-10T12:00:00.000Z");
  assert.equal(event.admission, "8€");
  assert.equal(event.venueId, "league:123");
  assert.equal(event.address, "1 rue du Test");
});

test("keeps current free tournament and Session Play classification", () => {
  assert.equal(normalizePokeDataEvent({ id: "a", type: "nonpremier", date: "2026-10-10", cost: "0" })?.type, "tournament");
  assert.equal(normalizePokeDataEvent({ id: "b", type: "nonpremier", date: "2026-10-10", cost: "" })?.type, "session_play");
});

test("rejects rows without event id or date", () => {
  assert.equal(normalizePokeDataEvent({ name: "Incomplete" }), undefined);
});
