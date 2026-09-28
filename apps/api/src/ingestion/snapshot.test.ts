import assert from "node:assert/strict";
import test from "node:test";
import {
  diffSnapshots,
  eventSnapshot,
  fallbackVenueId,
  snapshotHash
} from "./snapshot.js";
import type { SourceEvent } from "../sources/types.js";

function fixture(overrides: Partial<SourceEvent> = {}): SourceEvent {
  return {
    source: "pokedata",
    sourceEventId: "evt-1",
    sourceUrl: "https://example.test/event/1",
    title: "League Challenge",
    startsAt: "2026-10-10T12:00:00.000Z",
    venueName: "Boutique Test",
    city: "Rennes",
    eventType: "challenge",
    game: "tcg",
    raw: {},
    ...overrides
  };
}

test("same meaningful event produces the same hash", () => {
  const a = fixture({ raw: { request: 1 } });
  const b = fixture({ raw: { request: 2, irrelevant: true } });

  assert.equal(snapshotHash(eventSnapshot(a)), snapshotHash(eventSnapshot(b)));
});

test("a date change is detected", () => {
  const before = eventSnapshot(fixture());
  const after = eventSnapshot(
    fixture({ startsAt: "2026-10-10T13:00:00.000Z" })
  );

  const changes = diffSnapshots(before, after);

  assert.deepEqual(changes.startsAt, {
    before: "2026-10-10T12:00:00.000Z",
    after: "2026-10-10T13:00:00.000Z"
  });
});

test("fallback venue id is stable", () => {
  assert.equal(fallbackVenueId(fixture()), fallbackVenueId(fixture()));
  assert.notEqual(
    fallbackVenueId(fixture()),
    fallbackVenueId(fixture({ city: "Nantes" }))
  );
});
