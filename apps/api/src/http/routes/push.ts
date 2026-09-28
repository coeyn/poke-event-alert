import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { stringParam } from "../utils.js";

export function registerPushRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/push/public-key", async (_request, reply) => {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;

    if (!publicKey) {
      return reply.code(503).send({ error: "Push notifications not configured" });
    }

    return { publicKey };
  });

  app.post("/users/:userId/push-subscriptions", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const endpoint = stringParam(body.endpoint);
    const keys = (body.keys ?? {}) as Record<string, unknown>;
    const p256dh = stringParam(keys.p256dh);
    const auth = stringParam(keys.auth);

    if (!endpoint || !p256dh || !auth) {
      return reply.code(400).send({ error: "Invalid push subscription" });
    }

    await pool.query(
      `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES ($1::uuid,$2,$3,$4)
        ON CONFLICT (endpoint)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth
      `,
      [userId, endpoint, p256dh, auth]
    );

    return reply.code(201).send({ subscribed: true });
  });

  app.delete("/users/:userId/push-subscriptions", async (request) => {
    const { userId } = request.params as { userId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const endpoint = stringParam(body.endpoint);

    if (endpoint) {
      await pool.query(
        `
          DELETE FROM push_subscriptions
          WHERE user_id = $1::uuid AND endpoint = $2
        `,
        [userId, endpoint]
      );
    }

    return { subscribed: false };
  });
}
