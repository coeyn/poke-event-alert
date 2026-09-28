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
        f.user_id,
        $1::uuid,
        $4::text,
        $4::text || ':' || $1::text || ':' || f.user_id::text || ':' || $5::text
      FROM venue_follows AS f
      LEFT JOIN notification_preferences AS p
        ON p.user_id = f.user_id
      WHERE
        f.venue_id = $2::uuid
        AND EXISTS (
          SELECT 1
          FROM push_subscriptions AS s
          WHERE s.user_id = f.user_id
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
