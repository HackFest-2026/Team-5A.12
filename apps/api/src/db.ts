import "./config.js";
import pg from "pg";

const { Pool } = pg;

export const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://cashpilot:cashpilot@localhost:5435/cashpilot",
});

export async function query<T>(text: string, params: unknown[] = []) {
  const result = await db.query<T & pg.QueryResultRow>(text, params);
  return result.rows;
}
