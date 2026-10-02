import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
const base = process.env.TEST_BASE_URL || "https://pta-matrijs.tainer.run";
const domain = process.env.SEED_EMAIL_DOMAIN || "pilot.pta-matrijs.local";
const password = process.env.SEED_PASSWORD!;
test.skip(
  !password,
  "Set SEED_PASSWORD to the private pilot-account password.",
);
async function login(browser: Browser, role: string) {
  const context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("E-mailadres").fill(`${role}@${domain}`);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/auth/sign-in/email"),
    );
    await page.getByRole("button", { name: "Inloggen" }).click();
    const r = await response;
    if (r.status() !== 429) break;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(1000, Number(r.headers()["retry-after"] || "10") * 1000),
      ),
    );
  }
  await expect(page.getByRole("button", { name: "Uitloggen" })).toBeVisible();
  return { context, page };
}
async function action(page: Page, id: string, act: any, version?: number) {
  const current = await (await page.request.get(`/api/exams/${id}`)).json();
  const r = await page.request.post(`/api/exams/${id}`, {
    headers: { origin: base },
    data: { version: version ?? current.exam.version, action: act },
  });
  return { response: r, data: await r.json() };
}
test("public deployment keeps application authentication and works on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(base + "/");
  await expect(page.getByRole("button", { name: "Inloggen" })).toBeVisible();
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
  expect(
    (await page.request.get("/api/exams/pilot-reading/preview")).status(),
  ).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/public-mobile.png",
    fullPage: true,
  });
});
test("complete controlled examination lifecycle, permissions, preview and PDF withdrawal", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const contexts: BrowserContext[] = [];
  try {
    const author = await login(browser, "author");
    contexts.push(author.context);
    const reviewer = await login(browser, "reviewer");
    contexts.push(reviewer.context);
    const committee = await login(browser, "committee");
    contexts.push(committee.context);
    const office = await login(browser, "office");
    contexts.push(office.context);
    const outsider = await login(browser, "outsider");
    contexts.push(outsider.context);
    await author.page.screenshot({
      path: "test-results/teacher-dashboard.png",
      fullPage: true,
    });
    let result = await action(author.page, "pilot-reading", { type: "copy" });
    expect(result.response.ok(), JSON.stringify(result.data)).toBe(true);
    let exam = result.data.exam;
    const id = exam.id;
    result = await action(author.page, id, {
      type: "update",
      title: `Acceptatie ${new Date().toISOString()}`,
      nTerm: "1.25",
    });
    expect(result.response.ok()).toBe(true);
    exam = result.data.exam;
    expect((await outsider.page.request.get(`/api/exams/${id}`)).status()).toBe(
      403,
    );
    expect(
      (await committee.page.request.get(`/api/exams/${id}`)).status(),
    ).toBe(403);
    expect(
      (await office.page.request.get(`/api/exams/${id}/download`)).status(),
    ).toBe(403);
    expect(
      (await action(author.page, id, { type: "submit" })).response.ok(),
    ).toBe(false);
    const stale = exam.version;
    result = await action(author.page, id, { type: "establish-matrix" });
    expect(result.response.ok()).toBe(true);
    exam = result.data.exam;
    expect(
      (
        await action(author.page, id, { type: "update", nTerm: "1" }, stale)
      ).response.status(),
    ).toBe(409);
    const section = exam.sections[0];
    const image = await author.page.request.post(`/api/exams/${id}/files`, {
      headers: { origin: base },
      multipart: {
        file: {
          name: "controle.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    });
    expect(image.ok()).toBe(true);
    const uploaded = await image.json();
    expect((await outsider.page.request.get(uploaded.url)).status()).toBe(403);
    expect((await office.page.request.get(uploaded.url)).status()).toBe(403);
    expect((await author.page.request.get(uploaded.url)).ok()).toBe(true);
    expect(
      (
        await author.page.request.post(`/api/exams/${id}/lock`, {
          headers: { origin: base },
          data: { sectionId: section.id },
        })
      ).ok(),
    ).toBe(true);
    section.text += `<p><img src="${uploaded.url}" alt="Controleafbeelding"></p>`;
    expect(
      (
        await action(author.page, id, { type: "save-section", section })
      ).response.ok(),
    ).toBe(true);
    const answers = Object.fromEntries(
      exam.template.items
        .filter((x: any) => x.active)
        .map((x: any) => [x.id, true]),
    );
    expect(
      (
        await action(author.page, id, {
          type: "review",
          sectionId: section.id,
          answers,
        })
      ).response.ok(),
    ).toBe(false);
    result = await action(reviewer.page, id, {
      type: "finding",
      sectionId: section.id,
      text: "Controleer de tekstpassage.",
    });
    expect(result.response.ok()).toBe(true);
    const finding = result.data.exam.sections[0].findings[0];
    expect(
      (
        await action(reviewer.page, id, {
          type: "review",
          sectionId: section.id,
          answers,
        })
      ).response.ok(),
    ).toBe(false);
    expect(
      (
        await action(author.page, id, {
          type: "resolve-finding",
          sectionId: section.id,
          findingId: finding.id,
          resolution: "De aangehaalde passage is gecontroleerd.",
        })
      ).response.ok(),
    ).toBe(true);
    expect(
      (
        await action(reviewer.page, id, {
          type: "close-finding",
          sectionId: section.id,
          findingId: finding.id,
        })
      ).response.ok(),
    ).toBe(true);
    result = await action(reviewer.page, id, {
      type: "review",
      sectionId: section.id,
      answers,
    });
    expect(result.response.ok()).toBe(true);
    await author.page.goto(`/api/exams/${id}/preview?kind=answers`);
    await expect(author.page.locator(".pagedjs_page").first()).toBeVisible();
    await expect(
      author.page.getByText("Score-cijfertabel", { exact: true }),
    ).toBeVisible();
    expect(
      await author.page.evaluate(() =>
        Boolean((window as any).__PAGED_READY__),
      ),
    ).toBe(true);
    await author.page.screenshot({
      path: "test-results/correction-preview.png",
      fullPage: true,
    });
    result = await action(author.page, id, { type: "submit" });
    expect(result.response.ok(), JSON.stringify(result.data)).toBe(true);
    exam = result.data.exam;
    expect(exam.nTermLock.value).toBe("1.25");
    const firstGrades = exam.snapshots[0].grades;
    expect(
      (
        await action(committee.page, id, { type: "update", nTerm: "2" })
      ).response.ok(),
    ).toBe(false);
    expect(
      (
        await action(committee.page, id, {
          type: "return",
          reason: "Hercontrole van de instructie gevraagd.",
        })
      ).response.ok(),
    ).toBe(true);
    expect(
      (
        await action(author.page, id, { type: "update", nTerm: "2" })
      ).response.ok(),
    ).toBe(false);
    exam = (await (await author.page.request.get(`/api/exams/${id}`)).json())
      .exam;
    expect(
      (
        await action(author.page, id, {
          type: "resolve-finding",
          findingId: exam.committeeFindings[0].id,
          resolution: "De instructie is opnieuw gecontroleerd.",
        })
      ).response.ok(),
    ).toBe(true);
    result = await action(author.page, id, { type: "submit" });
    expect(result.response.ok(), JSON.stringify(result.data)).toBe(true);
    expect(result.data.exam.snapshots[0].grades).toEqual(firstGrades);
    result = await action(committee.page, id, { type: "release" });
    expect(result.response.ok(), JSON.stringify(result.data)).toBe(true);
    exam = result.data.exam;
    expect(
      (await author.page.request.get(`/api/exams/${id}/download`)).status(),
    ).toBe(403);
    expect(
      (await committee.page.request.get(`/api/exams/${id}/download`)).status(),
    ).toBe(403);
    for (const kind of ["exam", "answers"]) {
      const r = await office.page.request.get(
        `/api/exams/${id}/download?kind=${kind}`,
      );
      expect(r.ok(), await r.text()).toBe(true);
      expect(r.headers()["content-type"]).toContain("application/pdf");
      const bytes = await r.body();
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      await test
        .info()
        .attach(`${kind}.pdf`, { body: bytes, contentType: "application/pdf" });
    }
    const preview = await author.page.request.get(
      `/api/exams/${id}/preview?kind=exam`,
    );
    const html = await preview.text();
    expect(html).not.toContain("De eerste alinea noemt");
    expect(html).not.toContain("Antwoord:");
    expect(html).not.toContain("Score-cijfertabel");
    result = await action(committee.page, id, {
      type: "withdraw",
      reason: "Acceptatietest voltooid; niet gebruiken voor afname.",
    });
    expect(result.response.ok()).toBe(true);
    expect(
      (await office.page.request.get(`/api/exams/${id}/download`)).status(),
    ).toBe(403);
    await office.page.reload();
    expect(
      (await action(author.page, id, { type: "new-revision" })).response.ok(),
    ).toBe(true);
    expect(
      (
        await action(author.page, id, { type: "update", nTerm: "2" })
      ).response.ok(),
    ).toBe(false);
    result = await action(author.page, id, { type: "copy" });
    expect(result.response.ok()).toBe(true);
    expect(result.data.exam.nTermLock).toBeUndefined();
    expect(result.data.exam.snapshots).toEqual([]);
    expect(result.data.exam.matrixVersions[0].establishedAt).toBeUndefined();
    expect(result.data.exam.sections.every((s: any) => !s.review)).toBe(true);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
