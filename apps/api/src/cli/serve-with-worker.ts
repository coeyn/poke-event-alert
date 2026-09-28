import { createPool } from "../db/pool.js";
import { createApp } from "../http/app.js";
import { runSourceIngestion } from "../ingestion/service.js";
import { sendPendingNotifications } from "../notifications/sender.js";
import { PokeDataSource } from "../sources/pokedata/index.js";

const pool = createPool();
const app = createApp(pool);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const intervalSeconds = Math.max(
  300,
  Number(process.env.SYNC_INTERVAL_SECONDS ?? 3600)
);

let closing = false;
let running = false;
let timer: NodeJS.Timeout | undefined;

async function runCycle() {
  if (running || closing) return;
  running = true;

  try {
    app.log.info("Starting PokéData ingestion");
    const ingestion = await runSourceIngestion(pool, new PokeDataSource());
    app.log.info({ ingestion }, "PokéData ingestion finished");
  } catch (error) {
    app.log.error(error, "PokéData ingestion failed");
  }

  try {
    app.log.info("Sending pending notifications");
    const notifications = await sendPendingNotifications(pool);
    app.log.info({ notifications }, "Notification send finished");
  } catch (error) {
    app.log.error(error, "Notification send failed");
  } finally {
    running = false;
  }
}

async function close() {
  if (closing) return;
  closing = true;

  if (timer) clearInterval(timer);

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

  void runCycle();
  timer = setInterval(() => {
    void runCycle();
  }, intervalSeconds * 1000);
} catch (error) {
  app.log.error(error);
  await close();
  process.exitCode = 1;
}
