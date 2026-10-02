import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { pool, transaction } from "./db";
import { auth } from "./auth";
import { createAccount, roles } from "./accounts";
import { renderPreview, renderPdf } from "./render";
import { normalizeRichText } from "./rich-text";
import {
  createExam,
  applyAction,
  DEFAULT_TEMPLATE,
  copyExam,
  assertActionShape,
} from "../lib/domain";
const storage = process.env.STORAGE_DIR || "./storage";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request) {
  if (Number(req.headers.get("content-length")) > 2_000_000)
    fail(413, "Inhoud te groot.");
  return req.json();
}
async function session(req: Request) {
  const s = await auth.api.getSession({ headers: req.headers });
  if (!s) return null;
  const { rows } = await pool.query(
    'SELECT id,name,email,role,banned FROM "user" WHERE id=$1',
    [s.user.id],
  );
  return rows[0] && !rows[0].banned ? rows[0] : null;
}
function officeSummary(e: any) {
  return {
    id: e.id,
    title: e.title,
    teamId: e.teamId,
    status: e.status,
    version: e.version,
    revision: e.revision,
    pta: e.pta,
    activeReleasedRevisions: (e.snapshots || [])
      .filter((s: any) => s.releasedAt && !s.withdrawnAt)
      .map((s: any) => ({ revision: s.revision, releasedAt: s.releasedAt })),
    withdrawals: (e.snapshots || [])
      .filter((s: any) => s.withdrawnAt)
      .map((s: any) => ({
        revision: s.revision,
        withdrawnAt: s.withdrawnAt,
        reason: s.withdrawalReason,
      })),
  };
}
async function authorize(c: any, id: string, user: any, lock = false) {
  if (lock) {
    const fresh = (
      await c.query('SELECT role,banned FROM "user" WHERE id=$1 FOR SHARE', [
        user.id,
      ])
    ).rows[0];
    if (!fresh || fresh.banned || fresh.role !== user.role)
      fail(403, "Uw bevoegdheden zijn gewijzigd. Log opnieuw in.");
  }

  const { rows } = await c.query(
    `SELECT * FROM exams WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
    [id],
  );
  const row = rows[0];
  if (!row) fail(404, "Examen niet gevonden.");
  if (
    user.role === "committee" &&
    !["submitted", "reviewing", "released", "withdrawn"].includes(
      row.payload.status,
    ) &&
    !row.payload.snapshots?.some((s: any) => s.releasedAt)
  )
    fail(403, "Dit examen is nog niet ingediend.");
  if (user.role === "admin")
    fail(403, "Platformbeheer geeft geen toegang tot exameninhoud.");
  if (user.role === "teacher") {
    const m = await c.query(
      `SELECT 1 FROM memberships WHERE team_id=$1 AND user_id=$2 ${lock ? "FOR SHARE" : ""}`,
      [row.team_id, user.id],
    );
    if (!m.rowCount) fail(403, "Geen toegang tot dit team.");
  }
  if (
    user.role === "office" &&
    !row.payload.snapshots?.some((s: any) => s.releasedAt)
  )
    fail(403, "Dit examen is niet vrijgegeven.");
  return row;
}
async function currentTemplate(c = pool) {
  const { rows } = await c.query(
    "SELECT payload FROM templates WHERE published=true ORDER BY version DESC LIMIT 1",
  );
  return rows[0]?.payload || DEFAULT_TEMPLATE;
}
async function persist(c: any, exam: any, actor: string, action: string) {
  await c.query(
    "UPDATE exams SET payload=$2,version=$3,updated_at=now() WHERE id=$1",
    [exam.id, exam, exam.version],
  );
  await c.query(
    "INSERT INTO revisions (exam_id,version,payload,actor_id) VALUES ($1,$2,$3,$4)",
    [exam.id, exam.version, exam, actor],
  );
  await c.query(
    "INSERT INTO audit (exam_id,actor_id,action) VALUES ($1,$2,$3)",
    [exam.id, actor, action],
  );
}
export async function handleApi(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url),
      route = url.pathname.replace(/\/$/, "");
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const expected = new URL(process.env.BETTER_AUTH_URL || req.url).origin;
      if (origin !== expected) fail(403, "Ongeldige verzoekherkomst.");
    }
    if (route.startsWith("/api/auth/")) {
      if (
        ![
          "/api/auth/sign-in/email",
          "/api/auth/sign-out",
          "/api/auth/get-session",
          "/api/auth/change-password",
        ].includes(route)
      )
        fail(404, "Niet beschikbaar.");
      return auth.handler(req);
    }
    const user = await session(req);
    if (route === "/api/session") return json({ user });
    if (!user) fail(401, "Log in om verder te gaan.");
    if (route === "/api/dashboard") {
      const teams = await pool.query(
        user.role === "teacher"
          ? "SELECT t.* FROM teams t JOIN memberships m ON m.team_id=t.id WHERE m.user_id=$1"
          : "SELECT * FROM teams",
        user.role === "teacher" ? [user.id] : [],
      );
      const exams =
        user.role === "admin"
          ? { rows: [] }
          : await pool.query(
              user.role === "teacher"
                ? "SELECT e.payload FROM exams e JOIN memberships m ON m.team_id=e.team_id WHERE m.user_id=$1 ORDER BY e.updated_at DESC"
                : user.role === "office"
                  ? "SELECT payload FROM exams WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'snapshots') s WHERE s->>'releasedAt' IS NOT NULL) ORDER BY updated_at DESC"
                  : "SELECT payload FROM exams WHERE payload->>'status' IN ('submitted','reviewing','released','withdrawn') OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'snapshots') s WHERE s->>'releasedAt' IS NOT NULL) ORDER BY updated_at DESC",
              user.role === "teacher" ? [user.id] : [],
            );
      const members = await pool.query(
        'SELECT u.id,u.name,u.email,u.role,m.team_id AS "teamId" FROM "user" u JOIN memberships m ON m.user_id=u.id WHERE m.team_id=ANY($1::text[])',
        [teams.rows.map((t) => t.id)],
      );
      return json({
        user,
        teams: teams.rows,
        exams: exams.rows.map((e) =>
          user.role === "office" ? officeSummary(e.payload) : e.payload,
        ),
        members: members.rows,
        templates: [await currentTemplate()],
      });
    }
    if (route === "/api/admin") {
      if (user.role !== "admin") fail(403, "Alleen platformbeheer.");
      if (req.method === "GET") {
        const [users, teams, memberships, templates] = await Promise.all([
          pool.query(
            'SELECT id,name,email,role,banned FROM "user" ORDER BY name',
          ),
          pool.query("SELECT * FROM teams"),
          pool.query(
            'SELECT team_id AS "teamId",user_id AS "userId" FROM memberships',
          ),
          pool.query(
            "SELECT payload,published FROM templates ORDER BY version DESC",
          ),
        ]);
        return json({
          users: users.rows,
          teams: teams.rows,
          memberships: memberships.rows,
          templates: templates.rows.map((t) => ({
            ...t.payload,
            published: t.published,
          })),
        });
      }
      if (req.method !== "POST") fail(405, "Methode niet toegestaan.");
      const b = await body(req);
      if (b.action === "create-user")
        return json({
          user: await createAccount(b.name, b.email, b.password, b.role),
        });
      await transaction(async (c) => {
        if (b.action === "update-user") {
          if (!roles.includes(b.role))
            fail(400, "Kies precies één geldige rol.");
          if (b.userId === user.id && (b.role !== "admin" || b.banned))
            fail(
              400,
              "U kunt uw eigen beheeraccount niet blokkeren of degraderen.",
            );
          await c.query(
            'UPDATE "user" SET role=$2,banned=$3,"updatedAt"=now() WHERE id=$1',
            [b.userId, b.role, !!b.banned],
          );
          if (b.role !== "teacher" || b.banned)
            await c.query("DELETE FROM memberships WHERE user_id=$1", [
              b.userId,
            ]);
          await c.query('DELETE FROM session WHERE "userId"=$1', [b.userId]);
          await c.query("DELETE FROM edit_locks WHERE user_id=$1", [b.userId]);
        } else if (b.action === "create-team") {
          if (!b.name?.trim()) fail(400, "Teamnaam ontbreekt.");
          await c.query("INSERT INTO teams(id,name) VALUES($1,$2)", [
            randomUUID(),
            b.name.trim(),
          ]);
        } else if (b.action === "membership") {
          const u = await c.query(
            'SELECT role,banned FROM "user" WHERE id=$1 FOR UPDATE',
            [b.userId],
          );
          if (u.rows[0]?.role !== "teacher" || u.rows[0]?.banned)
            fail(400, "Alleen actieve docenten kunnen teamlid zijn.");
          if (b.remove) {
            await c.query(
              "DELETE FROM memberships WHERE team_id=$1 AND user_id=$2",
              [b.teamId, b.userId],
            );
            await c.query(
              "DELETE FROM edit_locks WHERE user_id=$1 AND exam_id IN (SELECT id FROM exams WHERE team_id=$2)",
              [b.userId, b.teamId],
            );
          } else
            await c.query(
              "INSERT INTO memberships(team_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [b.teamId, b.userId],
            );
        } else if (b.action === "reset-password") {
          if (typeof b.password !== "string" || b.password.length < 12)
            fail(400, "Minimaal 12 tekens vereist.");
          const { hashPassword } = await import("better-auth/crypto");
          await c.query(
            'UPDATE account SET password=$2,"updatedAt"=now() WHERE "userId"=$1 AND "providerId"=\'credential\'',
            [b.userId, await hashPassword(b.password)],
          );
          await c.query('DELETE FROM session WHERE "userId"=$1', [b.userId]);
        } else if (b.action === "template") {
          if (
            !Array.isArray(b.items) ||
            !b.items.length ||
            b.items.some(
              (i: any) => typeof i.text !== "string" || !i.text.trim(),
            )
          )
            fail(400, "Controlepunten moeten een omschrijving hebben.");
          const items = b.items.map((i: any) => ({
            id: typeof i.id === "string" && i.id ? i.id : randomUUID(),
            text: i.text.trim(),
            explanation: typeof i.explanation === "string" ? i.explanation : "",
            active: i.active !== false,
            required: i.required === true,
          }));
          if (new Set(items.map((i: any) => i.id)).size !== items.length)
            fail(400, "Controlepunten moeten unieke identificaties hebben.");
          if (b.publish && !items.some((i: any) => i.required && i.active))
            fail(
              400,
              "Publicatie vereist minstens één verplicht actief controlepunt.",
            );
          await c.query("LOCK TABLE templates IN EXCLUSIVE MODE");
          const v = await c.query(
            "SELECT COALESCE(MAX(version),0)+1 AS version FROM templates",
          );
          const version = v.rows[0].version;
          const template = {
            id: randomUUID(),
            version,
            title:
              typeof b.title === "string" && b.title.trim()
                ? b.title.trim()
                : "Collegiale controle",
            publishedAt: b.publish ? new Date().toISOString() : undefined,
            items,
          };
          await c.query(
            "INSERT INTO templates(id,version,published,payload) VALUES($1,$2,$3,$4)",
            [template.id, version, !!b.publish, template],
          );
        } else fail(400, "Onbekende beheeractie.");
        await c.query(
          "INSERT INTO audit(actor_id,action,detail) VALUES($1,$2,$3)",
          [user.id, b.action, { userId: b.userId, teamId: b.teamId }],
        );
      });
      return json({ ok: true });
    }
    if (route === "/api/exams" && req.method === "POST") {
      if (user.role !== "teacher") fail(403, "Alleen docenten maken examens.");
      const b = await body(req);
      const m = await pool.query(
        "SELECT 1 FROM memberships WHERE team_id=$1 AND user_id=$2",
        [b.teamId, user.id],
      );
      if (!m.rowCount) fail(403, "Geen toegang tot dit team.");
      const exam: any = {
        ...createExam(
          randomUUID(),
          b.teamId,
          b.title || "Nieuw examen",
          await currentTemplate(),
        ),
        version: 1,
      };
      await transaction(async (c) => {
        await c.query(
          "INSERT INTO exams(id,team_id,payload,version) VALUES($1,$2,$3,$4)",
          [exam.id, exam.teamId, exam, exam.version],
        );
        await c.query(
          "INSERT INTO revisions(exam_id,version,payload,actor_id) VALUES($1,$2,$3,$4)",
          [exam.id, exam.version, exam, user.id],
        );
      });
      return json({ exam }, 201);
    }
    const fileMatch = route.match(/^\/api\/files\/([^/]+)$/);
    if (fileMatch && req.method === "GET") {
      if (user.role === "office")
        fail(403, "Alleen officiële vrijgegeven pdf’s zijn beschikbaar.");
      const f = (
        await pool.query("SELECT * FROM files WHERE id=$1", [fileMatch[1]])
      ).rows[0];
      if (!f) fail(404, "Bestand ontbreekt.");
      await authorize(pool, f.exam_id, user);
      return new Response(await readFile(f.path), {
        headers: {
          "Content-Type": f.mime,
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const match = route.match(
      /^\/api\/exams\/([^/]+)(?:\/(preview|download|lock|unlock|files))?$/,
    );
    if (!match) fail(404, "Niet gevonden.");
    const [, id, sub] = match!;
    if (
      sub &&
      ["lock", "unlock", "files"].includes(sub) &&
      req.method !== "POST"
    )
      fail(405, "Methode niet toegestaan.");
    if (sub === "preview" || sub === "download") {
      if (req.method !== "GET") fail(405, "Methode niet toegestaan.");
      return await transaction(async (c) => {
        const row = await authorize(c, id, user, true);
        let exam = row.payload;
        const kind =
          url.searchParams.get("kind") === "answers" ? "answers" : "exam";
        if (sub === "preview") {
          if (!["teacher", "committee"].includes(user.role))
            fail(403, "Geen previewtoegang.");
          return new Response(await renderPreview(exam, kind), {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }
        if (user.role !== "office")
          fail(
            403,
            "Alleen het examenbureau kan vrijgegeven pdf’s downloaden.",
          );
        const requested = url.searchParams.get("revision");
        const snapshot = requested
          ? exam.snapshots.find((s: any) => s.revision === Number(requested))
          : [...exam.snapshots]
              .reverse()
              .find((s: any) => s.releasedAt && !s.withdrawnAt);
        if (!snapshot?.releasedAt || snapshot.withdrawnAt)
          fail(
            403,
            "Deze examenrevisie is niet vrijgegeven of is ingetrokken.",
          );
        exam = {
          ...snapshot.content,
          status: "released",
          snapshots: [snapshot],
          version: row.version,
        };

        await mkdir(storage, { recursive: true });
        const pdfPath = path.resolve(
          storage,
          `pdf-${id}-${exam.revision}-${kind}.pdf`,
        );
        let pdf: Buffer;
        try {
          pdf = await readFile(pdfPath);
        } catch {
          pdf = await renderPdf(exam, kind);
          await writeFile(pdfPath, pdf, { mode: 0o600 });
        }
        await c.query(
          "INSERT INTO audit(exam_id,actor_id,action,detail) VALUES($1,$2,'download',$3)",
          [
            id,
            user.id,
            { version: exam.version, revision: exam.revision, kind },
          ],
        );
        return new Response(new Uint8Array(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="examen-${id}-v${exam.version}-${kind}.pdf"`,
            "Cache-Control": "private, no-store",
          },
        });
      });
    }
    if (sub === "files" && req.method === "POST") {
      return await transaction(async (c) => {
        const uploadExam = await authorize(c, id, user, true);
        if (!["draft", "peer-reviewed"].includes(uploadExam.payload.status))
          fail(403, "Dit examen is niet bewerkbaar.");
        if (user.role !== "teacher") fail(403, "Alleen docenten uploaden.");
        if (Number(req.headers.get("content-length")) > 10_500_000)
          fail(413, "Bestand te groot (maximaal 10 MB).");
        const form = await req.formData(),
          file = form.get("file");
        if (!(file instanceof File) || file.size > 10_000_000)
          fail(400, "Selecteer een bestand tot 10 MB.");
        const upload = file as File;
        const bytes = Buffer.from(await upload.arrayBuffer());
        const mime = bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            ? "image/jpeg"
            : bytes.subarray(0, 4).toString() === "RIFF" &&
                bytes.subarray(8, 12).toString() === "WEBP"
              ? "image/webp"
              : bytes.subarray(0, 5).toString() === "%PDF-"
                ? "application/pdf"
                : null;
        if (!mime) fail(400, "Alleen PNG, JPEG, WebP en PDF zijn toegestaan.");
        const fid = randomUUID(),
          filePath = path.resolve(storage, fid);
        await mkdir(storage, { recursive: true });
        await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
        await c.query(
          "INSERT INTO files(id,exam_id,name,mime,path) VALUES($1,$2,$3,$4,$5)",
          [fid, id, upload.name, mime, filePath],
        );
        return json({
          id: fid,
          url: `/api/files/${fid}`,
          name: upload.name,
          mime,
        });
      });
    }
    if (req.method === "GET") {
      const row = await authorize(pool, id, user);
      if (user.role === "office")
        return json({ exam: officeSummary(row.payload) });
      const [history, audit, locks, members] = await Promise.all([
        pool.query(
          "SELECT version,payload,created_at FROM revisions WHERE exam_id=$1 ORDER BY version DESC",
          [id],
        ),
        pool.query(
          'SELECT a.*,u.name AS actor FROM audit a LEFT JOIN "user" u ON u.id=a.actor_id WHERE exam_id=$1 ORDER BY id DESC',
          [id],
        ),
        pool.query(
          'SELECT section_id AS "sectionId",user_id AS "userId",expires_at AS "expiresAt" FROM edit_locks WHERE exam_id=$1 AND expires_at>now()',
          [id],
        ),
        pool.query(
          'SELECT u.id,u.name,u.email FROM "user" u JOIN memberships m ON m.user_id=u.id WHERE m.team_id=$1',
          [row.team_id],
        ),
      ]);
      return json({
        exam: row.payload,
        history: history.rows,
        audit: audit.rows,
        locks: locks.rows,
        members: members.rows,
      });
    }
    if (req.method !== "POST") fail(405, "Methode niet toegestaan.");
    const b = await body(req);
    return await transaction(async (c) => {
      const row = await authorize(c, id, user, true);
      if (sub === "lock" || sub === "unlock") {
        if (
          user.role !== "teacher" ||
          !["draft", "peer-reviewed"].includes(row.payload.status)
        )
          fail(403, "Alleen een concept kan worden bewerkt.");
        if (!b.sectionId) fail(400, "Onderdeel ontbreekt.");
        if (sub === "unlock")
          await c.query(
            "DELETE FROM edit_locks WHERE exam_id=$1 AND section_id=$2 AND (user_id=$3 OR expires_at<now())",
            [id, b.sectionId, user.id],
          );
        else {
          const r = await c.query(
            `INSERT INTO edit_locks(exam_id,section_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes') ON CONFLICT(exam_id,section_id) DO UPDATE SET user_id=$3,expires_at=now()+interval '10 minutes' WHERE edit_locks.user_id=$3 OR edit_locks.expires_at<now() RETURNING *`,
            [id, b.sectionId, user.id],
          );
          if (!r.rowCount)
            fail(409, "Dit onderdeel wordt door een collega bewerkt.");
        }
        return json({ ok: true });
      }
      if (b.version !== row.version)
        fail(
          409,
          "Het examen is gewijzigd. Vernieuw de pagina voordat u verdergaat.",
        );
      const members = (
        await c.query(
          "SELECT user_id FROM memberships m JOIN \"user\" u ON u.id=m.user_id WHERE team_id=$1 AND u.role='teacher' AND NOT COALESCE(u.banned,false) FOR SHARE OF u,m",
          [row.team_id],
        )
      ).rows.map((r) => r.user_id);
      const action =
        b.action && typeof b.action === "object"
          ? b.action
          : { ...b, type: b.action || b.type };
      if (
        ![
          "update",
          "save-section",
          "assign-section",
          "remove-section",
          "reorder",
          "save-matrix",
          "establish-matrix",
          "switch-template",
          "review",
          "finding",
          "resolve-finding",
          "close-finding",
          "submit",
          "start-review",
          "release",
          "return",
          "withdraw",
          "withdraw-revision",
          "new-revision",
          "copy",
        ].includes(action.type)
      )
        fail(400, "Onbekende examenactie.");
      const actor = {
        id: user.id,
        role: user.role,
        teamIds: members.includes(user.id) ? [row.team_id] : [],
      };
      if (action.type === "copy") {
        const copied: any = {
          ...copyExam(row.payload, actor, await currentTemplate(c as any)),
          version: 1,
        };
        const sourceFiles = (
          await c.query("SELECT * FROM files WHERE exam_id=$1", [id])
        ).rows;
        const copies = [];
        for (const f of sourceFiles) {
          const fid = randomUUID(),
            p = path.resolve(storage, fid);
          await copyFile(f.path, p);
          copies.push({ ...f, id: fid, path: p });
          copied.sections.forEach((s: any) => {
            s.text = s.text.replaceAll(
              `/api/files/${f.id}`,
              `/api/files/${fid}`,
            );
          });
          if (copied.pta.referenceFileId === f.id)
            copied.pta.referenceFileId = fid;
        }
        await c.query(
          "INSERT INTO exams(id,team_id,payload,version) VALUES($1,$2,$3,1)",
          [copied.id, copied.teamId, copied],
        );
        for (const f of copies)
          await c.query(
            "INSERT INTO files(id,exam_id,name,mime,path) VALUES($1,$2,$3,$4,$5)",
            [f.id, copied.id, f.name, f.mime, f.path],
          );
        await c.query(
          "INSERT INTO revisions(exam_id,version,payload,actor_id) VALUES($1,1,$2,$3)",
          [copied.id, copied, user.id],
        );
        return json({ exam: copied }, 201);
      }
      if (action.type === "switch-template")
        action.template = await currentTemplate(c as any);
      assertActionShape(action);
      if (action.type === "update" && action.pta?.referenceFileId) {
        const reference = await c.query(
          "SELECT 1 FROM files WHERE id=$1 AND exam_id=$2",
          [action.pta.referenceFileId, id],
        );
        if (!reference.rowCount)
          fail(400, "PTA-bestand behoort niet tot dit examen.");
      }
      if (action.type === "assign-section") {
        if (
          !members.includes(action.authorId) ||
          !members.includes(action.reviewerId)
        )
          fail(400, "Auteur en reviewer moeten actieve teamleden zijn.");
        const existingLock = await c.query(
          "SELECT user_id FROM edit_locks WHERE exam_id=$1 AND section_id=$2 AND expires_at>now()",
          [id, action.sectionId],
        );
        if (existingLock.rows[0] && existingLock.rows[0].user_id !== user.id)
          fail(
            409,
            "Een collega bewerkt dit onderdeel; probeer later opnieuw.",
          );
      }
      if (action.type === "save-section") {
        if (
          !action.section ||
          !members.includes(action.section.authorId) ||
          !members.includes(action.section.reviewerId)
        )
          fail(
            400,
            "Auteur en reviewer moeten actieve docenten van dit team zijn.",
          );
        const l = await c.query(
          "SELECT user_id FROM edit_locks WHERE exam_id=$1 AND section_id=$2 AND expires_at>now()",
          [id, action.section.id],
        );
        if (l.rows[0]?.user_id !== user.id)
          fail(409, "Neem eerst een bewerkvergrendeling op dit onderdeel.");
        action.section.text = normalizeRichText(action.section.text);
        const imageIds = [
          ...action.section.text.matchAll(/src="\/api\/files\/([^"]+)"/g),
        ].map((m: any) => m[1]);
        if (imageIds.length) {
          const images = await c.query(
            "SELECT id FROM files WHERE exam_id=$1 AND id=ANY($2::text[])",
            [id, imageIds],
          );
          if (images.rowCount !== new Set(imageIds).size)
            fail(400, "Afbeelding behoort niet tot dit examen.");
        }
      }
      if (
        ["submit", "release"].includes(action.type) &&
        row.payload.sections.some(
          (s: any) =>
            !members.includes(s.authorId) || !members.includes(s.reviewerId),
        )
      )
        fail(
          400,
          "Alle auteurs en reviewers moeten nog actieve teamleden zijn.",
        );
      const exam: any = applyAction(row.payload, actor, action);
      if (
        row.locked_n_term !== null &&
        String(exam.nTerm) !== String(row.locked_n_term)
      )
        fail(400, "De N-term is blijvend vergrendeld.");
      if (exam.nTermLock && !row.locked_at)
        await c.query(
          "UPDATE exams SET locked_n_term=$2,locked_at=now(),locked_by=$3 WHERE id=$1",
          [id, String(exam.nTerm), user.id],
        );
      exam.version = row.version + 1;
      await persist(c, exam, user.id, action.type);
      return json({ exam });
    });
  } catch (error: any) {
    if (error.status) return json({ error: error.message }, error.status);
    if (error.code === "23505")
      return json({ error: "Deze waarde bestaat al." }, 409);
    if (error.code === "23503")
      return json({ error: "Een verwijzing bestaat niet." }, 400);
    if (error.code) console.error(error);
    if (error.code)
      return json(
        { error: "De database kon dit verzoek niet verwerken." },
        500,
      );
    return json({ error: error.message || "Verzoek mislukt." }, 400);
  }
}
