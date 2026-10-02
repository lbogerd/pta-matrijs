# Beheer en herstel

De applicatie gebruikt één onderwijsinstelling. Accounts hebben precies één rol: docent, examencommissie, examenbureau of platformbeheerder. Er is geen openbare registratie. De beheerder maakt accounts aan, deelt een eerste wachtwoord buiten de app en kan een wachtwoord herstellen. Gebruikers kunnen hun wachtwoord wijzigen. Microsoft-aanmelding en e-mailbezorging zijn niet ingeschakeld.

## Starten

Kopieer `.env.example` naar `.env`, stel willekeurige geheimen en het eerste beheeraccount in, en voer `docker compose up -d --build` uit. De migratie maakt tabellen en de eerste gepubliceerde checklist aan. De bootstrap gebruikt uitsluitend `BOOTSTRAP_ADMIN_EMAIL` en `BOOTSTRAP_ADMIN_PASSWORD` uit de containeromgeving en maakt alleen een ontbrekend beheeraccount aan; het wachtwoord moet minstens 12 tekens bevatten. Een bestaand account wordt nooit opnieuw ingesteld of automatisch tot beheerder gemaakt. `BETTER_AUTH_URL` wordt door Compose uit `APP_URL` ingesteld en moet exact de publieke HTTPS-origin zijn. Verwijder de bootstrapwaarden uit de runtimeconfiguratie zodra het eerste account is aangemaakt; herstel een later vergeten wachtwoord via een ander beheeraccount. Geheimen horen niet in commandoregelargumenten of Git. PostgreSQL heeft geen gepubliceerde poort; de webapp luistert op `127.0.0.1:3817`. Exameninhoud, afbeeldingen en pdf’s bevinden zich uitsluitend in private Docker-volumes.

## Rollen en teams

Beheeraccounts hebben geen toegang tot exameninhoud. Alleen docenten kunnen teamlid zijn. Rolwijzigingen beëindigen sessies en verwijderen onverenigbare lidmaatschappen en vergrendelingen. De Better Auth-adminplugin gebruikt beperkte rollen; zijn algemene beheer- en impersonatie-endpoints zijn niet bereikbaar. Applicatiebeheer loopt door de eigen geautoriseerde endpoints. Teamlidmaatschappen worden relationeel beheerd, zodat een tweede organisatie-rollenmodel geen applicatiebevoegdheden kan verruimen.

## Back-up

Voer `scripts/backup.sh` uit met Docker-toegang. Het script maakt een PostgreSQL-dump, archief van de private bestanden en checksums. Voer een back-up tijdens een onderhoudsvenster zonder inhoudswijzigingen en uploads uit: database en bestanden worden achtereenvolgens gekopieerd en vormen bij gelijktijdige wijzigingen geen gegarandeerd gezamenlijk momentbeeld. Kopieer de map naar versleutelde opslag buiten deze host en bewaar `.env` apart in een geheimenbeheerder. Plan dit dagelijks via de beheeromgeving. De scripts zelf publiceren niets.

`scripts/verify-restore.sh backups/<tijdstip>` vereist Bash, Python 3.11 of hoger, Docker Compose en toegang tot de Docker-socket. Het script verifieert beide SHA-256-checksums, ook wanneer de back-upmap is verplaatst, en herstelt de database in een unieke tijdelijke database. Het weigert onveilige archiefpaden en symbolische links, vergelijkt de uitgepakte bytes met het archief en controleert dat ieder databasebestand via zijn UUID/bestandsnaam aanwezig is en het verwachte PNG-, JPEG- of PDF-formaat heeft. Extra pdf-cachebestanden worden eveneens byte voor byte gecontroleerd.

De geïsoleerde databasecontrole vergelijkt de actuele optimistische versie met de revisiehistorie, controleert de permanent vergrendelde N-term en de identiteit en lengte van vrijgegeven score-cijfertabellen. Per vrijgegeven snapshot wordt een fingerprint gerapporteerd voor het herstelverslag; de integriteit van de volledige databaseback-up is beschermd door de SHA-256-checksum. De fingerprint is geen vergelijking met de mogelijk inmiddels gewijzigde productiedatabase. Tijdelijke databases en bestanden worden ook bij een fout opgeruimd. De productiedatabase en productievolumes worden nooit overschreven.

Bewaar het succesvolle verificatieverslag naast de versleutelde back-up en herhaal dit na wijzigingen aan het gegevensmodel. Deze technische herstelcontrole vervangt de functionele controles na een werkelijk herstel niet. Een mislukte verwijzingscontrole betekent dat deze back-up niet als volledig herstelbaar mag worden aangemerkt.

Voor daadwerkelijk calamiteitenherstel: stop de webservice, herstel de dump met `pg_restore` in een nieuwe PostgreSQL-database, herstel het bestandenarchief naar het private bestandenvolume, controleer eigendom (de container draait als gebruiker `node`), stel de databaseverbinding in en start de webservice. Controleer aanmelden, een examenpreview en een geautoriseerde pdf-download voordat verkeer wordt hervat. Behoud de eerdere volumes tot het herstel is bevestigd.

## Vrijgave en intrekking

Indienen legt normering, maximumscore en score-cijfertabel vast. De N-term blijft voor dit examen permanent vergrendeld, ook na terugsturen of intrekking. Een werkelijk nieuw examen ontstaat met kopiëren. Een ingetrokken vrijgave blokkeert nieuwe downloads; eerder gedownloade bestanden kunnen niet worden teruggehaald. Het bureau ziet ingetrokken versies. Auditregistratie bewaart besluiten en downloads.

## Publicatie

De tainer-route is expliciet openbaar; Better Auth verzorgt de applicatie-aanmelding. Publicatie gebruikt de beheerde `publish-tainer-docker-app`-helper. Wijzig Caddy en DNS niet handmatig. Controleer `/health`, containergezondheid en Playwright na een update.
