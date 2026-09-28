import { createPool } from "../db/pool.js";
import { sendPendingNotifications } from "../notifications/sender.js";

const pool = createPool();

try {
  const summary = await sendPendingNotifications(pool);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
