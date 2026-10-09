import webpush from "web-push";
import type { Pool } from "pg";

type PendingRow = {
  notification_id: string;
  user_id: string;
  kind: "new_event" | "event_updated";
  source_event_id: string;
  title: string;
  starts_at: Date;
  venue_name: string | null;
};

function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY and WEB_PUSH_SUBJECT are required"
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function getSubscriptions(pool: Pool, userId: string) {
  return pool.query<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    `
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE user_id = $1::uuid
    `,
    [userId]
  );
}

async function deliver(
  pool: Pool,
  subscription: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: string
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      payload
    );

    await pool.query(
      `
        UPDATE push_subscriptions
        SET last_success_at = now()
        WHERE id = $1::uuid
      `,
      [subscription.id]
    );

    return true;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;

    if (statusCode === 404 || statusCode === 410) {
      await pool.query(
        "DELETE FROM push_subscriptions WHERE id = $1::uuid",
        [subscription.id]
      );
    }

    return false;
  }
}

export async function sendPendingNotifications(pool: Pool, limit = 100) {
  configureWebPush();

  const pending = await pool.query<PendingRow>(
    `
      SELECT
        n.id AS notification_id,
        n.user_id,
        n.kind,
        e.source_event_id,
        e.title,
        e.starts_at,
        v.name AS venue_name
      FROM notifications AS n
      JOIN events AS e ON e.id = n.event_id
      LEFT JOIN venues AS v ON v.id = e.venue_id
      WHERE n.sent_at IS NULL
      ORDER BY n.created_at ASC
      LIMIT $1
    `,
    [limit]
  );

  let sent = 0;
  let failed = 0;

  for (const item of pending.rows) {
    const subscriptions = await getSubscriptions(pool, item.user_id);

    const webBase =
      process.env.PUBLIC_WEB_URL?.replace(/\/$/, "") ??
      "https://coeyn.github.io/poke-event-alert";

    const payload = JSON.stringify({
      title:
        item.kind === "new_event"
          ? `Nouvel événement : ${item.title}`
          : `Événement modifié : ${item.title}`,
      body: [
        item.venue_name,
        new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Paris"
        }).format(item.starts_at)
      ]
        .filter(Boolean)
        .join(" · "),
      url: `${webBase}/tournoi/?id=${encodeURIComponent(item.source_event_id)}`,
      tag: `${item.kind}:${item.source_event_id}`
    });

    let delivered = false;
    for (const subscription of subscriptions.rows) {
      if (await deliver(pool, subscription, payload)) delivered = true;
    }

    if (delivered || subscriptions.rowCount === 0) {
      await pool.query(
        "UPDATE notifications SET sent_at = now() WHERE id = $1::uuid",
        [item.notification_id]
      );
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed: pending.rowCount ?? 0,
    sent,
    failed
  };
}

export async function sendTestNotification(pool: Pool, userId: string) {
  configureWebPush();

  const subscriptions = await getSubscriptions(pool, userId);
  const webBase =
    process.env.PUBLIC_WEB_URL?.replace(/\/$/, "") ??
    "https://coeyn.github.io/poke-event-alert";

  const payload = JSON.stringify({
    title: "Test Poké Event Alert ✅",
    body: "Les notifications fonctionnent correctement sur cet appareil.",
    url: `${webBase}/reglages/`,
    tag: `push-test:${userId}`
  });

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions.rows) {
    if (await deliver(pool, subscription, payload)) sent += 1;
    else failed += 1;
  }

  return {
    subscriptions: subscriptions.rowCount ?? 0,
    sent,
    failed
  };
}
