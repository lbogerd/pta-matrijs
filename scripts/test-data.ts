import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pool, transaction } from "../src/server/db";
import { createAccount } from "../src/server/accounts";
import { examFixture } from "./exam-fixture";

export interface TestScope {
  teamIds: string[];
  teamNames?: string[];
  emails: string[];
  templateIds?: string[];
  templateMarker?: string;
  auditIds?: string[];
  files?: string[];
}
const storage = path.resolve(process.env.STORAGE_DIR || "./storage");
const journals = path.join(storage, ".test-runs");

/** Exact, run-owned selectors only. File paths are journaled before DB deletion for retry. */
export async function cleanupTestData(
  scope: TestScope,
  checkpoint?: (s: TestScope) => Promise<void>,
) {
  const removed = await transaction(async (c) => {
    const teams = (
      await c.query(
        "SELECT id FROM teams WHERE id=ANY($1::text[]) OR name=ANY($2::text[]) FOR UPDATE",
        [scope.teamIds, scope.teamNames || []],
      )
    ).rows.map((r) => r.id);
    const users = (
      await c.query(
        'SELECT id FROM "user" WHERE email=ANY($1::text[]) FOR UPDATE',
        [scope.emails],
      )
    ).rows.map((r) => r.id);
    const exams = (
      await c.query(
        "SELECT id FROM exams WHERE team_id=ANY($1::text[]) FOR UPDATE",
        [teams],
      )
    ).rows.map((r) => r.id);
    const templates = (
      await c.query(
        `SELECT id FROM templates WHERE id=ANY($1::text[]) OR ($2::text IS NOT NULL AND payload->'items' @> jsonb_build_array(jsonb_build_object('text',$2::text)))`,
        [scope.templateIds || [], scope.templateMarker || null],
      )
    ).rows.map((r) => r.id);
    const referenced = await c.query(
      `SELECT id FROM exams WHERE NOT(id=ANY($1::text[])) AND (payload->'template'->>'id'=ANY($2::text[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'snapshots') s WHERE s->'content'->'template'->>'id'=ANY($2::text[])))`,
      [exams, templates],
    );
    if (referenced.rowCount)
      throw new Error(
        "Refusing to delete a test template used by an unrelated exam.",
      );
    const uploaded = (
      await c.query("SELECT path FROM files WHERE exam_id=ANY($1::text[])", [
        exams,
      ])
    ).rows.map((r) => path.resolve(r.path));
    const names = await readdir(storage).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return [];
      throw e;
    });
    const pdfs = names
      .filter((name) =>
        exams.some(
          (id) =>
            name.startsWith(`pdf-${id}-`) &&
            /^\d+-(exam|answers)\.pdf$/.test(name.slice(`pdf-${id}-`.length)),
        ),
      )
      .map((name) => path.join(storage, name));
    scope.files = [...new Set([...(scope.files || []), ...uploaded, ...pdfs])];
    for (const file of scope.files)
      if (path.dirname(path.resolve(file)) !== storage)
        throw new Error("Refusing to remove a file outside private storage.");
    if (checkpoint) await checkpoint(scope);
    await c.query('DELETE FROM session WHERE "userId"=ANY($1::text[])', [
      users,
    ]);
    await c.query(
      "DELETE FROM edit_locks WHERE exam_id=ANY($1::text[]) OR user_id=ANY($2::text[])",
      [exams, users],
    );
    await c.query("DELETE FROM files WHERE exam_id=ANY($1::text[])", [exams]);
    await c.query("DELETE FROM revisions WHERE exam_id=ANY($1::text[])", [
      exams,
    ]);
    await c.query(
      "DELETE FROM audit WHERE exam_id=ANY($1::text[]) OR actor_id=ANY($2::text[]) OR id=ANY($3::bigint[])",
      [exams, users, scope.auditIds || []],
    );
    await c.query("DELETE FROM exams WHERE id=ANY($1::text[])", [exams]);
    await c.query(
      "DELETE FROM memberships WHERE team_id=ANY($1::text[]) OR user_id=ANY($2::text[])",
      [teams, users],
    );
    await c.query("DELETE FROM teams WHERE id=ANY($1::text[])", [teams]);
    await c.query("DELETE FROM templates WHERE id=ANY($1::text[])", [
      templates,
    ]);
    await c.query("DELETE FROM verification WHERE identifier=ANY($1::text[])", [
      scope.emails,
    ]);
    await c.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
    return {
      exams: exams.length,
      teams: teams.length,
      accounts: users.length,
      templates: templates.length,
      files: scope.files.length,
    };
  });
  for (const file of scope.files || []) await rm(file, { force: true });
  return removed;
}

