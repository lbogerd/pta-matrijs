import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { withTestDatabase } from "./support/database";

test(
  "database fixtures are removed after success and test/setup failure",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const originalUrl = process.env.DATABASE_URL;
    const admin = new pg.Client({ connectionString: originalUrl });
    await admin.connect();
    try {
      for (const outcome of ["success", "assertion", "setup"] as const) {
        let databaseName = "";
        const run = withTestDatabase(async ({ name, url }) => {
          databaseName = name;
          assert.notEqual(
            new URL(url).pathname,
            new URL(originalUrl!).pathname,
          );
          assert.equal(process.env.DATABASE_URL, url);
          const fixture = new pg.Client({ connectionString: url });
          await fixture.connect();
          try {
            await fixture.query(
              "CREATE TABLE fixture (id integer PRIMARY KEY)",
            );
            await fixture.query("INSERT INTO fixture VALUES (1)");
            if (outcome === "assertion")
              assert.fail("intentional test failure");
            if (outcome === "setup") await fixture.query("INVALID SETUP SQL");
          } finally {
            await fixture.end();
          }
        });
        if (outcome === "success") await run;
        else
          await assert.rejects(
            run,
            outcome === "assertion"
              ? /intentional test failure/
              : /syntax error/,
          );
        assert.equal(process.env.DATABASE_URL, originalUrl);
        assert.equal(
          (
            await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [
              databaseName,
            ])
          ).rowCount,
          0,
        );
      }
    } finally {
      await admin.end();
    }
  },
);
