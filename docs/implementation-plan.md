# Van PTA naar gecontroleerd examen

## Doel en afbakening

Bouw een webapplicatie voor docenten Engels in vavo/vmbo. De applicatie brengt het bestaande PTA, de toetsmatrijs, het schrijven van teksten en multiplechoicevragen, collegiale controle, commissiebeoordeling en examenlogistiek bij elkaar. TanStack Start en PostgreSQL zijn de technische basis; accounts en sessies gebruiken Better Auth en passende plugins.

Versie 1 ondersteunt schriftelijke examens met teksten en multiplechoicevragen, één juist antwoord per vraag en gehele punten. Gebruikers schrijven alle inhoud zelf. Het product bevat geen generatieve AI of LLMs. Digitale afname, leerlingresultaten, automatische bestandsimport, een zelfstandige vragenbank, andere vraagvormen en gelijktijdig typen in dezelfde tekst vallen buiten versie 1.

De aangeleverde voorbeelden dienen als structuurreferentie: een PTA voor vavo/vmbo-tl met onder meer Engels, en een biologietoetsmatrijs met puntenverdelingen. De vakinhoud van de biologiematrijs wordt niet overgenomen.

## Accounts, teams en bevoegdheden

Een account krijgt precies één van vier rollen. Rollen zijn niet combineerbaar. Een persoon die uitzonderlijk verschillende functies vervult, gebruikt afzonderlijke accounts; de applicatie biedt dus scheiding per account, geen garantie van scheiding per natuurlijke persoon.

| Rol | Bevoegdheden |
| --- | --- |
| Docent | Binnen eigen teams PTA-gegevens invoeren, ontwerpen, matrijzen vaststellen, andermans werk controleren en een examen namens het team afronden en indienen. |
| Examencommissie | Examens beoordelen, bevindingen vastleggen, terugsturen en vrijgeven. Nooit examenauteur, inhoud bewerken of lid van een docententeam. Eén commissielid kan vrijgeven. |
| Examenbureau | Alle bureauleden kunnen vrijgegeven examens en correctiemodellen als pdf downloaden. Geen lid van docententeam of examencommissie. |
| Platformbeheerder | Accounts, rollen, teams en checklisttemplates beheren. Beheer geeft niet automatisch toegang tot exameninhoud of bevoegdheid om die te wijzigen. |

Docenten en commissieleden krijgen een pagina-preview, geen pdf-download. Servercontroles bewaken deze bevoegdheden op iedere lees-, schrijf-, status- en downloadactie; knoppen verbergen is onvoldoende. Rolwijzigingen moeten bestaande teamlidmaatschappen en actieve toegang consistent afhandelen. De pilot omvat één onderwijsinstelling met meerdere docententeams. Commissie en bureau hebben binnen die instelling toegang tot de relevante examens binnen hun rol.

## PTA en toetsmatrijs

Bewaar het bestaande PTA als naslag en laat docenten de relevante gegevens handmatig invoeren: schooljaar, opleiding, vak, onderdeelcode, leerstof, domeinen en leerdoelen, duur, hulpmiddelen, weging, afnamemoment en herkansbaarheid. Houd de weging van een PTA-onderdeel gescheiden van de puntenverdeling binnen een toets.

Een examen verwijst naar een PTA-onderdeel en een versie van een toetsmatrijs. De matrijs heeft leerdoelen als rijen, gegroepeerd onder domeinen, en R, T1, T2 en I als kolommen. Docenten leggen vooraf per cel een geheel aantal punten vast. Domeintotalen worden afgeleid uit de leerdoelen en tellen niet nogmaals mee. Toon totalen en afgeleide percentages. Iedere docent binnen het team mag de matrijs vaststellen; registreer wie welke versie heeft vastgesteld en wanneer.

Het gerealiseerde examen moet exact overeenkomen met iedere cel van de vastgestelde matrijs. Geen tolerantie of gemotiveerde uitzondering. Bij een benodigde wijziging ontstaat een nieuwe conceptmatrijs die opnieuw moet worden vastgesteld. Bewaar eerdere versies en toon de verschillen.

## Ontwerpen en werk verdelen