export async function serveTestData() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for test data cleanup.");
  // Held for this process lifetime. A crashed runner releases the lock; its journal is
  // recovered by the next run. Simultaneous runs against this deployment fail closed.
  const lock = await pool.connect();
  let acquired = false;
  const runId = `e2e-${randomUUID()}`;
  const domain = `${runId}.example.test`;
  const password = randomBytes(24).toString("base64url");
  const keys = [
    "author",
    "reviewer",
    "committee",
    "office",
    "outsider",
    "admin",
  ];
  const scope: TestScope = {
    teamIds: [runId],
    teamNames: [`${runId} UI team`],
    emails: keys.map((k) => `${k}@${domain}`),
    templateMarker: `${runId}: controleer de bronvermelding zorgvuldig.`,
  };
  const journal = path.join(journals, `${runId}.json`);
  const checkpoint = async (s: TestScope) => {
    const temp = journal + ".tmp";
    await writeFile(temp, JSON.stringify(s), { mode: 0o600 });
    const { rename } = await import("node:fs/promises");
    await rename(temp, journal);
  };
  // Read EOF before setup: even a runner that dies during account provisioning gets cleanup.
  const disconnected = new Promise<void>((resolve) => {
    process.stdin.on("end", resolve);
    process.stdin.on("error", resolve);
    process.stdin.resume();
  });
  try {
    acquired = (
      await lock.query("SELECT pg_try_advisory_lock(705317,1) AS locked")
    ).rows[0].locked;
    if (!acquired)
      throw new Error("Another browser test run is active on this database.");
    await mkdir(journals, { recursive: true, mode: 0o700 });
    for (const name of await readdir(journals)) {
      if (/^e2e-[a-f0-9-]+\.json\.tmp$/.test(name)) {
        await rm(path.join(journals, name), { force: true });
        continue;
      }
      if (!/^e2e-[a-f0-9-]+\.json$/.test(name)) continue;
      const file = path.join(journals, name),
        previous: TestScope = JSON.parse(await readFile(file, "utf8"));
      await cleanupTestData(previous, (s) =>
        writeFile(file, JSON.stringify(s), { mode: 0o600 }),
      );
      await rm(file);
    }
    await checkpoint(scope);
    const users: Record<string, string> = {};
    for (const key of keys)
      users[key] = (
        await createAccount(
          `E2E ${key}`,
          `${key}@${domain}`,
          password,
          ["author", "reviewer", "outsider"].includes(key) ? "teacher" : key,
        )
      ).id;
    await transaction(async (c) => {
      await c.query("INSERT INTO teams(id,name) VALUES($1,$2)", [
        runId,
        `${runId} Engels`,
      ]);
      for (const key of ["author", "reviewer"])
        await c.query(
          "INSERT INTO memberships(team_id,user_id) VALUES($1,$2)",
          [runId, users[key]],
        );
      const exam = examFixture(`${runId}-reading`, runId, users);
      await c.query(
        "INSERT INTO exams(id,team_id,version,payload) VALUES($1,$2,1,$3)",
        [exam.id, runId, exam],
      );
      await c.query(
        "INSERT INTO revisions(exam_id,version,payload,actor_id) VALUES($1,1,$2,$3)",
        [exam.id, exam, users.author],
      );
    });
    process.stdout.write(
      JSON.stringify({
        runId,
        domain,
        password,
        examId: `${runId}-reading`,
        origin: process.env.APP_URL || process.env.BETTER_AUTH_URL,
      }) + "\n",
    );
    await disconnected;
  } finally {
    try {
      if (acquired) {
        await cleanupTestData(scope, checkpoint);
        await rm(journal, { force: true });
      }
    } finally {
      if (acquired) await lock.query("SELECT pg_advisory_unlock(705317,1)");
      lock.release();
      await pool.end();
    }
  }
}
if (process.argv[2] === "serve")
  serveTestData().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
    process.stdin.destroy();
  });
