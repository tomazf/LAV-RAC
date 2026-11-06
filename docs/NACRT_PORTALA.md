# Načrt portala

Splošen dogovor za portal z vajami, razredi in spremljanjem napredka, kakršen je LAV-ELS (`https://els.sc-nm.si`). Napisan je po kodi, README-ju in preizkusih tega repozitorija in je namenjen temu, da se pri novem, podobnem portalu dogovorov ne definira znova. Kar je vezano na vsebino LAV-ELS (digitalna elektronika), je v razdelku 12.

Če se dokument in koda ne ujemata, velja koda. Natančno vedenje opisujejo preizkusi v `test/`.

## 1. Namen

- Samostojno gostovan portal, ki poveže samostojne HTML vaje z nalogami in točkami. Dijaku shranjuje napredek, da lahko nadaljuje na katerem koli računalniku, učitelju pokaže, kako razred napreduje.
- Rezultati so za vajo in spremljanje, **ne za ocenjevanje**, ker se točkovanje izvaja v brskalniku. Strežnik pravila preveri, vendar to ni izpitno okolje.
- Beleži se porabljen čas; predvidenega časa ni.

## 2. Vloge

| Vloga | Kako jo dobi | Kaj lahko |
|---|---|---|
| Skrbnik | uporabniško ime (UPN) v `ADMIN_EMAILS` (brez razlikovanja velikih in malih črk) | ustvarja, preimenuje in briše razrede, določa učitelje in jih dodeljuje razredom, briše uporabnike, vidi dnevnik dejanj, dela kopije, lahko dela vse kot učitelj v vsakem razredu |
| Učitelj | določi ga skrbnik, domena ne odloča | se sam pridruži razredu, **iz razreda ga odstrani samo skrbnik** (izpisa ni, dogovorjeno 4. 11. 2026). V svojih razredih dodaja in odstranjuje dijake, izbira odprte vaje in vrstni red, vidi rezultate in dijake brez razreda, ponastavi vajo dijaku ali celemu razredu, izvozi CSV. Razredov ne ustvarja |
| Dijak | učitelj ali skrbnik ga doda v en razred | rešuje odprte vaje, vidi svoj napredek, sam ponastavi vajo, piše zasebne opombe. Razreda ne more zapustiti |
| Brez razreda | vsak nov ali odstranjen uporabnik | vidi samo obvestilo, da čaka na razred |

Pravila:
- Razrede ustvarja in briše samo skrbnik; vlogo učitelja določa samo skrbnik. Vloga nikoli ne pride iz žetona Microsoft, vedno iz baze in `ADMIN_EMAILS`.
- Razred ima lahko več učiteljev, učitelj več razredov. Dijake dodajajo in odstranjujejo vsi učitelji razreda; učitelj, ki se razredu ni pridružil, ga ne more odpreti (skrbnik lahko vse).
- Dodati je mogoče samo uporabnika brez razreda in brez vloge učitelja. Dijak je v enem razredu. Odstranjen dijak ostane v sistemu, napredek in opombe se ohranijo in se vrnejo z njim.
- Uporabnika se ob vsaki zahtevi znova prebere iz baze, zato sprememba vloge ali odstranitev veljata takoj.
- Skrbnika ni mogoče izbrisati, dokler je v `ADMIN_EMAILS`. Skrbnik ne piše opomb.

## 3. Vaje in razredi

