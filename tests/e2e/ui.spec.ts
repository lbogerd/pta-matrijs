import { test, expect, type Page } from "@playwright/test";
const base = process.env.TEST_BASE_URL || "https://pta-matrijs.tainer.run";
const domain = process.env.SEED_EMAIL_DOMAIN || "pilot.pta-matrijs.local";
const password = process.env.SEED_PASSWORD!;

async function login(page: Page, role: string) {
  await page.goto("/");
  await page
    .getByLabel("E-mailadres")
    .fill(
      role === "admin"
        ? process.env.BOOTSTRAP_ADMIN_EMAIL!
        : `${role}@${domain}`,
    );
  await page
    .getByLabel("Wachtwoord", { exact: true })
    .fill(role === "admin" ? process.env.BOOTSTRAP_ADMIN_PASSWORD! : password);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/auth/sign-in/email"),
    );
    await page.getByRole("button", { name: "Inloggen" }).click();
    const r = await response;
    if (r.status() !== 429) break;
    await page.waitForTimeout(
      Math.max(1000, Number(r.headers()["retry-after"] || "10") * 1000),
    );
  }
  await expect(page.getByRole("button", { name: "Uitloggen" })).toBeVisible();
}
test("teacher creates and edits an exam entirely through the public UI", async ({
  page,
}) => {
  await login(page, "author");
  await page.getByRole("button", { name: "Nieuw examen", exact: true }).click();
  const title = `UI acceptatie ${Date.now()}`;
  await page.getByLabel("Examentitel", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Examen aanmaken" }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  for (const [label, value] of [
    ["Schooljaar", "2026–2027"],
    ["Opleiding", "Vmbo-tl"],
    ["Vak", "Engels"],
    ["PTA-onderdeelcode", "UI-SE1"],
    ["Duur (minuten)", "60"],
    ["Weging in het PTA", "25%"],
    ["Afnamemoment", "Periode 2"],
    ["Toegestane hulpmiddelen", "Woordenboek"],
    ["Leerstof", "Leesvaardigheid: informatie in een Engelse tekst herkennen."],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Gegevens opslaan" }).click();
  await expect(page.getByRole("status")).toContainText("opgeslagen");
  await page.getByRole("button", { name: "Toetsmatrijs", exact: true }).click();
  await page.getByRole("button", { name: "Leerdoel", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Domein", exact: true })
    .fill("Leesvaardigheid");
  await page
    .getByRole("textbox", { name: "Leerdoel", exact: true })
    .fill("Expliciete informatie herkennen");
  await page
    .getByRole("spinbutton", {
      name: "Expliciete informatie herkennen R",
      exact: true,
    })
    .fill("1");
  await page
    .getByRole("button", { name: "Nieuwe matrijsversie opslaan" })
    .click();
  await expect(page.getByRole("status")).toContainText("opgeslagen");
  await page
    .getByRole("button", { name: "Matrijs vaststellen", exact: true })
    .click();
  await expect(page.getByText(/Versie \d+ vastgesteld op/)).toBeVisible();
  await page
    .getByRole("button", { name: "Teksten & vragen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Onderdeel toevoegen", exact: true })
    .click();
  await page
    .getByLabel("Titel van het onderdeel", { exact: true })
    .fill("Reading in the park");
  await page
    .getByRole("textbox", { name: "Onderdeeltekst", exact: true })
    .fill("Anna reads a book in the park every Sunday.");
  await page
    .getByLabel("Bronvermelding", { exact: true })
    .fill("Eigen tekst, 2026");
  await page.getByRole("button", { name: "Vraag toevoegen" }).click();
  await page
    .getByLabel("Vraagtekst", { exact: true })
    .fill("Where does Anna read?");
  await page
    .getByRole("textbox", { name: "Optie A", exact: true })
    .fill("In the park");
  await page
    .getByRole("textbox", { name: "Optie B", exact: true })
    .fill("At school");
  await page
    .getByRole("textbox", { name: "Optie C", exact: true })
    .fill("At home");
  await page
    .getByRole("textbox", { name: "Optie D", exact: true })
    .fill("In a shop");
  await page
    .getByLabel("Koppel Expliciete informatie herkennen", { exact: true })
    .check();
  await page
    .getByRole("spinbutton", {
      name: "Punten Expliciete informatie herkennen",
      exact: true,
    })
    .fill("1");
  const liveMatrix = page.getByRole("complementary", {
    name: "Live matrijsvergelijking",
  });
  await expect(liveMatrix).toContainText("1 / 1 punten toegedeeld");
  await page
    .getByRole("spinbutton", { name: "Vraagpunten", exact: true })
    .fill("2");
  await expect(liveMatrix).toContainText(
    "puntentoedeling wijkt af van de vraagscore",
  );
  await page
    .getByRole("spinbutton", { name: "Vraagpunten", exact: true })
    .fill("1");
  await expect(liveMatrix).not.toContainText(
    "puntentoedeling wijkt af van de vraagscore",
  );
  await page
    .getByLabel("Onderbouwing juiste antwoord", { exact: true })
    .fill("De tekst noemt het park expliciet.");
  await page
    .getByLabel("Relevante tekstpassage", { exact: true })
    .fill("Anna reads a book in the park");
  await page
    .getByRole("button", { name: "Onderdeel opslaan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reading in the park", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toewijzen", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Schrijfwerk toewijzen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await page.getByRole("button", { name: "Normering", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "N-term", exact: true })
    .fill("0.7");
  await page.getByRole("button", { name: "N-term opslaan" }).click();
  await expect(page.locator(".grade-cell")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Pagina-preview", exact: true })
    .click();
  await expect(
    page
      .frameLocator("iframe")
      .getByText("Anna reads a book in the park every Sunday.", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    page.frameLocator("iframe").locator(".pagedjs_pages .passage p").first(),
  ).toHaveAttribute("data-paragraph", "1");
  await page.screenshot({
    path: "test-results/author-ui-preview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Alle examens", exact: true }).click();
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await login(page, "author");
  await page
    .getByRole("button", { name: `Open ${title}`, exact: true })
    .click();
  await expect(
    page.getByLabel("PTA-onderdeelcode", { exact: true }),
  ).toHaveValue("UI-SE1");
});
test("administrator manages teams and a checklist draft through the UI", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .getByRole("button", { name: "Platformbeheer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account toevoegen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Docententeams", exact: true })
    .click();
  const team = `${process.env.E2E_RUN_ID} UI team`;
  await page.getByRole("textbox", { name: "Teamnaam", exact: true }).fill(team);
  await page
    .getByRole("button", { name: "Team aanmaken", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: team, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Checklisttemplates", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Controlepunt toevoegen", exact: true })
    .click();
  await page
    .getByLabel("Omschrijving", { exact: true })
    .last()
    .fill(
      `${process.env.E2E_RUN_ID}: controleer de bronvermelding zorgvuldig.`,
    );
  await page
    .getByLabel("Toelichting", { exact: true })
    .last()
    .fill("Controleer auteur, datum en publicatie.");
  await page
    .getByRole("button", { name: "Concept opslaan", exact: true })
    .click();
  await expect(
    page.getByText(/Versie \d+ · \d+ controlepunten · Concept/).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-ui-template.png",
    fullPage: true,
  });
});
