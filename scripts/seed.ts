import { examFixture } from "./exam-fixture";
import { pool } from "../src/server/db";
import { createAccount } from "../src/server/accounts";
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Set SEED_PASSWORD with at least 12 characters; keep credentials outside source control.",
  );
try {
  const users: Record<string, string> = {};
  for (const [key, name, role] of [
    ["author", "Robin de Vries", "teacher"],
    ["reviewer", "Sam Jansen", "teacher"],
    ["committee", "Alex Bakker", "committee"],
    ["office", "Jamie Visser", "office"],
    ["outsider", "Andere docent", "teacher"],
  ]) {
    const email = `${key}@${process.env.SEED_EMAIL_DOMAIN || "pilot.example"}`;
    const old = await pool.query('SELECT id FROM "user" WHERE email=$1', [
      email,
    ]);
    users[key] =
      old.rows[0]?.id || (await createAccount(name, email, password, role)).id;
  }
  const teamId = "pilot-english";
  await pool.query(
    "INSERT INTO teams(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [teamId, "Engels · vmbo-tl"],
  );
  for (const key of ["author", "reviewer"])
    await pool.query(
      "INSERT INTO memberships(team_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [teamId, users[key]],
    );
  const id = "pilot-reading";
  const e = examFixture(id, teamId, users);
  await pool.query(
    "INSERT INTO exams(id,team_id,payload,version) VALUES($1,$2,$3,1) ON CONFLICT DO NOTHING",
    [id, teamId, e],
  );
  await pool.query(
    "INSERT INTO revisions(exam_id,version,payload,actor_id) VALUES($1,1,$2,$3) ON CONFLICT DO NOTHING",
    [id, e, users.author],
  );
  console.log(
    "Pilot accounts and representative reading exam ready. Credentials supplied through SEED_PASSWORD.",
  );
} finally {
  await pool.end();
}
