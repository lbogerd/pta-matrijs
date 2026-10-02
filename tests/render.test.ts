import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { pool } from "../src/server/db";
import { renderPreview, renderPdf } from "../src/server/render";
import { createExam, gradeTable, type Exam } from "../src/lib/domain";

const exec = promisify(execFile);
function fixture(): Exam {
  const e = createExam("render-test", "team", "Reading <English> & context");
  e.pta = {
    schoolYear: "2026–2027",
    programme: "vmbo-tl",
    subject: "Engels",
    code: "EN-READ",
    material: "Reading",
    duration: 60,
    aids: "Dictionary",
    weight: "25%",
    scheduled: "P2",
    resit: true,
  };
  e.sections = [
    {
      id: "s",
      title: "A short passage",
      text: "<p>First paragraph about a journey.</p><p>Second paragraph about its destination.</p>",
      source: "Original classroom material",
      authorId: "private-author-id",
      reviewerId: "private-reviewer-id",
      contributors: ["private-author-id"],
      version: 1,
      questions: [
        {
          id: "q",
          text: "Where does the journey end?",
          options: ["At the coast", "In the mountains"],
          correct: 1,
          points: 60,
          category: "R",
          allocations: { g: 60 },
          rationale: "PRIVATE-RATIONALE explains the chosen response.",
          passage: "PRIVATE-EVIDENCE is the supporting text.",
        },
      ],
      findings: [
        {
          id: "f",
          text: "PRIVATE-REVIEW-FINDING",
          createdAt: "2026-01-01",
          createdBy: "private-reviewer-id",
          state: "closed",
        },
      ],
      review: {
        reviewerId: "private-reviewer-id",
        sectionVersion: 1,
        templateId: "standard",
        templateVersion: 1,
        answers: { "check-1": true },
        at: "2026-01-01",
      },
    },
  ];
  return e;
}

