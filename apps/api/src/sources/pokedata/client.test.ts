import assert from "node:assert/strict";
import test from "node:test";
import { PokeDataSource } from "./client.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("follows pagination and deduplicates events", async () => {
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
        events: [
          {
            guid: "one",
            title: "Challenge",
            event_date: "2026-10-01T10:00:00Z"
          }
        ],
        pagination: { page: 1, total_pages: 2 }
      });
    }

    return jsonResponse({
      events: [
        {
          guid: "one",
          title: "Challenge updated",
          event_date: "2026-10-01T10:00:00Z"
        },
        {
          guid: "two",
          title: "Cup",
          event_date: "2026-10-02T10:00:00Z"
        }
      ],
      pagination: { page: 2, total_pages: 2 }
    });
  };

  const source = new PokeDataSource({
    endpoint: "https://example.test/events",
    fetchImpl
  });

  const result = await source.fetchEvents();

  assert.equal(result.pagesFetched, 2);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0]?.title, "Challenge updated");
  assert.match(result.warnings.join("\n"), /Deduplicated 1 event/);
  assert.equal(new URL(requests[1]!).searchParams.get("page"), "2");
});
