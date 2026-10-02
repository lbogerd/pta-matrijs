import { spawn } from "node:child_process";
import type { FullConfig } from "@playwright/test";

/** A private CLI lease, never an HTTP cleanup endpoint. EOF triggers server-side cleanup. */
export default async function setup(config: FullConfig) {
  const direct = Boolean(process.env.E2E_DATABASE_URL);
  if (direct && !process.env.E2E_STORAGE_DIR)
    throw new Error(
      "Set E2E_STORAGE_DIR to the target application private storage directory.",
    );
  const sudo = process.env.E2E_DOCKER_SUDO === "1";
  const child = direct
    ? spawn(
        process.execPath,
        ["--import", "tsx", "scripts/test-data.ts", "serve"],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            DATABASE_URL: process.env.E2E_DATABASE_URL,
            STORAGE_DIR: process.env.E2E_STORAGE_DIR,
          },
        },
      )
    : spawn(
        sudo ? "sudo" : "docker",
        [
          ...(sudo ? ["-n", "docker"] : []),
          "compose",
          "exec",
          "-T",
          "web",
          "node",
          "--import",
          "tsx",
          "scripts/test-data.ts",
          "serve",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const finished = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`Test-data cleanup failed (exit ${code}): ${stderr}`),
          ),
    );
  });
  // Mark handled while setup waits for readiness; the error is rethrown by teardown.
  void finished.catch(() => {});
  const close = () => child.stdin.destroy();
  process.once("exit", close);
  const cleanup = async () => {
    child.stdin.end();
    try {
      await Promise.race([
        finished,
        new Promise<never>((_, reject) => {
          const t = setTimeout(
            () =>
              reject(
                new Error(
                  "Test cleanup timed out; the run journal is retained for recovery.",
                ),
              ),
            60000,
          );
          t.unref();
        }),
      ]);
    } finally {
      process.removeListener("exit", close);
    }
  };
  try {
    const data = await new Promise<any>((resolve, reject) => {
      let buffer = "";
      const timer = setTimeout(
        () => reject(new Error("Test fixture setup timed out.")),
        60000,
      );
      child.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes("\n")) {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(buffer.slice(0, buffer.indexOf("\n"))));
          } catch {
            reject(new Error("Invalid test fixture handshake."));
          }
        }
      });
      void finished.then(
        () => {
          clearTimeout(timer);
          reject(new Error("Test fixture process exited before readiness."));
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
    const target = String(config.projects[0].use.baseURL);
    if (!data.origin || new URL(data.origin).origin !== new URL(target).origin)
      throw new Error(
        "Test fixture database belongs to a different application URL.",
      );
    Object.assign(process.env, {
      E2E_RUN_ID: data.runId,
      SEED_EMAIL_DOMAIN: data.domain,
      SEED_PASSWORD: data.password,
      E2E_FIXTURE_EXAM_ID: data.examId,
      BOOTSTRAP_ADMIN_EMAIL: `admin@${data.domain}`,
      BOOTSTRAP_ADMIN_PASSWORD: data.password,
    });
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
