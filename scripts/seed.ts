import { randomUUID } from "node:crypto";
import { pool } from "../src/server/db";
import { createAccount } from "../src/server/accounts";
import { createExam, DEFAULT_TEMPLATE } from "../src/lib/domain";
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
  const e: any = {
    ...createExam(id, teamId, "Reading the world", DEFAULT_TEMPLATE),
    version: 1,
  };
  e.pta = {
    schoolYear: "2026–2027",
    programme: "Vavo · vmbo-tl",
    subject: "Engels",
    code: "EN-401",
    material: "Leesvaardigheid: informatie herkennen en interpreteren",
    duration: 60,
    aids: "Woordenboek Engels–Nederlands",
    weight: "25%",
    scheduled: "Periode 2",
    resit: true,
  };
  e.goals = [
    {
      id: "g1",
      domain: "Leesvaardigheid",
      description: "Specifieke informatie herkennen",
    },
    {
      id: "g2",
      domain: "Leesvaardigheid",
      description: "Een conclusie uit de tekst afleiden",
    },
  ];
  e.matrixVersions = [
    {
      version: 1,
      cells: {
        g1: { R: 1, T1: 0, T2: 0, I: 0 },
        g2: { R: 0, T1: 0, T2: 1, I: 0 },
      },
    },
  ];
  e.sections = [
    {
      id: randomUUID(),
      title: "A greener journey",
      text: "<p>At Westfield College, students are changing the way they travel. Last September, the school opened a secure bicycle shelter with space for eighty bikes.</p><p>Within three months, the number of students cycling to school doubled. Maya, a final-year student, says: “I used to take the bus. Now I cycle with my friends. It is quicker and I arrive feeling more awake.”</p><p>The head teacher believes that small changes matter. Next year the school plans to offer bicycle repair workshops, so that a flat tyre will no longer be a reason to leave a bike at home.</p>",
      source: "Oorspronkelijke proeftekst voor deze applicatie, 2026.",
      authorId: users.author,
      reviewerId: users.reviewer,
      contributors: [users.author],
      version: 1,
      findings: [],
      questions: [
        {
          id: randomUUID(),
          text: "How many bicycles fit in the new shelter?",
          options: ["Forty", "Eighty", "One hundred and sixty"],
          correct: 1,
          points: 1,
          category: "R",
          allocations: { g1: 1, g2: 0 },
          rationale: "De eerste alinea noemt de capaciteit expliciet.",
          passage: "space for eighty bikes",
        },
        {
          id: randomUUID(),
          text: "Why does the school plan to offer repair workshops?",
          options: [
            "To help students keep cycling",
            "To replace all school buses",
            "To make cycling slower",
          ],
          correct: 0,
          points: 1,
          category: "T2",
          allocations: { g2: 1 },
          rationale:
            "De workshops nemen een praktische belemmering voor fietsen weg.",
          passage:
            "a flat tyre will no longer be a reason to leave a bike at home",
        },
      ],
    },
  ];
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