- Nov razred nima odprte nobene vaje; učitelj jih odpre sam in izbere vrstni red (po razredu, znotraj skupine).
- Če učitelj vajo zapre, se novi odgovori dijakov ne shranijo. Rezultati ostanejo v pregledu.
- Učitelji in skrbniki vidijo vse vaje in prazne skupine »V pripravi«, dijaki ne.
- Vaje so razdeljene v module (skupine); modul prikažemo samo, če ima vaje.
- **Letniki** (dogovorjeno 6. 11. 2026, neobvezno): `content/portal.json` ima `years`, npr. `{ "2": "LAV-RAČ2" }` (letnik: skupina). Ko je nastavljen in ima vsaj ena od teh skupin vaje, ima vsak razred letnik (skrbnik ga izbere ob ustvarjanju in ga lahko spremeni). Razred dela samo na skupini svojega letnika: učitelj odpira samo ta poglavja, pregled razreda, rezultati, CSV in podrobnosti dijaka kažejo samo ta letnik. Brez `years` (ali za razred brez letnika) razred vidi vse skupine, kot prej.
- Razred ima nastavitev **»vidi prejšnje letnike«** (za cel razred, nastavi skrbnik). Najnižji letnik je nima; napis pove, kaj se odpre (»vidi 2. letnik«, »vidi 2. in 3. letnik«). Takrat dijaki vidijo vsa poglavja nižjih letnikov, ne glede na to, kaj je odprto tem letnikom, ločeno pod »Prejšnji letniki«. Vsebina je vedno trenutna različica. Napredek se pri njih hrani, dijak ga vidi in ga lahko sam ponastavi; ne šteje v letošnji seštevek in ga učitelj ne vidi.

## 4. Napredek, točke, ponastavitve

- Vsak dijak ima pri vaji en trenutni **poskus**. Rešena naloga je zaklenjena, namig odbije polovico točk, prikaz rešitve pomeni 0 točk. Pravila preveri tudi strežnik (`src/progress.js`): naloge, ki so bile rešene, se ne spremenijo, uporabljen namig ostane uporabljen, točke so omejene.
- **Ponastavitev** začne nov poskus. Sproži jo dijak, učitelj (posameznemu dijaku ali celemu razredu) ali nova različica vaje. Prejšnji rezultat in razlog (dijak, učitelj, različica) ostaneta zabeležena in ju učitelj vidi. Opombe ostanejo.
- Napredek je vezan na zaporedno številko naloge. Če se vrstni red ali število nalog spremeni, se poveča različica v ključu vaje (`_v1` v `_v2`) in dijaki začnejo nov poskus. Popravek besedila različice ne potrebuje.
- **Čas** šteje brskalnik samo, ko je zavihek viden in je bila v zadnji minuti aktivnost (utrip na 15 s, mirovanje po 60 s). Strežnik omeji posamezen prispevek na 60 s. Čas se beleži po straneh in poglavjih; to je ocena.
- **Opombe**: pri nalogi, pri vaji in splošna, do 5000 znakov, kot navadno besedilo. Vidi jih samo dijak; učitelji in skrbniki jih v portalu ne vidijo. Ponastavitev jih ne izbriše.
- **Pogoj pred nalogami** (`gate` v katalogu, neobvezno): seznam strani, ki jih mora dijak odpreti, preden naloge štejejo. Odprte strani so v stanju (`seen`), se samo dodajajo in jih ponastavitev ne izbriše; strežnik naloge, oddane pred tem, zavrže (`src/progress.js`). Učitelji in skrbniki pogoj preskočijo.
- **Spremenljiva števila**: del nalog ima za vsakega dijaka svoja števila. Naključno seme poskusa je v bazi (`progress.variant_seed`), zato so števila enaka po osvežitvi in na drugem računalniku, ponastavitev da nova. Naloge, začete pred dodelitvijo semena, obdržijo izvirna števila (`variant_keep`). Naloge s tega seznama so v `content/variants.json`, razponi v `src/public/js/variants/`, vsaka je preverjena z neodvisnim izračunom v `test/variants.test.js`.

## 5. Pogodba med vajo in portalom

Vaja je ena HTML datoteka (`content/exercises/<id>.html`), seznam nalog in strani pa je v `content/catalog.json`.

