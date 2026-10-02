# Beheer en herstel

De applicatie gebruikt één onderwijsinstelling. Accounts hebben precies één rol: docent, examencommissie, examenbureau of platformbeheerder. Er is geen openbare registratie. De beheerder maakt accounts aan, deelt een eerste wachtwoord buiten de app en kan een wachtwoord herstellen. Gebruikers kunnen hun wachtwoord wijzigen. Microsoft-aanmelding en e-mailbezorging zijn niet ingeschakeld.

## Starten

Kopieer `.env.example` naar `.env`, stel willekeurige geheimen en het eerste beheeraccount in, en voer `docker compose up -d --build` uit. De migratie maakt tabellen en de eerste gepubliceerde checklist aan. De bootstrap maakt alleen een ontbrekend beheeraccount aan. PostgreSQL heeft geen gepubliceerde poort; de webapp luistert op `127.0.0.1:3817`. Exameninhoud, afbeeldingen en pdf’s bevinden zich uitsluitend in private Docker-volumes.

## Rollen en teams

Beheeraccounts hebben geen toegang tot exameninhoud. Alleen docenten kunnen teamlid zijn. Rolwijzigingen beëindigen sessies en verwijderen onverenigbare lidmaatschappen en vergrendelingen. De Better Auth-adminplugin gebruikt beperkte rollen; zijn algemene beheer- en impersonatie-endpoints zijn niet bereikbaar. Applicatiebeheer loopt door de eigen geautoriseerde endpoints. Teamlidmaatschappen worden relationeel beheerd, zodat een tweede organisatie-rollenmodel geen applicatiebevoegdheden kan verruimen.

## Back-up

Voer `scripts/backup.sh` uit met Docker-toegang. Het script maakt een PostgreSQL-dump, archief van de private bestanden en checksums. Kopieer de map naar versleutelde opslag buiten deze host en bewaar `.env` apart in een geheimenbeheerder. Plan dit dagelijks via de beheeromgeving. De scripts zelf publiceren niets.

`scripts/verify-restore.sh backups/<tijdstip>` verifieert checksums, herstelt de database in een tijdelijke database, controleert kernrecords en pakt het bestandenarchief uit in een tijdelijke map. De productiedatabase wordt niet overschreven.

Voor daadwerkelijk calamiteitenherstel: stop de webservice, herstel de dump met `pg_restore` in een nieuwe PostgreSQL-database, herstel het bestandenarchief naar het private bestandenvolume, controleer eigendom (de container draait als gebruiker `node`), stel de databaseverbinding in en start de webservice. Controleer aanmelden, een examenpreview en een geautoriseerde pdf-download voordat verkeer wordt hervat. Behoud de eerdere volumes tot het herstel is bevestigd.

## Vrijgave en intrekking

Indienen legt normering, maximumscore en score-cijfertabel vast. De N-term blijft voor dit examen permanent vergrendeld, ook na terugsturen of intrekking. Een werkelijk nieuw examen ontstaat met kopiëren. Een ingetrokken vrijgave blokkeert nieuwe downloads; eerder gedownloade bestanden kunnen niet worden teruggehaald. Het bureau ziet ingetrokken versies. Auditregistratie bewaart besluiten en downloads.

## Publicatie

De tainer-route is expliciet openbaar; Better Auth verzorgt de applicatie-aanmelding. Publicatie gebruikt de beheerde `publish-tainer-docker-app`-helper. Wijzig Caddy en DNS niet handmatig. Controleer `/health`, containergezondheid en Playwright na een update.
