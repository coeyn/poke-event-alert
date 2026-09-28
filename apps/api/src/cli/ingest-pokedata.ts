import { createPool } from "../db/pool.js";
import { runSourceIngestion } from "../ingestion/service.js";
import { PokeDataSource } from "../sources/pokedata/index.js";

const pool = createPool();
const source = new PokeDataSource();

try {
  const summary = await runSourceIngestion(pool, source);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
