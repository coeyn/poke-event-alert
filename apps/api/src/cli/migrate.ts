import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPool } from "../db/pool.js";

const migrationUrl = new URL("../../migrations/0001_init.sql", import.meta.url);
const sql = await readFile(fileURLToPath(migrationUrl), "utf8");

const pool = createPool();

try {
  await pool.query(sql);
  console.log("Database migration 0001_init.sql applied.");
} finally {
  await pool.end();
}
