import { randomUUID } from "node:crypto";
import pg from "pg";

/** DATABASE_URL supplies server credentials only; tests never use its database. */
export async function withTestDatabase<T>(
  run: (database: { name: string; url: string }) => Promise<T>,
): Promise<T> {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl)
    throw new Error("DATABASE_URL is required for database tests");
  const name = `pta_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(originalUrl);
  url.pathname = `/${name}`;
  const admin = new pg.Client({ connectionString: originalUrl });
  let created = false;
  try {
    await admin.connect();
    // The identifier is generated here exclusively from a UUID.
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    process.env.DATABASE_URL = url.toString();
    return await run({ name, url: url.toString() });
  } finally {
    process.env.DATABASE_URL = originalUrl;
    try {
      if (created) {
        // FORCE also covers connections left open by a failing setup/import.
        await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      }
    } finally {
      await admin.end();
    }
  }
}
