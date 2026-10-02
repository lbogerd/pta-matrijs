# PTA Matrijs

Een examenwerkplaats voor Engels in vavo/vmbo: van handmatig ingevoerd PTA en RTTI-matrijs naar collegiale controle, commissievrijgave en private pdf-publicatie.

- **Applicatie:** https://pta-matrijs.tainer.run
- **Plan:** [Smart Plan](https://smart-plan.tainer.run/plans/b3882f0b-a808-4f95-be84-707d9498e823); [vastgelegde vereisten](docs/implementation-plan.md)
- **Stack:** TanStack Start, React, PostgreSQL, Better Auth, Docker Compose; Paged.js en Chromium voor gedeelde paginapreview/pdf-opmaak.

## Start

Gebruik Node.js 24 en Docker Compose. Kopieer `.env.example` naar `.env` en vul willekeurige geheimen en het eerste beheeraccount in.

```sh
npm ci
docker compose up -d --build
```

De applicatie luistert op `127.0.0.1:3817`. De database heeft geen hostpoort. De applicatie maakt het eerste beheeraccount uit de omgevingsvariabelen aan. Er zijn geen standaardwachtwoorden en geen openbare registratie. De beheerder maakt accounts en docententeams aan via Platformbeheer.

## Controle

```sh
npm run build
npm run typecheck
npm test
```

De API-integratietest gebruikt `DATABASE_URL`, `BETTER_AUTH_URL` en `BETTER_AUTH_SECRET`; zonder databaseconfiguratie wordt alleen die integratietest overgeslagen. GitHub Actions voert ook de PostgreSQL-integratietest uit.

Voor de representatieve pilot: voer `npm run seed` uit met `DATABASE_URL`, een geheime `SEED_PASSWORD` (minimaal 12 tekens) en `SEED_EMAIL_DOMAIN`. Dit maakt afzonderlijke auteur-, reviewer-, commissie-, bureau- en buitenstaanderaccounts en het concept **Reading the world**. De seed overschrijft bestaande accounts of examens niet.

```sh
TEST_BASE_URL=https://pta-matrijs.tainer.run npm run test:e2e
```

De Playwright-test gebruikt dezelfde geheime seedvariabelen. Zij doorloopt de echte publieke deployment, inclusief aanmelding, matrijs, onafhankelijke controle, bevindingen, terugsturen, normeringsvergrendeling, vrijgave, pdf-publicatie en intrekking. Acceptatie-examens blijven met hun auditgeschiedenis bewaard en zijn herkenbaar aan hun titel.

## Procesregels

Accounts hebben één exclusieve rol. Platformbeheer geeft geen toegang tot exameninhoud. Alleen het examenbureau kan vrijgegeven pdf’s downloaden. De commissie wijzigt geen exameninhoud. Iedere schrijfactie controleert teamtoegang, status en een optimistische versie; sectiebewerkingen vereisen bovendien een tijdelijke lock. Servertransacties beschermen besluiten en downloads tegen gelijktijdige wijzigingen.

De N-term wordt bij de eerste teamvaststelling/indiening permanent vergrendeld voor het examen. Terugsturen, intrekken en nieuwe revisies heffen die vergrendeling niet op. Een kopie is een nieuw examen en krijgt een eigen normering. Normering volgt de expliciet gekozen [Examenblad-hoofdrelatie en grensrelaties](https://www.examenblad.nl/system/files/2018/vragen_en_antwoorden_webinar_9_maart_2017_versie_4-4-2017.pdf), met exacte beslissingen op afrondingsgrenzen en halve waarden naar boven. Dit is een rekenkeuze voor de app, geen juridische claim over schoolexamens.

[Beheer, back-up en herstel](docs/operations.md) beschrijft accountbeheer, private opslag, herstelcontrole en publicatie. E-mailbezorging is niet geconfigureerd: accountuitgifte en wachtwoordherstel lopen via de beheerder.