Verdeel het schrijfwerk in onderdelen: een tekst met bijbehorende vragen. Wijs per onderdeel een auteur en een andere docent als reviewer aan. Een eenvoudige tijdelijke bewerkvergrendeling voorkomt overschrijven; gebruik daarnaast versiecontrole bij opslaan, zodat een verlopen vergrendeling geen wijzigingen verloren laat gaan. Een achtergelaten vergrendeling moet kunnen verlopen of gecontroleerd worden vrijgegeven.

De teksteditor ondersteunt opgemaakte tekst, afbeeldingen, bronvermelding en automatische alineanummers. Tabellen en regelnummers zijn vooralsnog niet nodig. Auteurs bepalen de volgorde van teksten en vragen.

Een vraag bevat de vraagtekst, antwoordopties, precies één juist antwoord, een positief geheel aantal punten, één RTTI-categorie, één of meer leerdoelen en een onderbouwing met de relevante tekstpassage.

Verdeel de vraagpunten expliciet in gehele, niet-negatieve aantallen over de gekoppelde leerdoelen. De som is exact gelijk aan de vraagscore. Een gekoppeld leerdoel mag nul punten krijgen: het is inhoudelijk betrokken, maar draagt niet bij aan de puntenverdeling. Een vraag van één punt kan daardoor meerdere leerdoelen toetsen zonder dubbeltelling. Toon dit onderscheid zichtbaar. Een goed antwoord krijgt de volledige vraagscore; de verdeling over doelen is uitsluitend voor de matrijs.

Toon tijdens het ontwerpen voortdurend de gewenste en gerealiseerde punten per matrijscel, inclusief ontbrekende en overtollige punten.

## Verplichte inhoudelijke controle

Er zijn nog geen betrouwbare gegevens over huidige inhoudelijke fouten omdat controles nauwelijks plaatsvinden. Start daarom met een standaardchecklist die platformbeheerders kunnen aanpassen en registreer concrete bevindingen; gebruik de praktijkervaring om de checklist later te verbeteren.

Standaardchecklist bij ingebruikname:

- De tekst, bronvermelding en afbeeldingen zijn volledig en leesbaar.
- De vraag is eenduidig en met de tekst te beantwoorden.
- Precies één antwoord is verdedigbaar; afleiders zijn plausibel en geven geen onbedoelde aanwijzingen.
- De onderbouwing en tekstpassage ondersteunen het juiste antwoord.
- Leerdoelen, RTTI-indeling en puntentoedeling passen inhoudelijk bij de vraag.
- Taalniveau, omvang en beschikbare examentijd passen bij de doelgroep en het PTA.
- Nummering, instructies en paginaopmaak zijn bruikbaar voor afname.

Platformbeheerders kunnen checklistpunten toevoegen, wijzigen, verwijderen of deactiveren, ordenen en als verplicht of optioneel markeren. Zij beheren omschrijvingen en toelichtingen in een concepttemplate en publiceren vervolgens een nieuwe templateversie. Dit betreft het controlesjabloon, niet exameninhoud, ingevulde beoordelingen of goedkeuringen. Begin met één instellingsbrede template; de beheerder kan deze zonder codewijzigingen onderhouden. Een gepubliceerde template moet ten minste één verplicht controlepunt bevatten.

Nieuwe examens krijgen de actuele gepubliceerde templateversie. Een examen houdt de gebruikte templateversie vast, inclusief teksten en verplichtingen. Publicatie van een gewijzigde template verandert bestaande examens of afgeronde beoordelingen niet stilzwijgend. Bij kopiëren naar een nieuw examen wordt de actuele template gebruikt, zonder oude beoordelingen. Een docent kan voor een bewerkbaar examen expliciet overstappen naar de actuele template; dan worden de bijbehorende collegiale beoordelingen ongeldig en moet het examen opnieuw worden gecontroleerd. Ingediende en vrijgegeven versies behouden hun template. Bewaar bij iedere beoordeling de templateversie, antwoorden, reviewer en beoordeelde inhoudsversie.

