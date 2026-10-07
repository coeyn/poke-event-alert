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

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

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

  app.post("/venues/counts", async (request, reply) => {
    const body = (request.body ?? {}) as { venues?: unknown };
    if (!Array.isArray(body.venues)) {
      return reply.code(400).send({ error: "venues must be an array" });
    }
    if (body.venues.length > 100) {
      return reply.code(400).send({ error: "A maximum of 100 venues can be requested" });
    }

    const requested = body.venues
      .map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          key: optionalText(row.key),
          league_id: optionalText(row.leagueId),
          name: optionalText(row.name),
          city: optionalText(row.city)
        };
      })
      .filter((item) => item.key && (item.league_id || item.name));

    if (requested.length === 0) return { counts: [] };

    const result = await pool.query(
      `
        WITH requested AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb)
            AS r(key text, league_id text, name text, city text)
        )
        SELECT
          r.key,
          COUNT(DISTINCT e.id)::int AS upcoming_event_count
        FROM requested AS r
        LEFT JOIN venues AS v ON (
          (
            r.league_id IS NOT NULL
            AND r.league_id <> ''
            AND v.league_id = r.league_id
          )
          OR (
            (r.league_id IS NULL OR r.league_id = '')
            AND r.name IS NOT NULL
            AND LOWER(v.name) = LOWER(r.name)
            AND (
              r.city IS NULL
              OR r.city = ''
              OR LOWER(COALESCE(v.city, '')) = LOWER(r.city)
            )
          )
        )
        LEFT JOIN events AS e ON (
          e.venue_id = v.id
          AND e.status = 'active'
          AND e.starts_at >= now()
        )
        GROUP BY r.key
        ORDER BY r.key
      `,
      [JSON.stringify(requested)]
    );

    return {
      counts: result.rows.map((row) => ({
        key: String(row.key),
        count: Number(row.upcoming_event_count ?? 0)
      }))
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
          COALESCE(e.raw_payload->>'cost', e.raw_payload->>'Cost', e.raw_payload->>'Admission', e.raw_payload->>'admission', e.raw_payload->>'entry_fee', e.raw_payload->>'entryFee') AS admission,
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