describe("shared official document layout", () => {
  before(() => {
    mock.method(pool, "query", async () => ({ rows: [] }));
  });
  after(() => mock.restoreAll());
  it("candidate HTML excludes answer keys, explanations and internal review data", async () => {
    const html = await renderPreview(fixture(), "exam");
    for (const secret of [
      "PRIVATE-RATIONALE",
      "PRIVATE-EVIDENCE",
      "PRIVATE-REVIEW-FINDING",
      "private-author-id",
      "private-reviewer-id",
      "Antwoord: B",
      "Score-cijfertabel",
    ])
      assert.equal(html.includes(secret), false, secret);
    assert.ok(html.includes("At the coast"));
    assert.ok(html.includes("In the mountains"));
    assert.ok(html.includes("CONCEPT — NIET VOOR AFNAME"));
    assert.ok(html.includes("Reading &lt;English&gt; &amp; context"));
  });
  it("answer HTML includes justification and exact half-up score table for every score", async () => {
    const html = await renderPreview(fixture(), "answers");
    assert.ok(html.includes("Antwoord: B · 60 punten"));
    assert.ok(html.includes("PRIVATE-RATIONALE"));
    assert.ok(html.includes("PRIVATE-EVIDENCE"));
    assert.equal(html.includes("PRIVATE-REVIEW-FINDING"), false);
    const rows = [
      ...html.matchAll(
        /<div class="grade-row"><span>(\d+)<\/span><span>(\d+\.\d)<\/span><\/div>/g,
      ),
    ].map((m) => ({ score: Number(m[1]), grade: m[2] }));
    assert.deepEqual(rows, gradeTable(60, "1"));
    assert.equal(rows[1].grade, "1.2");
    assert.equal(rows.at(-1)?.grade, "10.0");
  });
  it("uses stored released score table rather than silently recalculating it", async () => {
    const e = fixture();
    e.status = "released";
    const { snapshots, ...content } = structuredClone(e);
    const grades = gradeTable(60, "1.25");
    e.snapshots = [
      {
        revision: 1,
        submittedAt: "2026-01-01",
        submittedBy: "author",
        maxScore: 60,
        grades,
        content,
        releasedAt: "2026-01-02",
        releasedBy: "committee",
      },
    ];
    const html = await renderPreview(e, "answers");
    const rows = [
      ...html.matchAll(
        /<div class="grade-row"><span>(\d+)<\/span><span>(\d+\.\d)<\/span><\/div>/g,
      ),
    ].map((m) => ({ score: Number(m[1]), grade: m[2] }));
    assert.deepEqual(rows, grades);
    assert.ok(html.includes("VRIJGEGEVEN"));
    assert.equal(html.includes("CONCEPT — NIET VOOR AFNAME"), false);
  });
  it("sanitizes scripts, handlers and external images from rich text", async () => {
    const e = fixture();
    e.sections[0].text =
      '<p onclick="alert(42)">Safe text</p><script>PRIVATE-INJECTED-SCRIPT</script><img src="https://attacker.invalid/beacon" onerror="alert(42)"><img src="data:image/svg+xml,evil"><a href="javascript:alert(42)">Safe label</a>';
    const html = await renderPreview(e, "exam");
    for (const forbidden of [
      "onclick=",
      "onerror=",
      "attacker.invalid",
      "PRIVATE-INJECTED-SCRIPT",
      "data:image/svg+xml",
      "javascript:alert",
    ])
      assert.equal(html.includes(forbidden), false, forbidden);
    assert.ok(html.includes("Safe text"));
    assert.ok(html.includes("Safe label"));
  });
  it("paginates preview and official PDF with paragraph numbers and without candidate answer leakage", async () => {
    const e = fixture(),
      html = await renderPreview(e, "exam"),
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
    let pageCount = 0;
    try {
      const page = await browser.newPage();
      const library = await readFile(
        "node_modules/pagedjs/dist/paged.polyfill.js",
      );
      await page.route("**/*", (route) =>
        route.request().url().endsWith("/paged.polyfill.js")
          ? route.fulfill({ body: library, contentType: "text/javascript" })
          : route.abort(),
      );
      await page.setContent(
        html.replace(
          'src="/paged.polyfill.js"',
          'src="https://document.invalid/paged.polyfill.js"',
        ),
      );
      await page.waitForFunction(() =>
        Boolean((window as any).__PAGED_READY__),
      );
      pageCount = await page.locator(".pagedjs_page").count();
      assert.equal(pageCount, 2);
      const paragraphs = page.locator(".pagedjs_pages .passage > p");
      assert.equal(await paragraphs.count(), 2);
      assert.match(
        await paragraphs.first().innerText(),
        /First paragraph about a journey/,
      );
      assert.match(
        await paragraphs.nth(1).innerText(),
        /Second paragraph about its destination/,
      );
    } finally {
      await browser.close();
    }
    const pdf = await renderPdf(e, "exam"),
      dir = await mkdtemp(path.join(tmpdir(), "pta-render-"));
    try {
      const file = path.join(dir, "candidate.pdf");
      await writeFile(file, pdf);
      const { stdout: text } = await exec("pdftotext", ["-layout", file, "-"]);
      const { stdout: info } = await exec("pdfinfo", [file]);
      assert.match(info, new RegExp(`Pages:\\s+${pageCount}`));
      assert.match(text, /1\s+First paragraph about a journey/);
      assert.match(text, /2\s+Second paragraph about its destination/);
      assert.match(text, /Pagina 1 \/ 2/);
      assert.match(text, /Pagina 2 \/ 2/);
      for (const secret of [
        "PRIVATE-RATIONALE",
        "PRIVATE-EVIDENCE",
        "PRIVATE-REVIEW-FINDING",
        "Antwoord: B",
        "Score-cijfertabel",
      ])
        assert.equal(text.includes(secret), false, secret);
      assert.ok(text.includes("At the coast"));
      assert.ok(text.includes("In the mountains"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
