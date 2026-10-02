import setup from "../../tests/e2e/setup";
import type { FullConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
export default async function (config: FullConfig) {
  // Capture only against the dedicated, disposable local Compose project.
  if (process.env.E2E_COMPOSE_PROJECT !== "pta-demo-capture")
    throw new Error(
      "Use the isolated pta-demo-capture Compose project. See docs/demo.md.",
    );
  const cleanup = await setup(config);
  try {
    execFileSync(
      "sudo",
      [
        "-n",
        "docker",
        "compose",
        "--project-name",
        "pta-demo-capture",
        ...(process.env.E2E_COMPOSE_FILES || "")
          .split(":")
          .filter(Boolean)
          .flatMap((file) => ["--file", file]),
        "exec",
        "-T",
        "web",
        "node",
        "--input-type=module",
        "-e",
        `
      import pg from 'pg';
      const db = new pg.Client({connectionString: process.env.DATABASE_URL});
      await db.connect();
      await db.query('UPDATE teams SET name=$1 WHERE id=$2', ['Team Engels', process.argv[1]]);
      for (const [key, name] of Object.entries({author:'Noor de Vries',reviewer:'Sam Jansen',committee:'Eva Bakker',office:'Milan Visser'}))
        await db.query('UPDATE "user" SET name=$1 WHERE email=$2', [name, key+'@'+process.argv[1]+'.example.test']);
      await db.end();
    `,
        process.env.E2E_RUN_ID!,
      ],
      { stdio: "pipe" },
    );
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
