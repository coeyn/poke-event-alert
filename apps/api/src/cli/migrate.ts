import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPool } from "../db/pool.js";

const migrationsUrl = new URL("../../migrations/", import.meta.url);
const migrationDirectory = fileURLToPath(migrationsUrl);
const files = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const pool = createPool();

try {
  for (const name of files) {
    const sql = await readFile(new URL(name, migrationsUrl), "utf8");
    await pool.query(sql);
    console.log(`Database migration ${name} applied.`);
  }
} finally {
  await pool.end();
}