- **Katalog**: `modules` (`id`, `title`) in `exercises`. Vsaka vaja: `id`, `no` (številka, ki jo vidijo ljudje; brez nje se pokaže `id`), `module`, `title`, `fullTitle`, `key`, `version`, `format` (`short` ali `long`, določa imena polj v stanju), `maxPoints`, `tasks` (`i`, `level`, `max`, `section`, `q`), `pages` (`id`, `chapter`, `label`).
- **Zagon**: datoteka mora vsebovati oznako `<!--LAVELS:BOOT-->` v `<head>`. Strežnik jo nadomesti s `window.__LAVELS` (`id`, `title`, `key`, `attempt`, `uid`, `name`, `state`, `csrf`, `staff`, `variant`, `notes`) in skripti `notes.js` in `tracker.js`. Oznaka `<!--LAVELS:VARIANTS-->` je za spremenljiva števila.
- **Shranjevanje**: vaja stanje shranjuje v `localStorage` pod `key` kot JSON `{ t: { <indeks naloge>: {...} } }`. Sledilnik ob zagonu postavi stanje s strežnika, vsako spremembo pošlje na `/api/progress/<id>` in šteje čas na `/api/time/<id>`. Pri poskusu, ki ga je spremenil drug zavihek ali ponastavitev, strežnik odgovori 409.
- **Obvezni elementi vaje**: gumb `#resetBtn` s potrditvijo `#resetYes`, naloge `.task`, strani `.page`. Poglavja (`Teorija`, `Simulacija`, `Naloge`) so zapisana v kodi (`CHAPTERS` v `src/catalog.js`).
- **Ključi**: `scnm_lavele_*` in `window.__LAVELS` so tehnična imena in ostanejo tudi v novem portalu, razen če se spremeni tudi sledilnik.
- Vaje 3.1 in 3.2 imata v svoji kodi vrstico `LavelsVariants.apply(...)`, ki jo orodje za uvoz ne doda.
- Računalniki se delijo, zato se pri odjavi in v sledilniku iz `localStorage` odstranijo podatki drugih uporabnikov in drugih vaj.

## 6. Prijava in varnost

- Prijava samo prek Microsoft Entra (OIDC): koda z PKCE (S256), `state`, `nonce`, `prompt=select_account`, obseg `openid profile email`. Sprejme se samo račun iz domače organizacije (`tid`). Uporabnik je določen z `oid`, ime za prijavo je `preferred_username` (UPN).
- Odjava odjavi tudi pri Microsoftu, da naslednji dijak na skupnem računalniku ne nadaljuje kot prejšnji.
- Seje v PostgreSQL (`connect-pg-simple`), piškotek `<slug>.sid`, `httpOnly`, `sameSite=lax`, `secure` pri HTTPS, 12 ur, podaljšuje se. Po prijavi se seja zamenja.
- CSRF: žeton je v seji in v vseh obrazcih (`_csrf`) ali v telesu zahtevka; pri nalaganju datotek v glavi `x-csrf-token`.
- CSP: pri portalu so dovoljene samo skripte iz strežnika (brez vgrajenih skript, zato je vsa koda v zunanjih datotekah); vaje (`/vaje/*`) smejo imeti vgrajeno kodo, a se povezujejo samo s tem strežnikom. Helmet, HSTS pri HTTPS. Vse, kar je naloženo, je lokalno (pisave vključno).
- Strežnik, ne brskalnik, odloča o točkah, zaklepanju in dostopu do vaj.

## 7. Zasebnost

- Portal hrani podatke dijakov, zato se pred uporabo pogovori s pooblaščeno osebo za varstvo podatkov in določi rok hrambe.
- Stran **Kateri podatki se beležijo** (`/zasebnost`) našteje shranjeno: ime, uporabniško ime, e-pošta in čas prijave; odgovori, točke, namigi, rešitve; ogledane strani in čas; ponastavitve; opombe. Opis portala je na vrhu strani (iz `content/portal.json`).
- Odstranitev iz razreda podatkov ne izbriše. **Izbris uporabnika** pod Administracija je trajen: račun, napredek, opombe, zgodovina, ime v dnevniku (nadomesti ga »izbrisan uporabnik«) in seje. Skrbnik lahko izbriše tudi neaktivne dijake (najmanj 30 dni).
- Izbrisani uporabnik ostane izbrisan tudi po obnovi stare kopije: baza hrani samo zgoščeno vrednost njihovega `oid` (`erased_users`, ne ime ali račun), po obnovi pa uporabnike, ki so starejši od izbrisa, znova izbriše.

## 8. Skrbnik

Strani: Uporabniki (iskanje, vloge, izbris), Vaje (pregled), Razredi, Šolsko leto (samo z letniki), Kopije, Dnevnik. Dnevnik dejanj beleži, kdo je kaj naredil (slovenska imena dejanj).

