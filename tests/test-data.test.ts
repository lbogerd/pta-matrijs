import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { withTestDatabase } from "./support/database";

test(
  "test cleanup removes complete owned graphs/files, preserves unrelated data, retries failed cleanup",
  { skip: !process.env.DATABASE_URL },
  async () =>
    withTestDatabase(async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "pta-cleanup-"));
      const previous = process.env.STORAGE_DIR;
      process.env.STORAGE_DIR = directory;
      const { pool, schema } = await import("../src/server/db");
      const { cleanupTestData } = await import("../scripts/test-data");
      try {
        await pool.query(schema);
        for (const id of ["real", "test"]) {
          await pool.query(
            "INSERT INTO \"user\"(id,name,email,role) VALUES($1,$1,$2,'teacher')",
            [id, `${id}@example.test`],
          );
          await pool.query(
            'INSERT INTO account(id,"accountId","providerId","userId") VALUES($1,$1,\'credential\',$1)',
            [id],
          );
          await pool.query(
            'INSERT INTO session(id,token,"userId","expiresAt") VALUES($1,$1,$1,now()+interval \'1 day\')',
            [id],
          );
          await pool.query("INSERT INTO teams(id,name) VALUES($1,$1)", [id]);
          await pool.query("INSERT INTO memberships VALUES($1,$1)", [id]);
          await pool.query(
            "INSERT INTO exams(id,team_id,payload) VALUES($1,$1,$2)",
            [id, { id, template: { id }, snapshots: [] }],
          );
          await pool.query(
            "INSERT INTO revisions(exam_id,version,payload,actor_id) VALUES($1,1,$2,$1)",
            [id, {}],
          );
          await pool.query(
            "INSERT INTO audit(exam_id,actor_id,action) VALUES($1,$1,'test')",
            [id],
          );
          await pool.query(
            "INSERT INTO edit_locks VALUES($1,'section',$1,now())",
            [id],
          );
          await pool.query(
            "INSERT INTO templates(id,version,payload) VALUES($1,$2,$3)",
            [id, id === "real" ? 1 : 2, { items: [{ text: id }] }],
          );
          await pool.query(
            "INSERT INTO files(id,exam_id,name,mime,path) VALUES($1,$1,$1,'image/png',$2)",
            [id, path.join(directory, id)],
          );
          await writeFile(path.join(directory, id), id);
          await writeFile(path.join(directory, `pdf-${id}-1-exam.pdf`), id);
        }
        // Failure before commit leaves both database and files intact.
        const scope = {
          teamIds: ["test"],
          emails: ["test@example.test"],
          templateMarker: "test",
          files: [] as string[],
        };
        await assert.rejects(
          cleanupTestData(scope, async () => {
            throw new Error("intentional checkpoint failure");
          }),
          /checkpoint failure/,
        );
        assert.equal(
          (await pool.query("SELECT count(*) FROM exams")).rows[0].count,
          "2",
        );
        assert.equal((await readdir(directory)).length, 4);
        const removed = await cleanupTestData(scope);
        assert.deepEqual(removed, {
          exams: 1,
          teams: 1,
          accounts: 1,
          templates: 1,
          files: 2,
        });
        for (const table of [
          "exams",
          "revisions",
          "files",
          "audit",
          "edit_locks",
          "teams",
          "memberships",
          "templates",
          '"user"',
          "session",
          "account",
        ])
          assert.equal(
            (await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
            "1",
            table,
          );
        assert.deepEqual((await readdir(directory)).sort(), [
          "pdf-real-1-exam.pdf",
          "real",
        ]);
        assert.equal(
          await readFile(path.join(directory, "real"), "utf8"),
          "real",
        );
        await cleanupTestData(scope); // Idempotent retry after database rows have gone.
        await assert.rejects(
          cleanupTestData({
            teamIds: [],
            emails: [],
            files: [path.join(directory, "..", "outside")],
          }),
          /outside private storage/,
        );
      } finally {
        await pool.end();
        await rm(directory, { recursive: true, force: true });
        if (previous === undefined) delete process.env.STORAGE_DIR;
        else process.env.STORAGE_DIR = previous;
      }
    }),
);

test(
  "browser fixture lease cleans on success, runner disconnect and interrupted-run recovery",
  { skip: !process.env.DATABASE_URL },
  async () =>
    withTestDatabase(async ({ url }) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "pta-lease-"));
      const pg = await import("pg");
      const db = new pg.default.Client({ connectionString: url });
      await db.connect();
      const { schema } = await import("../src/server/db");
      await db.query(schema);
      const start = async () => {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "scripts/test-data.ts", "serve"],
          {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, DATABASE_URL: url, STORAGE_DIR: directory },
          },
        );
        let errors = "";
        child.stderr.on("data", (c) => {
          errors += c;
        });
        const closed = new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(errors || `exit ${code}`)),
          );
        });
        void closed.catch(() => {});
        const ready = new Promise<any>((resolve, reject) => {
          let out = "";
          child.stdout.on("data", (c) => {
            out += c;
            if (out.includes("\n"))
              resolve(JSON.parse(out.slice(0, out.indexOf("\n"))));
          });
          void closed.then(() => reject(new Error("no handshake")), reject);
        });
        const data = await ready;
        return { child, closed, data };
      };
      try {
        for (const disconnect of [false, true]) {
          const fixture = await start();
          assert.equal(
            (await db.query('SELECT count(*) FROM "user"')).rows[0].count,
            "6",
          );
          // Simulates both normal teardown and a failed/killed runner closing its pipe.
          if (disconnect) fixture.child.stdin.destroy();
          else fixture.child.stdin.end();
          await fixture.closed;
          for (const table of [
            "exams",
            "revisions",
            "teams",
            "memberships",
            '"user"',
            "account",
          ])
            assert.equal(
              (await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
              "0",
              table,
            );
          assert.deepEqual(
            await readdir(path.join(directory, ".test-runs")),
            [],
          );
        }
        // The service itself cannot run finally after SIGKILL; next setup recovers its journal.
        const interrupted = await start();
        interrupted.child.kill("SIGKILL");
        await assert.rejects(interrupted.closed);
        const recovered = await start();
        assert.equal(
          (await db.query('SELECT count(*) FROM "user"')).rows[0].count,
          "6",
        );
        assert.equal(
          (
            await db.query("SELECT 1 FROM teams WHERE id=$1", [
              interrupted.data.runId,
            ])
          ).rowCount,
          0,
        );
        recovered.child.stdin.end();
        await recovered.closed;
        assert.equal(
          (await db.query('SELECT count(*) FROM "user"')).rows[0].count,
          "0",
        );
      } finally {
        await db.end();
        await rm(directory, { recursive: true, force: true });
      }
    }),
);
