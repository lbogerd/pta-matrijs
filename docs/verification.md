# Oplevercontrole — 2 oktober 2026

Publieke applicatie: https://pta-matrijs.tainer.run. De tainer-authenticatie is uitgeschakeld voor deze route; aanmelden en autorisatie worden door Better Auth en de applicatie verzorgd. De origin is `127.0.0.1:3817`; PostgreSQL is uitsluitend intern bereikbaar.

## Uitgevoerde controles

- Productiebuild en TypeScript-controle geslaagd.
- 33 geautomatiseerde tests geslaagd, inclusief de integratietest met echte PostgreSQL en Better Auth.
- Vier Playwright-tests geslaagd tegen de publieke deployment: mobiele aanmeldpagina en anonieme toegangsweigering; volledige examenroute met vijf afzonderlijke rollen; auteurwerk via de interface; beheer van teams en een conceptchecklist via de interface.
- De examenroute omvat afwijkende matrijs, eigenwerkcontroleverbod, bevinding/oplossing/reviewerafsluiting, indienen, commissie-terugsturen, blijvende N-termvergrendeling, opnieuw indienen, vrijgeven, beide pdf’s, private afbeeldingen, intrekking en downloadblokkade, nieuwe revisie en zelfstandig kopiëren.
- De interfacecontrole omvat handmatige PTA-invoer, matrijs vaststellen, tekstopmaak, vraagopties, puntentoedeling, live matrijsvergelijking vóór opslaan, normering, preview en persistentie na opnieuw aanmelden.
- Het kandidaatdocument bevat geen antwoordindicatie, onderbouwing, score-cijfertabel of interne reviewgegevens. De echte pdf is met Poppler gecontroleerd op tekstinhoud en pagina-/alineanummers.
- Een proefdocument van zes pagina’s heeft in de preview en pdf hetzelfde pagina-aantal. De rastervergelijking bleef binnen de ingestelde tolerantie; beperkte verschillen in letterweergave zijn te verwachten tussen Chromium-screenshot en Poppler.
- Back-up en geïsoleerd herstel geslaagd: database, examenrevisies, normeringsvergrendelingen, fingerprints van historische vrijgaven en alle private bestanden byte voor byte. De productiedatabase is daarbij niet overschreven.
- De publicatiehelper bevestigde loopbackbinding, firewall, WireGuard, origin, DNS, TLS en de publieke route. Beide applicatiecontainers zijn gezond. De tainer-dashboardtegel is toegevoegd en gecontroleerd.

## Pilotgebruik

Het beheeraccount staat uitsluitend in de lokale, genegeerde `.env`. Browsercontroles krijgen automatisch tijdelijke accounts met willekeurige wachtwoorden; deze verdwijnen na de run. Geen wachtwoorden of privésessies staan in Git. De openbare repository bevat het Engelstalige proefexamen als fixturecode; productiegegevens en testartefacten zijn uitgesloten.

Na de oorspronkelijke acceptatie zijn 15 test/demo-examens, vijf teams, vijf pilotaccounts, vier checklistdrafts en veertien private testbestanden verwijderd. Het echte beheeraccount en de standaardchecklist zijn behouden. Tests laten hun records niet meer achter. Cleanup-regressies controleren ook foutpaden, runner-disconnects, geïsoleerde databaseverwijdering en herstel van een onderbroken run.

Accountuitgifte en wachtwoordherstel verlopen via de beheerder. E-mailbezorging is niet ingericht. Voor dagelijks gebruik moet de instelling de accountuitgifte organiseren en periodieke back-ups naar haar eigen versleutelde externe opslag plannen. Scripts en een getest herstelpad zijn meegeleverd.

Gebruikers bepalen de inhoudelijke juistheid en geschiktheid van examens. De tests bevestigen procesregels en technische werking; de vaste checklist ondersteunt de menselijke inhoudelijke controle.
