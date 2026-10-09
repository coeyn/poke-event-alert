import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { mapVenue, stringParam } from "../utils.js";

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function eventTypesValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function reminderHoursValue(value: unknown): number {
  const parsed = Number(value ?? 24);
  if (!Number.isFinite(parsed) || parsed < 1) return 24;
  return Math.min(Math.floor(parsed), 24 * 30);
}

function discoveryRadiusValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Math.floor(parsed), 200);
}

function locationValue(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return null;
  return {
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitude.toFixed(2))
  };
}

export function registerUserRoutes(app: FastifyInstance, pool: Pool) {
  app.post("/users", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const email = stringParam(body.email) ?? null;
    const displayName = stringParam(body.displayName) ?? null;

    const result = email
      ? await pool.query(
          `
            INSERT INTO users (email, display_name)
            VALUES ($1,$2)
            ON CONFLICT (email)
            DO UPDATE SET
              display_name = COALESCE(EXCLUDED.display_name, users.display_name)
            RETURNING id, email, display_name, created_at
          `,
          [email, displayName]
        )
      : await pool.query(
          `
            INSERT INTO users (display_name)
            VALUES ($1)
            RETURNING id, email, display_name, created_at
          `,
          [displayName]
        );

    const row = result.rows[0];
    return reply.code(201).send({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at)
    });
  });

  app.get("/users/:userId/follows", async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await pool.query("SELECT id FROM users WHERE id = $1::uuid", [
      userId
    ]);
    if (user.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const result = await pool.query(
      `
        SELECT
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
          v.source_url,
          (
            SELECT COUNT(*)::int
            FROM events AS e
            WHERE
              e.venue_id = v.id
              AND e.status = 'active'
              AND e.starts_at >= now()
          ) AS upcoming_event_count
        FROM venue_follows AS f
        JOIN venues AS v ON v.id = f.venue_id
        WHERE f.user_id = $1::uuid
        ORDER BY v.name ASC
      `,
      [userId]
    );

    return { items: result.rows.map((row) => mapVenue(row)) };
  });

  app.post("/users/:userId/follows/:venueId", async (request, reply) => {
    const { userId, venueId } = request.params as {
      userId: string;
      venueId: string;
    };

    await pool.query(
      `
        INSERT INTO venue_follows (user_id, venue_id)
        VALUES ($1::uuid,$2::uuid)
        ON CONFLICT (user_id, venue_id) DO NOTHING
      `,
      [userId, venueId]
    );

    return reply.code(201).send({ userId, venueId, followed: true });
  });

  app.delete("/users/:userId/follows/:venueId", async (request) => {
    const { userId, venueId } = request.params as {
      userId: string;
      venueId: string;
    };

    await pool.query(
      `
        DELETE FROM venue_follows
        WHERE user_id = $1::uuid AND venue_id = $2::uuid
      `,
      [userId, venueId]
    );

    return { userId, venueId, followed: false };
  });

  app.get("/users/:userId/preferences", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const result = await pool.query(
      `
        SELECT
          u.id,
          p.event_types,
          p.new_event_enabled,
          p.event_update_enabled,
          p.reminder_enabled,
          p.reminder_hours_before,
          p.discovery_radius_km
        FROM users AS u
        LEFT JOIN notification_preferences AS p ON p.user_id = u.id
        WHERE u.id = $1::uuid
        LIMIT 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ error: "User not found" });
    }

    return {
      userId,
      eventTypes: row.event_types ?? [],
      newEventEnabled: row.new_event_enabled ?? true,
      eventUpdateEnabled: row.event_update_enabled ?? true,
      reminderEnabled: row.reminder_enabled ?? false,
      reminderHoursBefore: row.reminder_hours_before ?? 24,
      discoveryRadiusKm: row.discovery_radius_km ?? 0
    };
  });

  app.put("/users/:userId/preferences", async (request) => {
    const { userId } = request.params as { userId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const location = locationValue(body.location);

    const preferences = {
      eventTypes: eventTypesValue(body.eventTypes),
      newEventEnabled: booleanValue(body.newEventEnabled, true),
      eventUpdateEnabled: booleanValue(body.eventUpdateEnabled, true),
      reminderEnabled: booleanValue(body.reminderEnabled, false),
      reminderHoursBefore: reminderHoursValue(body.reminderHoursBefore),
      discoveryRadiusKm: location ? discoveryRadiusValue(body.discoveryRadiusKm) : 0,
      location
    };

    await pool.query(
      `
        INSERT INTO notification_preferences (
          user_id,
          event_types,
          new_event_enabled,
          event_update_enabled,
          reminder_enabled,
          reminder_hours_before,
          discovery_latitude,
          discovery_longitude,
          discovery_radius_km
        )
        VALUES ($1::uuid,$2::jsonb,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (user_id)
        DO UPDATE SET
          event_types = EXCLUDED.event_types,
          new_event_enabled = EXCLUDED.new_event_enabled,
          event_update_enabled = EXCLUDED.event_update_enabled,
          reminder_enabled = EXCLUDED.reminder_enabled,
          reminder_hours_before = EXCLUDED.reminder_hours_before,
          discovery_latitude = EXCLUDED.discovery_latitude,
          discovery_longitude = EXCLUDED.discovery_longitude,
          discovery_radius_km = EXCLUDED.discovery_radius_km
      `,
      [
        userId,
        JSON.stringify(preferences.eventTypes),
        preferences.newEventEnabled,
        preferences.eventUpdateEnabled,
        preferences.reminderEnabled,
        preferences.reminderHoursBefore,
        preferences.location?.latitude ?? null,
        preferences.location?.longitude ?? null,
        preferences.discoveryRadiusKm
      ]
    );

    return {
      userId,
      eventTypes: preferences.eventTypes,
      newEventEnabled: preferences.newEventEnabled,
      eventUpdateEnabled: preferences.eventUpdateEnabled,
      reminderEnabled: preferences.reminderEnabled,
      reminderHoursBefore: preferences.reminderHoursBefore,
      discoveryRadiusKm: preferences.discoveryRadiusKm
    };
  });
}
