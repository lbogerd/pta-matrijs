import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const directory = "public/demo/screenshots";
test("capture the complete non-admin product workflow", async ({
  browser,
  page,
}) => {
  const steps: object[] = [];
  const capture = async (
    p: Page,
    id: string,
    title: string,
    role: string,
    description: string,
  ) => {
    await p.waitForLoadState("networkidle");
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({
      path: `${directory}/${id}.png`,
      fullPage: true,
      animations: "disabled",
    });
    steps.push({
      id,
      title,
      role,
      description,
      image: `screenshots/${id}.png`,
    });
  };
  const click = (p: Page, name: string) =>
    p.getByRole("button", { name, exact: true }).click();
  const login = async (role: string) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3818",
      viewport: { width: 1440, height: 1000 },
      locale: "nl-NL",
    });
    const p = await context.newPage();
    await p.goto("/");
    await p
      .getByLabel("E-mailadres")
      .fill(`${role}@${process.env.SEED_EMAIL_DOMAIN}`);
    await p
      .getByLabel("Wachtwoord", { exact: true })
      .fill(process.env.SEED_PASSWORD!);
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = p.waitForResponse((r) =>
        r.url().endsWith("/api/auth/sign-in/email"),
      );
      await click(p, "Inloggen");
      const result = await response;
      if (result.status() !== 429) {
        expect(result.ok()).toBe(true);
        break;
      }
      await p.waitForTimeout(
        Math.max(1000, Number(result.headers()["retry-after"] || "10") * 1000),
      );
    }
    await expect(p.getByRole("button", { name: "Uitloggen" })).toBeVisible();
    return p;
  };
  const open = async (p: Page, tab?: string) => {
    await p.goto("/");
    await click(p, "Open Reading the world");
    if (tab) await click(p, tab);
  };
  await mkdir(directory, { recursive: true });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Inloggen" })).toBeVisible();
  await capture(
    page,
    "01-login",
    "Een eigen werkruimte",
    "Iedere gebruiker",
    "Meld je aan met je schoolaccount. Je rol bepaalt welke examens en handelingen beschikbaar zijn.",
  );
  const author = await login("author");
  await capture(
    author,
    "02-dashboard",
    "Overzicht en voortgang",
    "Docent",
    "Bekijk de examens van je team, hun status en de route van concept naar vrijgave.",
  );
  await click(author, "Nieuw examen");
  await author
    .getByLabel("Examentitel", { exact: true })
    .fill("Reading the world");
  await capture(
    author,
    "03-create",
    "Een examen starten",
    "Docent",
    "Geef het examen een titel en kies het docententeam. In deze rondleiding werken we verder met een ingevuld voorbeeld.",
  );
  await click(author, "Sluiten");
  await open(author);
  await capture(
    author,
    "04-pta",
    "PTA en examengegevens",
    "Docent",
    "Leg schooljaar, opleiding, vak, PTA-code, leerstof, duur, hulpmiddelen en weging vast.",
  );
  await click(author, "Toetsmatrijs");
  await capture(
    author,
    "05-matrix",
    "Van leerdoelen naar punten",
    "Docent",
    "Verdeel de gewenste punten per leerdoel over R, T1, T2 en I. De vergelijking maakt verschillen met de vragen zichtbaar.",
  );
  await click(author, "Matrijs vaststellen");
  await expect(author.getByText(/Versie 1 vastgesteld op/)).toBeVisible();
  await capture(
    author,
    "06-matrix-established",
    "De matrijs vaststellen",
    "Docent",
    "Stel de matrijs vast als uitgangspunt voor het schrijfwerk. Nieuwe wijzigingen krijgen een eigen matrijsversie.",
  );
  await click(author, "Teksten & vragen");
  await click(author, "Toewijzen");
  await capture(
    author,
    "07-assignment",
    "Schrijfwerk en controle verdelen",
    "Docent",
    "Wijs per onderdeel een auteur en een andere docent als reviewer toe. Zo blijft de inhoudelijke controle onafhankelijk.",
  );
  await click(author, "Sluiten");
  await click(author, "Bewerken");
  await capture(
    author,
    "08-editor",
    "Teksten en vragen schrijven",
    "Auteur",
    "Voeg de brontekst, antwoordopties, juiste antwoorden, onderbouwing en relevante tekstpassages toe. Koppel vraagpunten aan leerdoelen en RTTI; de live matrijs rekent mee.",
  );
  await click(author, "Onderdeel opslaan");
  await expect(
    author.getByRole("button", { name: "Bewerken", exact: true }),
  ).toBeVisible();
  await capture(
    author,
    "09-content",
    "Het volledige onderdeel bekijken",
    "Auteur",
    "Lees de tekst en de vragen samen terug, inclusief bron, puntentoedeling en antwoordonderbouwing.",
  );
  const reviewer = await login("reviewer");
  await open(reviewer, "Collegiale controle");
  await reviewer
    .getByLabel("Nieuwe bevinding")
    .fill(
      "Controleer of de bronvermelding duidelijk maakt dat dit een oorspronkelijke proeftekst is.",
    );
  await click(reviewer, "Bevinding toevoegen");
  await expect(
    reviewer.getByText("Open bevinding", { exact: true }),
  ).toBeVisible();
  await capture(
    reviewer,
    "10-review-finding",
    "Collegiale controle en bevindingen",
    "Reviewer",
    "Loop de inhoudelijke checklist na en leg verbeterpunten vast. Open bevindingen moeten worden afgehandeld voordat de controle kan worden afgerond.",
  );
  await open(author, "Collegiale controle");
  await author
    .getByLabel("Oplossing", { exact: true })
    .fill(
      "De bronvermelding vermeldt al: oorspronkelijke proeftekst voor deze applicatie, 2026. Dit is gecontroleerd.",
    );
  await click(author, "Oplossing vastleggen");
  await expect(
    author.getByText("Oplossing ter controle", { exact: true }),
  ).toBeVisible();
  await capture(
    author,
    "11-resolution",
    "Een bevinding beantwoorden",
    "Auteur",
    "Beschrijf hoe het verbeterpunt is opgelost. De reviewer beoordeelt en sluit de oplossing.",
  );
  await open(reviewer, "Collegiale controle");
  await click(reviewer, "Oplossing goedkeuren & sluiten");
  for (const checkbox of await reviewer.locator(".checklist-item input").all())
    await checkbox.check();
  await click(reviewer, "Controle afronden");
  await expect(
    reviewer.getByText("Gecontroleerd", { exact: true }),
  ).toBeVisible();
  await capture(
    reviewer,
    "12-review-complete",
    "De controle afronden",
    "Reviewer",
    "Alle controlepunten zijn nagelopen en de bevinding is gesloten. Het onderdeel is nu gecontroleerd.",
  );
  await open(author, "Normering");
  await capture(
    author,
    "13-grading",
    "Normering controleren",
    "Docent",
    "Kies de N-term en controleer de volledige score-cijfertabel. Bij de eerste indiening wordt de N-term permanent vergrendeld.",
  );
  await click(author, "Pagina-preview");
  await expect(
    author.frameLocator("iframe").locator(".pagedjs_page").first(),
  ).toBeVisible();
  await capture(
    author,
    "14-preview",
    "De pagina-opmaak beoordelen",
    "Docent",
    "Bekijk de echte pagina-indeling voordat het examen wordt ingediend. De preview gebruikt dezelfde paginering als de PDF.",
  );
  const preview = await author.context().newPage();
  for (const [kind, id, title, description] of [
    [
      "exam",
      "15-exam-document",
      "Het leerlingexamen",
      "Het leerlingdocument toont teksten, vragen en antwoordopties zonder de antwoorden of de score-cijfertabel.",
    ],
    [
      "answers",
      "16-answer-document",
      "Het correctiemodel",
      "Het correctiemodel bevat de juiste antwoorden, onderbouwingen en de score-cijfertabel.",
    ],
  ]) {
    await preview.goto(
      `/api/exams/${process.env.E2E_FIXTURE_EXAM_ID}/preview?kind=${kind}`,
    );
    await preview.waitForFunction(
      () => (window as any).__PAGED_READY__ === true,
    );
    await capture(preview, id, title, "Docent", description);
  }
  await click(author, "Vaststelling & vrijgave");
  await capture(
    author,
    "17-validation",
    "Klaar voor vaststelling",
    "Docent",
    "De procescontroles toetsen of de matrijs, inhoud, reviews en normering compleet zijn. Pas daarna kan het team indienen.",
  );
  await click(author, "Vaststellen & indienen");
  await capture(
    author,
    "18-submit",
    "Vaststellen en indienen",
    "Docent",
    "Bevestig revisie, maximumscore, N-term en score-cijfertabel. De ingediende versie wordt als snapshot vastgelegd.",
  );
  await click(author, "Bevestigen");
  await expect(author.getByRole("dialog")).toHaveCount(0);
  const committee = await login("committee");
  await capture(
    committee,
    "19-committee",
    "De commissie beoordeelt",
    "Examencommissie",
    "De commissie krijgt de ingediende examens in haar werkruimte en beoordeelt de vastgelegde versie.",
  );
  await open(committee, "Vaststelling & vrijgave");
  await committee
    .getByLabel("Commissiebevinding of reden")
    .fill(
      "Bevestig dat het woordenboek Engels–Nederlands tijdens de afname beschikbaar is.",
    );
  await capture(
    committee,
    "20-committee-decision",
    "Vrijgeven of gemotiveerd terugsturen",
    "Examencommissie",
    "Bekijk het examen en de vastgelegde normering. Geef het vrij of stuur het met een concrete reden terug naar het team.",
  );
  await click(committee, "Terugsturen");
  await open(author, "Vaststelling & vrijgave");
  await author
    .getByLabel("Oplossing", { exact: true })
    .fill(
      "Het woordenboek is beschikbaar voor alle kandidaten en staat bij de toegestane hulpmiddelen.",
    );
  await capture(
    author,
    "21-returned",
    "Een commissiebevinding verwerken",
    "Docent",
    "Verwerk het teruggestuurde punt en leg de oplossing vast. De oorspronkelijke N-term blijft vergrendeld.",
  );
  await click(author, "Oplossing vastleggen");
  await click(author, "Vaststellen & indienen");
  await click(author, "Bevestigen");
  await expect(author.getByRole("dialog")).toHaveCount(0);
  await open(committee, "Vaststelling & vrijgave");
  await click(committee, "Examen vrijgeven");
  await expect(
    committee.getByRole("button", { name: "Vrijgave intrekken" }),
  ).toBeVisible();
  await capture(
    committee,
    "22-released",
    "Een vastgelegde versie vrijgeven",
    "Examencommissie",
    "De vrijgave hoort bij één revisie. Besluiten en versies blijven terug te vinden in het dossier.",
  );
  const office = await login("office");
  await capture(
    office,
    "23-office",
    "Vrijgegeven examens vinden",
    "Examenbureau",
    "Het examenbureau ziet welke examens beschikbaar zijn voor afname.",
  );
  await open(office);
  await capture(
    office,
    "24-download",
    "Examen en correctiemodel downloaden",
    "Examenbureau",
    "Download beide PDF’s van dezelfde vrijgegeven revisie. Elke download wordt geregistreerd.",
  );
  for (const name of ["Examen · PDF", "Correctiemodel · PDF"]) {
    const href = await office
      .getByRole("link", { name, exact: true })
      .getAttribute("href");
    const response = await office.request.get(href!);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  await committee
    .getByLabel("Reden voor intrekken (verplicht)")
    .fill(
      "Het afnamemoment wordt verplaatst; deze versie mag niet meer worden verspreid.",
    );
  await click(committee, "Vrijgave intrekken");
  await capture(
    committee,
    "25-withdraw",
    "Zo nodig een vrijgave intrekken",
    "Examencommissie · vervolg",
    "Een intrekking vereist een reden en bevestiging. Nieuwe downloads worden geblokkeerd; al gedownloade bestanden kunnen niet worden teruggehaald.",
  );
  await click(committee, "Bevestigen");
  await expect(committee.getByRole("dialog")).toHaveCount(0);
  await open(office);
  await capture(
    office,
    "26-withdrawn",
    "Intrekking zichtbaar bij het bureau",
    "Examenbureau · vervolg",
    "De ingetrokken versie blijft zichtbaar met de reden. De downloadknoppen zijn niet meer beschikbaar.",
  );
  await expect(
    office.getByRole("link", { name: "Examen · PDF", exact: true }),
  ).toHaveCount(0);
  await open(author, "Vaststelling & vrijgave");
  await click(author, "Nieuwe conceptrevisie");
  await capture(
    author,
    "27-revision",
    "Verder met een nieuwe revisie",
    "Docent · vervolg",
    "Start een nieuwe conceptrevisie om het examen opnieuw te doorlopen. De N-term blijft bij dit examen vergrendeld; kopiëren maakt een nieuw examen met een eigen normering.",
  );
  await click(author, "Kopiëren");
  await expect(author.getByRole("status")).toHaveText(
    "De kopie staat in het examenoverzicht.",
  );
  await click(author, "Alle examens");
  await click(author, "Open Reading the world — kopie");
  await expect(
    author.getByRole("heading", {
      name: "Reading the world — kopie",
      exact: true,
    }),
  ).toBeVisible();
  await capture(
    author,
    "28-copy",
    "Een nieuw examen op basis van bestaand werk",
    "Docent · vervolg",
    "Een kopie neemt de inhoud over als nieuw concept. Matrijsvaststelling, reviews en normering moeten opnieuw worden gecontroleerd en vastgesteld.",
  );
  await writeFile(
    "public/demo/steps.json",
    JSON.stringify(steps, null, 2) + "\n",
  );
});