**Kopije** (Administracija > Kopije):
- Prenos: `pg_dump` (zapis `custom`, brez sej), datoteka se ne shrani na strežnik, ampak samo na skrbnikov računalnik. Zadnja kopija se zabeleži v dnevnik.
- **Opozorilo** (rumeno, ne napaka) na vseh skrbniških straneh, če kopije ni ali je starejša od 7 dni.
- Obnova: nalaganje, preverjanje (podpis arhiva, tabele, ali se prebere v celoti, različica migracij, število uporabnikov), predogled, potrditev z vpisom OBNOVI, pred tem svež prenos (30 minut) ali izrecno »ne potrebujem«. Skript se najprej napiše v datoteko in izvede v eni transakciji (`DROP SCHEMA`, vsebina), zato ob napaki ostane stara baza. Med obnovo portal odgovarja 503, po njej so vsi odjavljeni. Kopija iz novejše različice portala se zavrne, starejša se posodobi z migracijami.
- Datoteka vsebuje osebne podatke; hrani se varno in se po izteku roka hrambe izbriše. `.env` ni del kopije.

**Šolsko leto** (Administracija > Šolsko leto, samo s `years`, dogovorjeno 6. 11. 2026): zaključek leta naredi samo skrbnik.
- Predogled: razredi zadnjega letnika (izbris), razredi nižjih letnikov (napredovanje, predlagano novo ime, npr. R2A v R3A, ki se lahko popravi), razredi brez letnika (ostanejo). Pri vsakem razredu so dijaki, privzeto vsi označeni.
- Zadnji letnik: označeni dijaki se trajno izbrišejo (kot izbris uporabnika, tudi `erased_users`), odznačeni ostanejo brez razreda; razredi se izbrišejo.
- Nižji letniki: razred dobi višji letnik in novo ime, vklopi se »vidi prejšnje letnike«, odprta poglavja se ponastavijo (vse zaprto), učitelji se odstranijo (dodeli jih skrbnik). Odznačeni dijaki ostanejo brez razreda. Napredek ostane.
- Pogoji: svež prenos kopije (30 minut, brez možnosti »ne potrebujem«), potrditev z vpisom PREHOD, drugi zaključek v 120 dneh še dodatna potrditev. Vse se zgodi v eni transakciji; spremeni se samo, kar je bilo v predogledu (dijak, dodan medtem, ostane, kjer je). V dnevnik gre število izbrisanih in premaknjenih, brez imen.

## 9. Seznami in vmesnik

- Vse, kar vidi uporabnik, je v slovenščini. Komentarji v kodi in sporočila commitov so angleški.
- Seznami oseb (brez razreda, dijaki v razredu, skrbniški seznam uporabnikov) so v slovenski abecedi (č, š, ž za c, s, z), ker je zbirka podatkov ne uredi tako. Ime je »Ime Priimek«, priimek je zadnja beseda. Seznam brez razreda in rezultate razreda je mogoče razvrstiti tudi po priimku.
- Seznam brez razreda kaže samo ime in priimek; UPN je v oblačku ob miški; iskanje je samo po imenu.
- Rezultati razreda: tabela po vajah, izvoz CSV, podrobnosti dijaka (zgodovina, ponastavitve, čas po straneh).
- Dijak z odprto vajo po posodobitvi portala osveži stran.

## 10. Postavitev

