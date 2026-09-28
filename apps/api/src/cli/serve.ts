import { createPool } from "../db/pool.js";
import { createApp } from "../http/app.js";

const pool = createPool();
const app = createApp(pool);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

let closing = false;

async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await pool.end();
}

process.once("SIGINT", async () => {
  await close();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await close();
  process.exit(0);
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  await close();
  process.exitCode = 1;
}
