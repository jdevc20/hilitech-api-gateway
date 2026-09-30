import { Pool } from "pg";

import { env } from "../configurations/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (error) => {
  console.error("[Gateway] Unexpected database connection error:", error);
});

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
