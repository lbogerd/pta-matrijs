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

De database-tests gebruiken `DATABASE_URL` uitsluitend als serververbinding om een tijdelijke database aan te maken. Alle tabellen en records staan in die tijdelijke database; deze wordt ook na een mislukte test verwijderd. De databasegebruiker moet databases kunnen maken en verwijderen. Zonder `DATABASE_URL` worden database-tests overgeslagen. GitHub Actions voert ze met PostgreSQL uit.

Voor browsercontroles op de eigen Compose-deployment:

```sh
TEST_BASE_URL=https://pta-matrijs.tainer.run npm run test:e2e
# Als Docker alleen via sudo toegankelijk is:
E2E_DOCKER_SUDO=1 npm run test:e2e
```

Playwright maakt automatisch tijdelijke accounts (inclusief een eigen beheeraccount), een uniek team en een proefexamen aan via een private CLI in de webcontainer. Bestaande beheer- of pilotwachtwoorden zijn niet nodig. Iedere run verwijdert zijn examens, kopieën, teams, checklistdrafts, sessies, auditregels, uploads en pdf's na afloop, ook na testfalen. Een gesloten runnerverbinding start de cleanup. Bij een harde stop van de container blijft een privéjournal achter; de volgende run herstelt dat voordat nieuwe testgegevens worden aangemaakt. Gelijktijdige browserruns op dezelfde database worden geweigerd.

De browsertests controleren dat de fixture-database bij `TEST_BASE_URL` hoort. Zonder toegang tot de juiste container of database stoppen ze vóór de browsertests. Voor een installatie buiten Compose kunnen `E2E_DATABASE_URL` en `E2E_STORAGE_DIR` naar de juiste database en private bestandenmap wijzen, met `APP_URL` op de doel-URL. Er is geen publiek cleanup-endpoint.

`npm run seed` blijft een **expliciete, handmatige demo-invoer**, buiten de testworkflow. Die optionele demo blijft staan totdat de beheerder haar verwijdert; tests gebruiken deze opdracht niet.

## Procesregels

Accounts hebben één exclusieve rol. Platformbeheer geeft geen toegang tot exameninhoud. Alleen het examenbureau kan vrijgegeven pdf’s downloaden. De commissie wijzigt geen exameninhoud. Iedere schrijfactie controleert teamtoegang, status en een optimistische versie; sectiebewerkingen vereisen bovendien een tijdelijke lock. Servertransacties beschermen besluiten en downloads tegen gelijktijdige wijzigingen.

De N-term wordt bij de eerste teamvaststelling/indiening permanent vergrendeld voor het examen. Terugsturen, intrekken en nieuwe revisies heffen die vergrendeling niet op. Een kopie is een nieuw examen en krijgt een eigen normering. Normering volgt de expliciet gekozen [Examenblad-hoofdrelatie en grensrelaties](https://www.examenblad.nl/system/files/2018/vragen_en_antwoorden_webinar_9_maart_2017_versie_4-4-2017.pdf), met exacte beslissingen op afrondingsgrenzen en halve waarden naar boven. Dit is een rekenkeuze voor de app, geen juridische claim over schoolexamens.

[Beheer, back-up en herstel](docs/operations.md) beschrijft accountbeheer, private opslag, herstelcontrole en publicatie. E-mailbezorging is niet geconfigureerd: accountuitgifte en wachtwoordherstel lopen via de beheerder.

## Productdemo

Bekijk de [openbare productdemo](https://pta-matrijs.tainer.run/demo/) voor de volledige gebruikersworkflow met screenshots, van PTA en collegiale controle tot vrijgave en PDF-downloads. Zie [de demo-documentatie](docs/demo.md) voor de geïsoleerde opnameprocedure.
