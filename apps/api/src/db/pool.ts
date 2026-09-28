import pg from "pg";

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (connectionString) {
    return new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
  }

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || password === undefined || !database) {
    throw new Error(
      "Database configuration is required (DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME)"
    );
  }

  return new Pool({
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user,
    password,
    database,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}