Ongeacht de instelbare checklist blijven de procesvoorwaarden verplicht: een andere docent controleert, verplichte checklistpunten zijn afgehandeld, open bevindingen blokkeren afronding, en exacte matrijsovereenkomst en commissievrijgave blijven vereist. Een beheerder kan deze regels niet uitschakelen door een template aan te passen.

Een andere docent controleert ieder onderdeel. Checklistantwoorden, reviewer, tijdstip en beoordeelde inhoudsversie worden vastgelegd. Bevindingen moeten zijn afgehandeld voordat het team het examen kan afronden. Voorstel: de auteur verwerkt de bevinding; de reviewer beoordeelt de oplossing en sluit haar af. Het eigen werk goedkeuren is niet toegestaan, ook niet doordat iemand het onderdeel achteraf aan een ander toewijst.

Automatische controles bewaken volledigheid, precies één juist antwoord, gehele punten, geldige puntentoedeling, verplichte velden, matrijsovereenkomst en aanwezige beoordelingen. Zij beoordelen geen inhoudelijke juistheid. Dat blijft mensenwerk.

## Versies, beoordeling en vrijgave

De hoofdroute is: concept → collegiaal gecontroleerd → vastgesteld door docententeam / ingediend → commissiebeoordeling → vrijgegeven. Terugsturen leidt naar een nieuw bewerkbaar concept met zichtbare bevindingen.

Een inhoudelijke wijziging aan een vraag maakt de beoordeling van die vraag ongeldig. Een gewijzigde tekst vereist nieuwe controle van de tekst en de bijbehorende vragen. Wijzigingen aan leerdoelen, RTTI of puntentoedeling vereisen eveneens hercontrole. Bij een nieuwe matrijsversie moet de aansluiting opnieuw worden gecontroleerd en de teamvaststelling opnieuw plaatsvinden. Bewaar de relatie tussen iedere goedkeuring en de versie waarop zij betrekking heeft.

Indienen kan alleen met een vastgestelde matrijs, exacte celovereenkomst, volledige inhoud, geldige collegiale controles, een ingestelde en bij teamvaststelling vergrendelde N-term met berekende score-cijfertabel en zonder open bevindingen. Het ingediende examen is een vaste versie. De commissie beoordeelt die versie en wijzigt nooit zelf inhoud. Na terugsturen volgen aanpassing, relevante collegiale hercontrole en een nieuwe indiening. Eén commissielid kan de ingediende versie vrijgeven. De server controleert de voorwaarden ook bij de vrijgave.

Een vrijgegeven examen blijft ongewijzigd bewaard. Wijzigingen komen in een nieuwe conceptversie en doorlopen opnieuw de toepasselijke controles en commissievrijgave. Een vrijgegeven examen kan worden ingetrokken met een verplichte reden. Blokkeer verdere downloads direct en toon een duidelijke melding aan het examenbureau. Bewaar de ingetrokken versie, het besluit en de downloadhistorie. Reeds gedownloade bestanden kunnen niet worden teruggehaald. Een vervangende versie doorloopt opnieuw de controle- en vrijgaveroute. Alleen de examencommissie kan de vrijgave intrekken.

## Preview en pdf-publicatie

Docenten en commissieleden zien binnen de app een preview van de uiteindelijke paginaopmaak van examen en correctiemodel, inclusief pagina-einden, afbeeldingen en alineanummers. Zolang het examen niet is vrijgegeven staat er een duidelijk conceptkenmerk op.

Stel geen pdf-bestand of downloadendpoint voor concepten beschikbaar aan gebruikers. Gebruik een gedeelde opmaakbasis voor preview en definitieve pdf, zodat de gecontroleerde paginaopmaak overeenkomt met de uitvoer. Een schermpreview kan screenshots, kopiëren of browserprinten niet volledig verhinderen; de officiële pdf-publicatie blijft wel uitsluitend binnen de vastgelegde route.

Na vrijgave kunnen alle examenbureauleden twee pdf's downloaden: het examen voor kandidaten en het correctiemodel met juiste antwoorden, punten, onderbouwingen en een score-cijfertabel op basis van de ingestelde N-term. Antwoorden en interne reviewgegevens mogen niet in het kandidatenexamen terechtkomen. Koppel beide bestanden aan exact dezelfde vrijgegeven versie en vermeld herkenbare examen- en versiegegevens. Bestanden staan in private opslag; iedere download vereist rol- en vrijgavecontrole. Registreer downloads voor traceerbaarheid.

