import { readFile, writeFile } from "node:fs/promises";
const steps = JSON.parse(await readFile("public/demo/steps.json", "utf8"));
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const chapters = [
  [
    "start",
    "De werkruimte",
    "Een gezamenlijk vertrekpunt",
    "Van aanmelden naar een compleet examendossier.",
    1,
    4,
  ],
  [
    "ontwerp",
    "Ontwerpen & schrijven",
    "Eerst het plan. Dan de vragen.",
    "Leerdoelen, toetsmatrijs en vraaginhoud blijven met elkaar verbonden.",
    5,
    9,
  ],
  [
    "controle",
    "Collegiale controle",
    "Een tweede paar ogen",
    "Auteur en reviewer werken samen aan aantoonbaar gecontroleerde inhoud.",
    10,
    12,
  ],
  [
    "vaststelling",
    "Normering & vaststelling",
    "Alles op zijn plaats",
    "Controleer de normering en pagina-opmaak voordat je de versie vastlegt.",
    13,
    18,
  ],
  [
    "commissie",
    "Examencommissie",
    "Een zorgvuldig besluit",
    "Beoordelen, zo nodig terugsturen en uiteindelijk vrijgeven.",
    19,
    22,
  ],
  [
    "bureau",
    "Examenbureau",
    "Klaar voor de afname",
    "Het examen en correctiemodel komen uit dezelfde vrijgegeven revisie.",
    23,
    24,
  ],
  [
    "vervolg",
    "Na de vrijgave",
    "Grip op wat er daarna gebeurt",
    "Ook intrekking, een nieuwe revisie en hergebruik hebben een vaste plek.",
    25,
    28,
  ],
];
const screenshot = (s, eager = false) =>
  `<figure><a href="${escape("/demo/" + s.image)}" target="_blank" rel="noopener" aria-label="Bekijk volledig screenshot: ${escape(s.title)} (nieuw tabblad)"><img src="${escape("/demo/" + s.image)}" alt="${escape(s.title)} — ${escape(s.role)} in de Matrijs-applicatie" loading="${eager ? "eager" : "lazy"}" decoding="async" width="1440" height="1000"></a><figcaption>Echte applicatie · fictieve voorbeeldgegevens <a href="${escape("/demo/" + s.image)}" target="_blank" rel="noopener">Volledig screenshot ↗</a></figcaption></figure>`;
const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Van plan naar examen — Matrijs productdemo</title><meta name="description" content="Volg de complete examenworkflow in Matrijs: PTA, toetsmatrijs, schrijven, collegiale controle, vaststelling, vrijgave en PDF-download. Een openbare rondleiding met 28 echte screenshots."><link rel="stylesheet" href="/demo/demo.css"><link rel="icon" href="data:,"></head>
<body><a class="skip" href="#rondleiding">Naar de rondleiding</a>
<header><a class="brand" href="/demo/" aria-label="Matrijs productdemo"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span> matrijs <span class="brand-note">VAN PLAN NAAR EXAMEN</span></a><a class="login" href="/">Naar de applicatie <span aria-hidden="true">↗</span></a></header>
<main><section class="hero"><div class="hero-copy"><p class="eyebrow">PRODUCTDEMO / PTA MATRIJS</p><h1>Een goed examen.<br>Een helder proces.<br><em>Samen gemaakt.</em></h1><p class="intro">Van het eerste leerdoel tot de laatste PDF. Ontdek hoe docenten, reviewers, de examencommissie en het examenbureau samenwerken in één werkruimte.</p><a class="primary" href="#rondleiding">Bekijk de workflow <span aria-hidden="true">↓</span></a><p class="hero-note">Geen account nodig · ${steps.length} screenshots · 4 perspectieven</p></div><div class="hero-visual"><div class="window-bar"><i></i><i></i><i></i><span>De werkruimte van je team</span></div><img src="/demo/screenshots/02-dashboard.png" alt="Het docentendashboard met examenoverzicht en de route naar vrijgave" width="1440" height="1000"><div class="visual-note"><span aria-hidden="true">✓</span><div><strong>Elke stap inzichtelijk.</strong><br>Elke versie traceerbaar.</div></div></div></section>
<section class="context"><p><strong>Eén examen, van begin tot eind.</strong> We volgen het fictieve examen <em>Reading the world</em> van Team Engels. Open een stap om het scherm te bekijken; klik op de afbeelding voor het volledige formaat.</p><p>Dit is een statische rondleiding met echte screenshots en fictieve gegevens. De knoppen in de afbeeldingen zijn onderdeel van het voorbeeld.</p></section>
<div class="tour" id="rondleiding"><nav class="chapters" aria-label="Hoofdstukken"><p class="eyebrow">DE WORKFLOW</p>${chapters.map(([id, label], i) => `<a href="#${id}"><span>0${i + 1}</span>${label}</a>`).join("")}<p class="nav-note">Van concept naar afname,<br>stap voor stap.</p></nav><div class="chapter-content">${chapters
  .map(
    ([id, label, title, description, start, end], i) =>
      `<section class="chapter" id="${id}" aria-labelledby="title-${id}"><div class="chapter-heading"><span class="chapter-number">0${i + 1}</span><div><p class="eyebrow">${label}</p><h2 id="title-${id}">${title}</h2><p>${description}</p></div></div><div class="steps">${steps
        .filter((s) => parseInt(s.id) >= start && parseInt(s.id) <= end)
        .map(
          (s, j) =>
            `<details id="${s.id}" ${j === 0 ? "open" : ""}><summary><span class="step-number">${s.id.slice(0, 2)}</span><span><span class="role">${escape(s.role)}</span><strong>${escape(s.title)}</strong></span><span class="expand" aria-hidden="true">+</span></summary><div class="step-body"><p>${escape(s.description)}</p>${screenshot(s)}</div></details>`,
        )
        .join("")}</div></section>`,
  )
  .join("")}</div></div>
<section class="closing"><p class="eyebrow">VAN PLAN NAAR EXAMEN</p><h2>Een werkruimte voor het hele proces.</h2><p>PTA, matrijs, inhoud, controle en vrijgave komen samen in één examendossier.</p><a class="primary" href="/">Open de applicatie ↗</a><a class="back" href="#">Terug naar boven ↑</a></section></main><footer><span class="brand">matrijs</span><p>Productdemo · Voorbeeldexamen Engels · Geen echte examen- of persoonsgegevens</p></footer></body></html>`;
await writeFile("public/demo/index.html", html);
console.log(`Rendered ${steps.length} workflow screenshots.`);
