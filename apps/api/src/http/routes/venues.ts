import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { mapEvent, mapVenue, positiveInt, stringParam } from "../utils.js";

const VENUE_FIELDS = `
  v.id,
  v.source,
  v.source_venue_id,
  v.league_id,
  v.name,
  v.address,
  v.city,
  v.postal_code,
  v.country_code,
  v.latitude,
  v.longitude,
  v.source_url
`;

export function registerVenueRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/venues", async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const search = stringParam(query.search) ?? "";
    const countryCode = stringParam(query.countryCode)?.toUpperCase() ?? null;
    const limit = positiveInt(query.limit, 25, 100);
    const offset = positiveInt(query.offset, 0, 100_000);

    const result = await pool.query(
      `
        SELECT
          ${VENUE_FIELDS},
          (
            SELECT COUNT(*)::int
            FROM events AS e
            WHERE
              e.venue_id = v.id
              AND e.status = 'active'
              AND e.starts_at >= now()
          ) AS upcoming_event_count,
          COUNT(*) OVER()::int AS total_count
        FROM venues AS v
        WHERE
          (
            $1::text = ''
            OR v.name ILIKE '%' || $1 || '%'
            OR COALESCE(v.city, '') ILIKE '%' || $1 || '%'
            OR COALESCE(v.league_id, '') ILIKE '%' || $1 || '%'
            OR COALESCE(v.address, '') ILIKE '%' || $1 || '%'
            OR COALESCE(v.postal_code, '') ILIKE '%' || $1 || '%'
          )
          AND ($2::text IS NULL OR UPPER(v.country_code) = $2::text)
        ORDER BY v.name ASC, v.id ASC
        LIMIT $3 OFFSET $4
      `,
      [search, countryCode, limit, offset]
    );

    const total = Number(result.rows[0]?.total_count ?? 0);

    return {
      items: result.rows.map((row) => mapVenue(row)),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + result.rows.length < total
      }
    };
  });

  app.get("/venues/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `
        SELECT
          ${VENUE_FIELDS},
          (
            SELECT COUNT(*)::int
            FROM events AS e
            WHERE
              e.venue_id = v.id
              AND e.status = 'active'
              AND e.starts_at >= now()
          ) AS upcoming_event_count
        FROM venues AS v
        WHERE v.id = $1::uuid
        LIMIT 1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ error: "Venue not found" });
    }

    return mapVenue(row);
  });

  app.get("/venues/:id/events", async (request) => {
    const { id } = request.params as { id: string };
    const query = (request.query ?? {}) as Record<string, unknown>;
    const limit = positiveInt(query.limit, 25, 100);
    const offset = positiveInt(query.offset, 0, 100_000);

    const result = await pool.query(
      `
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
          v.source_url AS venue_source_url,
          COUNT(*) OVER()::int AS total_count
        FROM events AS e
        JOIN venues AS v ON v.id = e.venue_id
        WHERE
          e.venue_id = $1::uuid
          AND e.status = 'active'
          AND e.starts_at >= now()
        ORDER BY e.starts_at ASC, e.id ASC
        LIMIT $2 OFFSET $3
      `,
      [id, limit, offset]
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
}
