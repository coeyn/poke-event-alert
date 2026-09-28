import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createIcs } from "../../calendar/ical.js";
import {
  dateParam,
  mapEvent,
  positiveInt,
  stringList,
  stringParam
} from "../utils.js";

const EVENT_SELECT = `
  SELECT
    e.id,
    e.source,
    e.source_event_id,
    e.title,
    e.event_type,
    e.game,
    e.starts_at,
    e.ends_at,
    e.registration_url,
    e.source_url,
    e.status,
    e.missing_since,
    v.id AS venue_id,
    v.source AS venue_source,
    v.source_venue_id,
    v.league_id,
    v.name AS venue_name,
    v.address,
    v.city,
    v.postal_code,
    v.country_code,
    v.latitude,
    v.longitude,
    v.source_url AS venue_source_url
  FROM events AS e
  LEFT JOIN venues AS v ON v.id = e.venue_id
`;

export function registerEventRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/events", async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const from = dateParam(query.from);
    const to = dateParam(query.to);
    const eventTypes = stringList(query.eventType);
    const games = stringList(query.game);
    const countryCode = stringParam(query.countryCode)?.toUpperCase() ?? null;
    const venueId = stringParam(query.venueId) ?? null;
    const limit = positiveInt(query.limit, 25, 100);
    const offset = positiveInt(query.offset, 0, 100_000);

    const result = await pool.query(
      `
        SELECT q.*, COUNT(*) OVER()::int AS total_count
        FROM (
          ${EVENT_SELECT}
          WHERE
            e.status = 'active'
            AND e.starts_at >= COALESCE($1::timestamptz, now())
            AND ($2::timestamptz IS NULL OR e.starts_at <= $2::timestamptz)
            AND ($3::text[] IS NULL OR e.event_type = ANY($3::text[]))
            AND ($4::text[] IS NULL OR e.game = ANY($4::text[]))
            AND ($5::text IS NULL OR UPPER(v.country_code) = $5::text)
            AND ($6::uuid IS NULL OR e.venue_id = $6::uuid)
        ) AS q
        ORDER BY q.starts_at ASC, q.id ASC
        LIMIT $7 OFFSET $8
      `,
      [from, to, eventTypes, games, countryCode, venueId, limit, offset]
    );

    const total = Number(result.rows[0]?.total_count ?? 0);

    return {
      items: result.rows.map((row) => mapEvent(row)),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + result.rows.length < total
      }
    };
  });

  app.get("/events/:id/calendar.ics", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `
        ${EVENT_SELECT}
        WHERE e.id = $1::uuid
        LIMIT 1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ error: "Event not found" });
    }

    const event = mapEvent(row);
    const ics = createIcs({
      uid: `${event.sourceEventId}@poke-event-alert`,
      title: event.title,
      startsAt: event.startsAt!,
      endsAt: event.endsAt,
      venueName: event.venue?.name,
      address: event.venue?.address,
      city: event.venue?.city,
      sourceUrl: event.sourceUrl,
      description: [event.eventType, event.game].filter(Boolean).join(" — ")
    });

    reply
      .type("text/calendar; charset=utf-8")
      .header(
        "content-disposition",
        'attachment; filename="pokemon-event.ics"'
      );

    return ics;
  });

  app.get("/events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `
        ${EVENT_SELECT}
        WHERE e.id = $1::uuid
        LIMIT 1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ error: "Event not found" });
    }

    return mapEvent(row);
  });
}
