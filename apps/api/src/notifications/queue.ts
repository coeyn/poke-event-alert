import type { PoolClient } from "pg";

export type NotificationKind = "new_event" | "event_updated";

export async function queueEventNotifications(
  client: PoolClient,
  input: {
    eventId: string;
    venueId: string | null;
    eventType: string | null;
    kind: NotificationKind;
    versionKey: string;
  }
) {
  if (!input.venueId) return 0;

  const result = await client.query(
    `
      INSERT INTO notifications (
        user_id,
        event_id,
        kind,
        deduplication_key
      )
      SELECT
        recipients.user_id,
        $1::uuid,
        $4::text,
        $4::text || ':' || $1::text || ':' || recipients.user_id::text || ':' || $5::text
      FROM (
        SELECT user_id
        FROM venue_follows
        WHERE venue_id = $2::uuid

        UNION

        SELECT p.user_id
        FROM notification_preferences AS p
        JOIN venues AS v ON v.id = $2::uuid
        WHERE
          p.discovery_radius_km > 0
          AND p.discovery_latitude IS NOT NULL
          AND p.discovery_longitude IS NOT NULL
          AND v.latitude IS NOT NULL
          AND v.longitude IS NOT NULL
          AND 6371 * 2 * ASIN(SQRT(LEAST(1,
            POWER(SIN(RADIANS(v.latitude - p.discovery_latitude) / 2), 2)
            + COS(RADIANS(p.discovery_latitude)) * COS(RADIANS(v.latitude))
            * POWER(SIN(RADIANS(v.longitude - p.discovery_longitude) / 2), 2)
          ))) <= p.discovery_radius_km
      ) AS recipients
      LEFT JOIN notification_preferences AS p
        ON p.user_id = recipients.user_id
      WHERE
        EXISTS (
          SELECT 1
          FROM push_subscriptions AS s
          WHERE s.user_id = recipients.user_id
        )
        AND (
          ($4::text = 'new_event' AND COALESCE(p.new_event_enabled, true))
          OR
          ($4::text = 'event_updated' AND COALESCE(p.event_update_enabled, true))
        )
        AND (
          $3::text IS NULL
          OR p.event_types IS NULL
          OR jsonb_array_length(p.event_types) = 0
          OR p.event_types ? $3::text
          OR (
            p.event_types ? 'other'
            AND $3::text NOT IN ('challenge', 'cup', 'prerelease', 'session_play', 'tournament')
          )
        )
      ON CONFLICT (deduplication_key) DO NOTHING
    `,
    [
      input.eventId,
      input.venueId,
      input.eventType,
      input.kind,
      input.versionKey
    ]
  );

  return result.rowCount ?? 0;
}
