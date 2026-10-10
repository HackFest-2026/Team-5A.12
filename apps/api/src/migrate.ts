import "./config.js";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";

const migrationsDir = fileURLToPath(
  new URL("../../../db/migrations/", import.meta.url),
);

async function migrate() {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set(
    (
      await db.query<{ version: string }>(
        "SELECT version FROM schema_migrations",
      )
    ).rows.map((row) => row.version),
  );
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(resolve(migrationsDir, file), "utf8"));
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
        [version],
      );
      await client.query("COMMIT");
      console.log(`Applied migration ${version}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => db.end())
  .catch(async (error) => {
    console.error(error);
    await db.end();
    process.exitCode = 1;
  });
