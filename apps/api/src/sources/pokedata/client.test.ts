import assert from "node:assert/strict";
import test from "node:test";
import { PokeDataSource } from "./client.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("uses PokéData v2 path filters, follows metadata pagination and deduplicates", async () => {
  const requests: string[] = [];

  const fetchImpl: typeof fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    requests.push(url);

    if (requests.length === 1) {
      return jsonResponse({
        metadata: {
          total_items: 3,
          total_pages: 2,
          current_page: 1,
          limit: 100
        },
        events: [
          {
            guid: "one",
            name: "Challenge",
            Start_date: "2026-10-01T10:00:00Z",
            shop: "Boutique A",
            league: "123",
            Products: "tcg"
          }
        ]
      });
    }

    return jsonResponse({
      metadata: {
        total_items: 3,
        total_pages: 2,
        current_page: 2,
        limit: 100
      },
      events: [
        {
          guid: "one",
          name: "Challenge updated",
          Start_date: "2026-10-01T10:00:00Z",
          shop: "Boutique A",
          league: "123",
          Products: "tcg"
        },
        {
          guid: "two",
          name: "Cup",
          Start_date: "2026-10-02T10:00:00Z",
          shop: "Boutique B",
          league: "456",
          Products: "tcg"
        }
      ]
    });
  };

  const source = new PokeDataSource({
    endpoint: "https://example.test/events",
    countryCodes: ["FR", "BE"],
    now: new Date("2026-09-28T12:00:00Z"),
    daysAhead: 30,
    fetchImpl
  });

  const result = await source.fetchEvents();

  assert.equal(result.pagesFetched, 2);
  assert.equal(result.complete, true);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0]?.title, "Challenge updated");
  assert.equal(result.events[0]?.venueName, "Boutique A");
  assert.equal(result.events[0]?.game, "tcg");
  assert.match(result.warnings.join("\n"), /Deduplicated 1 event/);
  assert.deepEqual(result.scope, {
    countryCodes: ["FR", "BE"],
    startsFrom: "2026-09-28",
    startsUntil: "2026-10-28"
  });

  assert.equal(
    new URL(requests[0]!).pathname,
    "/events/_country/FR/BE/_start/2026-09-28/_end/2026-10-28"
  );
  assert.equal(
    new URL(requests[1]!).pathname,
    "/events/_country/FR/BE/_start/2026-09-28/_end/2026-10-28/_page/2"
  );
});

test("marks a truncated pagination fetch as incomplete", async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse({
      metadata: {
        total_items: 200,
        total_pages: 2,
        current_page: 1,
        limit: 100
      },
      events: [
        {
          guid: "one",
          name: "Challenge",
          Start_date: "2026-10-01T10:00:00Z"
        }
      ]
    });

  const source = new PokeDataSource({
    endpoint: "https://example.test/events",
    countryCodes: ["FR"],
    startDate: "2026-09-28",
    endDate: "2026-10-28",
    maxPages: 1,
    fetchImpl
  });

  const result = await source.fetchEvents();

  assert.equal(result.complete, false);
  assert.equal(result.pagesFetched, 1);
  assert.match(result.warnings.join("\n"), /Stopped after maxPages=1/);
});