- Docker Compose: aplikacija (Node 22, Express 5, EJS, vrata 4000) in PostgreSQL 17. Slika vsebuje odjemalca PostgreSQL 17 (`pg_dump`, `pg_restore`, `psql`), ki mora ustrezati različici baze.
- Podatki so v trajnem nosilcu. Migracije (`src/migrations/`) se izvedejo same ob zagonu (z zaklepom, da se ne zaženeta dve naenkrat).
- `.env`: `PUBLIC_URL`, `OIDC_TENANT_ID`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `ADMIN_EMAILS`, `SESSION_SECRET` (vsaj 32 znakov), `POSTGRES_PASSWORD`, po potrebi `BIND_ADDRESS`, `APP_PORT`.
- Entra: nova registracija aplikacije, en najemnik, preusmeritev `https://DOMENA/auth/callback` in še `https://DOMENA/` za vrnitev po odjavi, skrivnost z rokom veljavnosti (pred iztekom jo obnovi), brez dodatnih dovoljenj.
- Pred njim obratni posredovalnik (pri LAV-ELS nginx v `ssl-proxy`) s `X-Forwarded-Proto: https`, za nalaganje kopij `client_max_body_size 200m;`. Lahko tudi Caddy s samodejnim HTTPS.
- Preverjanje: `/healthz`. Posodobitev: `git pull && docker compose up -d --build`.
- Demo brez Microsofta: `docker compose -f docker-compose.demo.yml up --build` (lažna prijava, samo za preizkuse).

## 11. Preizkusi in CI

- `npm test`: e2e preizkusi z resničnim strežnikom, PostgreSQL in brskalnikom (Playwright), prijavo nadomesti `test/mock-oidc.js`; preizkus migracij; preizkusi spremenljivih števil; preizkus imen in `portal.json`.
- Vsebina se pri portalih menja, zato glavni preizkusi tečejo na svojih vajah v `test/fixtures/content` (`CONTENT_DIR`), `test/content.test.js` pa preveri portal s pravo vsebino.
- Baza `TEST_DATABASE_URL` se ob vsakem zagonu izbriše. Preizkus kopij potrebuje `pg_dump`, `pg_restore` in `psql` iste različice kot baza (`PG_BIN`).
- GitHub Actions: `test` (postgres:17, odjemalec 17) in `docker` (gradnja demo slike, preverjanje orodij v sliki in produkcijske datoteke Compose).
- Vsaka sprememba, ki jo vidi uporabnik, dobi preizkus. Spremembe gredo v `main`, portal na strežniku pa se posodobi šele, ko je CI zelen.

## 12. Vezano na vsebino LAV-ELS (v novem portalu zamenjaj)

| Kje | Kaj |
|---|---|
| `content/portal.json` | ime, `slug`, naslov in podnaslov prijavne strani, opis, šola (povezava, logotip), skupine »V pripravi« |
| `content/catalog.json`, `content/exercises/`, `content/variants.json` | vaje, naloge, strani, spremenljive naloge |
| `src/public/js/variants/`, `test/variants.test.js` | generatorji števil in njihovo preverjanje (če vaje nimajo spremenljivih števil, se izbrišejo) |
| `scripts/import-exercises.js` | seznam vaj in modulov, preoblikovanje objavljenih strani |
| `src/catalog.js` (`CHAPTERS`) | poglavja Teorija, Simulacija, Naloge, ki jih uporablja tudi sledenje časa |
| `src/views/partials/gate.ejs`, logotip v `head.ejs`, `src/public/img/` | slika z logičnimi vrati in znak portala |
| `test/e2e.test.js` | preizkusi, ki imenujejo posamezne vaje (npr. »vseh 9 vaj«) |
| besedilo | »vaje«, »dijak«, »učitelj« po šolski rabi; za drugačno vsebino prilagodi |

## 13. Nov portal korak za korakom

1. Nov repozitorij iz LAV-ELS. Najbolje klon z dodanim `upstream` (`git remote add upstream https://github.com/tomazf/LAV-ELS.git`), da se popravki ogrodja (varnost, kopije, seznami) lahko združijo z `git merge upstream/main`. Čim bolj ostani pri `portal.json` in vsebini, da bodo združitve brez konfliktov.
2. Uredi `content/portal.json`. **`slug` po začetku uporabe ne spreminjaj** (piškotek, ime kopij, zapis izbrisanih uporabnikov).
3. Zamenjaj vsebino (razdelek 12) in poženi `npm test`.
4. Nova registracija aplikacije v Entra, nov `.env`, svoj `APP_PORT` in svoja mapa na strežniku (svoja baza in nosilec), poddomena, strežnik pred njim, `client_max_body_size`.
5. Poženi demo, preveri vloge, naredi prvo kopijo.
6. Sproti: vsak dogovor, ki ga portal doda, se zapiše v ta dokument, da ostane skupen.