## Normering en N-term

De docent stelt vóór vaststelling een N-term in via een numeriek invoerveld in de app. De waarde is in de conceptfase vrij aanpasbaar, inclusief decimalen; er is geen vaste keuzelijst of stilzwijgende beperking tot gehele getallen. Alleen geldige eindige getallen worden geaccepteerd. Na iedere wijziging wordt automatisch de volledige score-cijfertabel voor alle gehele scores van nul tot de maximumscore opnieuw berekend en getoond in de correctiemodelpreview. Deze tabel komt ook in de vrijgegeven correctiemodel-pdf. Er worden geen leerlingresultaten geregistreerd.

Concrete rekenkeuze voor de implementatie: gebruik de hoofdrelatie met grensrelaties zoals beschreven door Examenblad, afgerond op één decimaal. Dit is een gekozen rekenmethode voor deze app, geen claim dat centrale-examenregels verplicht zijn voor deze schoolexamens. Bron: [Examenblad, uitleg normeringsformules](https://www.examenblad.nl/system/files/2018/vragen_en_antwoorden_webinar_9_maart_2017_versie_4-4-2017.pdf).

Met score S, positieve maximumscore L en ingestelde N-term N: x = S/L en H = 9x + N. Bij N = 1 geldt C = H. Bij N > 1 geldt C = min(H, 1 + 18x, 10 - 4,5(1 - x)). Bij N < 1 geldt C = max(H, 1 + 4,5x, 10 - 18(1 - x)). Rond uitsluitend de einduitkomst af op één decimaal, met halve waarden naar boven. Gebruik decimale of exacte rekenkunde om binaire afrondingsfouten te vermijden. Een lege toets of L = 0 kan niet worden vastgesteld. Geen afzonderlijke cesuurinstelling of aanvullende gokkanscorrectie in versie 1.

De N-term wordt definitief vergrendeld bij de eerste vaststelling van het examen door het docententeam, dus vóór indiening en vóór afname. Toon de ingestelde waarde en tabel bij die handeling. Daarna kan geen enkele accountrol de N-term wijzigen. Terugsturen, intrekken of een nieuwe revisie van hetzelfde examen heft die vergrendeling niet op. De commissie beoordeelt uitsluitend en kan de N-term niet aanpassen. Een normeringswijziging via hernieuwde vrijgave is uitdrukkelijk niet toegestaan.

Bewaar N-term, versie van de rekenmethode en moment en auteur van de vaststelling. Iedere vastgestelde examenrevisie bewaart daarnaast haar maximumscore en score-cijfertabel als vaste gegevens. Wanneer een inhoudelijk herzien examen een andere maximumscore krijgt, blijft de N-term gelijk en wordt de nieuwe tabel opnieuw berekend en beoordeeld vóór vrijgave. Reeds vastgestelde tabellen en pdf's wijzigen nooit achteraf. Kopiëren voor een werkelijk nieuw examen of herkansing levert een zelfstandig concept op, met een opnieuw vast te stellen normering; dit vervangt of hernormeert nooit het oorspronkelijke examen.

## Hergebruik

Een docent kan een toegankelijk examen kopiëren naar een nieuw concept, bijvoorbeeld voor een herkansing. Kopieer teksten, vragen, matrijs en de N-term als conceptwaarde, en laat het PTA-onderdeel en schooljaar controleren of aanpassen. Behoud een verwijzing naar het origineel. Goedkeuringen en vaststellingen gaan niet mee: ook de gekopieerde matrijs moet opnieuw worden vastgesteld en het examen doorloopt de volledige controle- en vrijgaveroute.

## Technische inrichting

Gebruik TanStack Start voor de webapp en serveracties, PostgreSQL voor relationele gegevens en Better Auth voor accounts en sessies. Selecteer bij implementatie de passende Better Auth-plugins voor accountbeheer en teams, op basis van actuele documentatie. Toets expliciet dat pluginrollen de vier exclusieve applicatierollen niet omzeilen. Inloggen met Microsoft is niet nodig voor versie 1.

Kerngegevens: account en rol, team en lidmaatschap, PTA en onderdeel, domein en leerdoel, examen en revisie, matrijs en versie, tekst, vraag, antwoordoptie, puntentoedeling, opdracht aan auteur/reviewer, checklisttemplate en templateversie, checklistbeoordeling, bevinding, commissiebesluit en exportregistratie. Bewaar inhoudsversies en gebeurtenissen zodat zichtbaar blijft wie wat heeft gewijzigd en goedgekeurd.

Gebruik transacties en revisiecontroles voor vaststellen, indienen en vrijgeven. Voorkom dat een wijziging gelijktijdig met een goedkeuring toch een ongecontroleerde versie oplevert. Bewaar afbeeldingen en brondocumenten in private bestandsopslag met autorisatie; het precieze opslag- en hostingproduct is nog te kiezen. Maak back-up en herstel van database én bestanden onderdeel van de oplevering.

## Implementatievolgorde en acceptatie

1. Start met de beschreven scope en acceptatiecriteria. Maak een representatief proefexamen voor het doorlopen van de volledige route; werk visuele en infrastructurele details tijdens implementatie uit.
2. Bouw accounts, beheer, teams, versieerbare checklisttemplates en serverautorisatie. Test rolcombinaties, toegang buiten het eigen team en verbod op schrijven door commissie en bureau.
3. Bouw handmatige PTA-invoer, doelenstructuur en versieerbare matrijs. Test gehele punten, domeinaggregatie, nulbijdragen en exacte celvergelijking.
4. Bouw tekst- en vraageditor, taakverdeling, vergrendeling en live matrijsvergelijking. Test meervoudige doelkoppeling zonder dubbeltelling en bescherming tegen overschrijven.
5. Bouw collegiale reviews, bevindingen, ongeldig worden van beoordelingen, teamvaststelling en commissiebeoordeling. Test zelfcontroleverbod, terugsturen, hercontrole en gelijktijdige statuswijzigingen. Test ook dat templatewijzigingen bestaande beoordelingen intact laten, nieuwe examens de actuele gepubliceerde template gebruiken en een expliciete templatewissel hercontrole vereist.
6. Bouw normering, paginapreview en private pdf-uitvoer. Test automatische herberekening in concept, N-termen onder/gelijk aan/boven 1, minimum- en maximumscore, monotoniciteit en afrondingsgrenzen. Test dat de N-term na teamvaststelling door geen enkele rol via de UI of API kan worden gewijzigd, ook niet na terugsturen, intrekken of een nieuwe revisie. Test dat oude score-cijfertabellen onveranderd blijven. Test intrekken en onmiddellijk blokkeren van downloads. Vergelijk opmaak met een representatief examen; test dat alleen bureauleden vrijgegeven pdf's kunnen ophalen en dat het examen geen antwoorden lekt.
7. Voeg kopiëren toe en test dat geen goedkeuringen meeverhuizen. Doorloop met docenten, commissie en bureau de hele route, inclusief afwijkende matrijs, inhoudelijke wijziging, afwijzing en hernieuwde vrijgave. Verifieer back-upherstel voor pilotgebruik.

De pilot is geslaagd als een team vanuit handmatig ingevoerde PTA-gegevens een exact passende matrijs en examen kan maken, controles aantoonbaar uitvoert, de commissie zonder bewerkrechten kan vrijgeven en alle bureauleden uitsluitend de vrijgegeven pdf's kunnen downloaden.

## Uitwerking tijdens implementatie en pilot

- Start met de standaardchecklist; platformbeheerders kunnen deze op basis van pilotervaring aanpassen. De verplichte collegiale beoordeling blijft een vaste procesregel.
- Huisstijl, voorblad, kandidaatvelden en overige pdf-instructies bepalen aan een proefexamen.
- Hosting, opslag, accountuitnodigingen en herstel van accounts uitwerken vóór pilotgebruik.

Reviewopmerkingen: [Aanvullingen en correcties](input:review_notes)
