# Openbare productdemo

De statische Nederlandstalige rondleiding staat op **https://pta-matrijs.tainer.run/demo/**. De aanmeldpagina verwijst ernaar. HTML, CSS en screenshots worden als publieke bestanden meegebouwd; er zijn geen API-aanroepen, sessies of externe assets nodig. De bestaande applicatie en examen-API behouden hun eigen authenticatie.

De 28 screenshots tonen de werkruimte, examenaanmaak, PTA, matrijs en vaststelling, toewijzing, tekst- en vrageneditor, collegiale controle, bevinding en oplossing, normering, beide documentpreviews, teamvaststelling, commissiebeoordeling en terugsturen, vrijgave en PDF-downloads. De vervolgroute toont intrekking, geblokkeerde downloads, een nieuwe revisie en kopiëren. Beheerhandelingen zijn uitgesloten.

## Screenshots opnieuw maken

Gebruik uitsluitend de aparte lokale Compose-installatie hieronder. Die heeft eigen database- en bestandenvolumes, een loopbackpoort en geen openbare route. De bestaande tijdelijke testgegevenslease maakt fictieve accounts en een voorbeeldexamen aan en ruimt de eigen gegevens op. De demo-setup geeft deze fictieve gebruikers leesbare namen; screenshots bevatten geen productiegegevens. Afbeeldingen zijn onbewerkte Playwright-screenshots van de echte applicatie. PDF-downloads worden tijdens de opname gecontroleerd op hun PDF-header.

Vanuit de repositoryroot, met de normale `.env` aanwezig:

```bash
sudo docker compose --project-name pta-demo-capture \
  -f compose.yaml -f scripts/demo/compose.yaml up -d --build --wait
E2E_COMPOSE_PROJECT=pta-demo-capture \
E2E_COMPOSE_FILES=compose.yaml:scripts/demo/compose.yaml \
E2E_DOCKER_SUDO=1 \
  npx playwright test -c scripts/demo/playwright.config.ts
node scripts/demo/render.mjs
sudo docker compose --project-name pta-demo-capture \
  -f compose.yaml -f scripts/demo/compose.yaml stop
```

De opnameconfiguratie staat los van de reguliere tests. Start haar niet gelijktijdig met andere browsertests op dezelfde database. Bij een onderbroken opname herstelt de volgende run de tijdelijke gegevens via het bestaande testjournaal. Bewaar `steps.json`, de gegenereerde `index.html`, CSS en alle screenshots samen in Git. De renderer maakt de HTML opnieuw uit de captions in `steps.json`; bezoekers hebben geen JavaScript nodig.

Controleer de complete opname, de mobiele weergave, keyboardbediening van de uitklapbare stappen, volledige afbeeldingen en een bezoek zonder cookies. Lange screenshots worden in de rondleiding als uitsnede getoond; de link eronder opent altijd het volledige origineel.

## Deployen

```bash
sudo docker compose up -d --build --wait web
```

Gebruik daarna de beheerde publicatiehelper om de bestaande openbare tainer-route en `/health` te verifiëren. De upstream blijft `127.0.0.1:3817`; PostgreSQL heeft geen gepubliceerde poort. Controleer dat `/demo/`, CSS en screenshots zonder sessie laden en `/api/dashboard` zonder sessie HTTP 401 retourneert.

## Verificatie op 2 oktober 2026

- De volledige Playwright-opname met 28 stappen slaagt, inclusief collegiale controle, terugsturen en opnieuw indienen, beide PDF-downloads, intrekking, nieuwe revisie en kopiëren.
- `npm run typecheck` slaagt; `npm test` rapporteert 29 geslaagde tests en 4 overgeslagen database-afhankelijke tests.
- De openbare rondleiding werkt zonder JavaScript, met keyboardbediening en op viewportbreedtes 1440, 390 en 320 pixels. Alle 28 originele screenshots laden zonder sessie.
- De aanmeldpagina linkt naar de demo; `/api/dashboard` blijft zonder sessie HTTP 401 retourneren.
- De Compose-webservice en database zijn healthy. De beheerde publicatiehelper bevestigt loopback, firewall, WireGuard, origin, DNS, TLS en openbare route zonder gateway-authenticatie. Applicatie-authenticatie blijft Better Auth.
