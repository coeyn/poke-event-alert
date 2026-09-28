import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Pool } from "pg";
import { registerEventRoutes } from "./routes/events.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerPushRoutes } from "./routes/push.js";
import { registerVenueRoutes } from "./routes/venues.js";

export function createApp(pool: Pool) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test"
  });

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:3000,https://coeyn.github.io"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  });

  app.setErrorHandler((error, request, reply) => {
    const code = (error as Error & { code?: string }).code;

    if (code === "22P02") {
      return reply.code(400).send({ error: "Invalid identifier or parameter" });
    }

    if (code === "23503") {
      return reply.code(404).send({ error: "Referenced resource not found" });
    }

    if (code === "23505") {
      return reply.code(409).send({ error: "Resource already exists" });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true };
  });

  registerEventRoutes(app, pool);
  registerVenueRoutes(app, pool);
  registerUserRoutes(app, pool);
  registerPushRoutes(app, pool);

  return app;
}
