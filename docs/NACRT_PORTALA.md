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
| Dijak | učitelj ali skrbnik ga doda v en razred | rešuje odprte vaje, vidi svoj napredek, sam ponastavi vajo. Razreda ne more zapustiti |
| Nadzorni (dogovor 18. 11. 2026) | skrbnik mu določi enega ali več letnikov; dva nadzornika lahko letnike razdelita | vidi vaje izbranih letnikov samo za ogled, z rešitvami, brez »V pripravi«. Nima razreda, ne vidi napredka ali zgodovine dijakov, ničesar ne shrani (ni napredka, časa, točk in ponastavitve). Ne vidi seznamov učiteljev ali dijakov |
| Brez razreda | vsak nov ali odstranjen uporabnik | vidi samo obvestilo, da čaka na razred |

Pravila:
- Razrede ustvarja in briše samo skrbnik; vlogo učitelja določa samo skrbnik. Vloga nikoli ne pride iz žetona Microsoft, vedno iz baze in `ADMIN_EMAILS`.
- Razred ima lahko več učiteljev, učitelj več razredov. Dijake dodajajo in odstranjujejo vsi učitelji razreda; učitelj, ki se razredu ni pridružil, ga ne more odpreti (skrbnik lahko vse).
- Dodati je mogoče samo uporabnika brez razreda in brez vloge učitelja. Dijak je v enem razredu. Odstranjen dijak ostane v sistemu, napredek se ohrani in se vrne z njim.
- Uporabnika se ob vsaki zahtevi znova prebere iz baze, zato sprememba vloge ali odstranitev veljata takoj.
- Skrbnika ni mogoče izbrisati, dokler je v `ADMIN_EMAILS`.
- Nadzorni (`role = 'observer'`, letniki v `users.observer_years`) nima razreda in ne more biti učitelj ali dijak; pri določitvi se mu odstranijo razredi in učiteljevanje. Strežnik na poti do vaje preveri letnik, v pogledu ni shranjevanja (brez napredka, brez `/api/progress` in `/api/time`, brez sledilnika v strani). Nastavitev letnikov skrbnik vidi in spreminja v oknu uporabnika. Ob novem šolskem letu se letniki ne prenesejo samodejno.

## 3. Vaje in razredi

- Nov razred nima odprte nobene vaje; učitelj jih odpre sam in izbere vrstni red (po razredu, znotraj skupine).
- Če učitelj vajo zapre, se novi odgovori dijakov ne shranijo. Rezultati ostanejo v pregledu.
- Učitelji in skrbniki vidijo vse vaje in prazne skupine »V pripravi«, dijaki ne.
- Vaje so razdeljene v module (skupine); modul prikažemo samo, če ima vaje.
- Na dijakovem seznamu vaj vrstica vaje nima gumba: povezava je naslov vaje, zgoraj ostane en sam gumb, ki nadaljuje pri naslednji vaji (10. 11. 2026).
- **Letniki** (dogovorjeno 6. 11. 2026, neobvezno): `content/portal.json` ima `years`, npr. `{ "2": "LAV-RAČ2" }` (letnik: skupina). Ko je nastavljen in ima vsaj ena od teh skupin vaje, ima vsak razred letnik (skrbnik ga izbere ob ustvarjanju in ga lahko spremeni). Razred dela samo na skupini svojega letnika: učitelj odpira samo ta poglavja, pregled razreda, rezultati, CSV in podrobnosti dijaka kažejo samo ta letnik. Brez `years` (ali za razred brez letnika) razred vidi vse skupine, kot prej.
- Razred ima nastavitev **»dijaki vidijo tudi prejšnje letnike«** (za cel razred, nastavi skrbnik, od 15. 11. 2026 za vsak nižji letnik posebej: 4. letnik lahko odpre samo 2., samo 3. ali oba; `classes.past_years`). Najnižji letnik je nima in razred vidi samo letnike pod svojim; napis pove, kaj se odpre (»vidi 2. letnik«, »vidi 2. in 3. letnik«). Takrat dijaki vidijo vsa poglavja izbranih nižjih letnikov, ne glede na to, kaj je odprto tem letnikom, ločeno pod »Prejšnji letniki«. Vsebina je vedno trenutna različica. Napredek se pri njih hrani, dijak ga vidi in ga lahko sam ponastavi; ne šteje v letošnji seštevek in ga učitelj ne vidi.

## 4. Napredek, točke, ponastavitve

- Vsak dijak ima pri vaji en trenutni **poskus**. Rešena naloga je zaklenjena, namig odbije polovico točk, prikaz rešitve pomeni 0 točk. Pravila preveri tudi strežnik (`src/progress.js`): naloge, ki so bile rešene, se ne spremenijo, uporabljen namig ostane uporabljen, točke so omejene.
- **Delno točkovanje** (dogovor 16. 11. 2026): pri nalogi z več neodvisnimi deli dobi dijak točke po deležu pravilnih delov: `največ × pravilni / vsi`, zaokroženo navzdol na pol točke, vedno manj od polnih točk (npr. 3 točke in 6 trditev: 5 pravilnih = 2,5, 4 = 2, 3 = 1,5). Namig se računa na doseženem: polovica, spet navzdol na pol točke. Deli so: vrzeli z več polji, trditve pri razvrščanju in povezovanju, pravilni odgovori pri izbiri z več odgovori (izbrani pravilni minus izbrani napačni, najmanj 0), vrstice izpisa programa (vrstice, ki so na svojem mestu pravilne; najdaljše skupno zaporedje vrstic). Naloga z enim delom, naloge z enim pravilnim odgovorom in posebne vrste 2. letnika (bitna stikala, tabele resničnosti, KV-diagram, skupine, izrazi, deli slike, zbirnik) ostanejo vse ali nič. Dijak odda en odgovor in naloga se zaklene, kot prej. V stanju naloge je zapisano `f: false` (ni vse pravilno), `pr` in `po` (pravilnih in vseh delov) ter točke `p`; strežnik sprejme `p` samo kot večkratnik 0,5, najmanj za pol točke pod najvišjim možnim (`legalPoints`), brez oznake `f: false` veljajo stara pravila. Dogodek v `task_events` ima vrsto `part` (migracija 012), v statusih je to »delno pravilno« (`taskStatus` v `src/stats.js`), v lupini barva oliva (`--lr-part`). Pri izpisu in v artifactih to izračuna `LavRac.answered(idx, ok, note, part)` z `part = { right, of }`; pri uvozu vsake nove vaje z več deli v nalogah se `part` doda v preverjanje v adapterju (`partialCredit`, `partialCredit2`, `outputCompare` v `content/adapters/qformat.js`).
- **Ponastavitev** začne nov poskus. Sproži jo dijak, učitelj (posameznemu dijaku ali celemu razredu) ali nova različica vaje. Hrani se samo rezultat tik pred zadnjo ponastavitvijo (`resets`, ena vrstica na dijaka in vajo), kot varovalka za ponastavitev po nesreči: dokler dijak v novem poskusu ne odgovori na nobeno nalogo, štejejo te točke; ko začne reševati, šteje novi poskus. Ponastavitev poskusa brez odgovorov obdrži prej shranjene točke. Učitelj prejšnje točke vidi pri dijaku samo kot podatek; števila ponastavitev in zgodovine poskusov ni (8. 11. 2026). Porabljen čas ostane.
- **Naloga »Sam preveri«** (dogovorjeno 10. 11. 2026): naloga, pri kateri dijak sam preveri svoje delo (npr. program ali diagram, ki ga naredi v drugem orodju), nima točk in ni nikoli napačna. V katalogu ima `self: true` in `max: 0`. Gumb se imenuje »Preveril sem«, pri nalogi s programom »Shrani in končaj« (18. 11. 2026; koda se shranjuje sproti, gumb jo shrani še enkrat), s klikom je naloga opravljena in zaklenjena; rešitev je prosto na voljo, brez vprašanja, ne zaklene naloge in ne stane točk. Strežnik točke vedno postavi na 0, ne glede na to, kaj pošlje stran, ogledana rešitev se ne šteje (`legalPoints`, `summarize` v `src/progress.js`). Dogodek v `task_events` ima vrsto `self` (migracija 009). Učitelj jo vidi z lastno barvo (»sam preveril«), brez odstotka pravilnih in z oznako »sam preveri, brez točk«; v seštevku točk je ni.
- **Naloge s kodo so vedno »Sam preveri«** (dogovor 18. 11. 2026, velja za vsa nova in dopolnjena poglavja): vsaka naloga, pri kateri dijak napiše programsko kodo, je »Sam preveri«. Dijak kodo napiše in shrani (gumb »Shrani in končaj«), jo primerja z rešitvijo, namig in rešitev ostaneta, točk ni. Razlog: portal ne presoja logike dijakove kode, primerja samo prilepljen izpis (in po želji zgradbo kode z `need`), zato dijakova pravilna, a drugače napisana rešitev ne bi bila priznana. To velja tudi za naloge z daljšim izpisom, za programe iz nekdanjih laboratorijskih vaj in dodatnih zbirk ter za naloge »diagram poteka v program«. Maturitetna naloga v oznaki še pove, koliko je vredna na maturi (»Sam preveri · brez točk · na maturi 3 točke«). Izjeme, ki ostanejo točkovane, ker jih preveri stran sama: izbira, vrzeli, razvrščanje in »kaj program izpiše« (`true`/`false`, število ali ena vrstica). Samoocena, ki jo imajo novejši artifacti za naloge s kodo (»Primerjaj z rešitvijo«, merila), se ne prevzame.
- **Izjema za SQL poizvedbe** (dogovor 21. 11. 2026, poglavje 4.5): portal SQL ne izvaja, zato dijak poizvedbo požene v MySQL Workbench. Če je rezultat število ali kratek izpis (do 5 vrstic in 2 stolpca), vpiše kontrolni rezultat in naloga se točkuje; če je rezultat tabela ali večji izpis, je naloga »Sam preveri« brez točk. Pomožne skripte `.sql` so prenosi iz `src/public` (`/static`).
- **Izjema pri »Sam preveri«** (23. 11. 2026, navodila za 4.5): tri naloge sklopa D (unija, presek, razlika) imajo daljši izpis, a so točkovane s kontrolnim rezultatom (število vrstic in ena vrednost), kot določajo navodila za popravke 4. letnika.
- **Okno za kodo** (18. 11. 2026): visoko je toliko, kolikor ima koda vrstic, s tremi vrsticami rezerve (najmanj 9, največ 32 vrstic), da dijaku ni treba stalno drsati; raste med pisanjem in ga je mogoče še povečati z roko. Barvanje kode med pisanjem je bilo preučeno in opuščeno (prikaz rešitve je barvan, polje za vnos ne).
- Napredek je vezan na zaporedno številko naloge. Če se vrstni red ali število nalog spremeni, se poveča različica v ključu vaje (`_v1` v `_v2`) in dijaki začnejo nov poskus. Popravek besedila različice ne potrebuje.
- **Čas** šteje brskalnik samo, ko je zavihek viden in je bila v zadnji minuti aktivnost (utrip na 15 s, mirovanje po 60 s). Strežnik omeji posamezen prispevek na 60 s. Čas se beleži po straneh in poglavjih; to je ocena.
- **Opombe** so odstranjene (dogovor 15. 11. 2026, migracija `010_drop_student_notes.sql`): dijaki jih po vtisu učitelja niso uporabljali. Tabela `student_notes` se izbriše za vedno, tudi iz starih kopij, ker se po obnovi požene `migrate()` in jo izbriše znova. Datoteke s kopijami, ki jih skrbnik že ima, opombe še vsebujejo.
- **Pogoj pred nalogami** (`gate` v katalogu, neobvezno): seznam strani, ki jih mora dijak odpreti, preden naloge štejejo. Odprte strani so v stanju (`seen`), se samo dodajajo in jih ponastavitev ne izbriše; strežnik naloge, oddane pred tem, zavrže (`src/progress.js`). Učitelji in skrbniki pogoj preskočijo.
- **Spremenljiva števila**: del nalog ima za vsakega dijaka svoja števila. Naključno seme poskusa je v bazi (`progress.variant_seed`), zato so števila enaka po osvežitvi in na drugem računalniku, ponastavitev da nova. Naloge, začete pred dodelitvijo semena, obdržijo izvirna števila (`variant_keep`). Naloge s tega seznama so v `content/variants.json`, razponi v `src/public/js/variants/`, vsaka je preverjena z neodvisnim izračunom v `test/variants.test.js`.

## 5. Pogodba med vajo in portalom

Vaja je ena HTML datoteka (`content/exercises/<id>.html`), seznam nalog in strani pa je v `content/catalog.json`.

- **Katalog**: `modules` (`id`, `title`) in `exercises`. Vsaka vaja: `id`, `no` (številka, ki jo vidijo ljudje; brez nje se pokaže `id`), `module`, `title`, `fullTitle`, `key`, `version`, `format` (`short` ali `long`, določa imena polj v stanju), `maxPoints`, `tasks` (`i`, `level`, `max`, `section`, `q`, neobvezno `self`, glej razdelek 4), `pages` (`id`, `chapter`, `label`).
- **Zagon**: datoteka mora vsebovati oznako `<!--LAVELS:BOOT-->` v `<head>`. Strežnik jo nadomesti s `window.__LAVELS` (`id`, `title`, `key`, `attempt`, `uid`, `name`, `state`, `csrf`, `staff`, `variant`) in skript `tracker.js`. Oznaka `<!--LAVELS:VARIANTS-->` je za spremenljiva števila.
- **Shranjevanje**: vaja stanje shranjuje v `localStorage` pod `key` kot JSON `{ t: { <indeks naloge>: {...} } }`. Sledilnik ob zagonu postavi stanje s strežnika, vsako spremembo pošlje na `/api/progress/<id>` in šteje čas na `/api/time/<id>`. Pri poskusu, ki ga je spremenil drug zavihek ali ponastavitev, strežnik odgovori 409.
- **Obvezni elementi vaje**: gumb `#resetBtn` s potrditvijo `#resetYes` (v LAV-RAČ je na dnu levega stolpca, ne v glavi), naloge `.task`, strani `.page`. Poglavja (`Teorija`, `Simulacija`, `Naloge`) so zapisana v kodi (`CHAPTERS` v `src/catalog.js`).
- **Vrzeli v kodi** (dogovor 16. 11. 2026): naloga, ki ima v bloku kode `pre.code` vrzeli `___` in pod vprašanjem polja zanje (`.blank`), se pri uvozu vedno označi z `inline` (možnost v `LavRac.prepare`, izvedba `gapFill` v `content/shell/vaja.js`): polja so v kodi sami, ne pod njo. Število vrzeli v kodi je enako številu polj. Besedne vrzeli v besedilu vprašanja ostanejo ločena polja pod vprašanjem. Natančneje v `docs/LAV-RAC.md`, »Vrste nalog pri uvozu«.
- **Izpis programa, ki ga dijak vpiše** (dogovor 16. 11. 2026): pri nalogah, kjer dijak vpiše izpis programa (sledenje ali izpis lastnega programa), velike in male črke ter podvojeni in robni presledki niso pomembni; vsaka vrstica se obreže, več presledkov postane eden, prazne vrstice pred izpisom in za njim se izpustijo. Še vedno pomembni so: razmik ali prelom vrstice (`abc d e` ni isto kot `abc`, `d`, `e`), presledek znotraj besede ali števila (`1705 032704`) in šumniki. Naloga, v kateri je velikost črk ali presledek bistven in to piše v njenem besedilu, dobi v adapterju možnost `exact` (`LavRac.prepare`): izpis se primerja, kot je vpisan (obrežejo se le presledki na koncu vrstice in prazne vrstice na koncu). Takih nalog zaenkrat ni (pregledanih 75 izpisnih nalog v 3.1–3.5). Skupna izvedba: `outputCompare` v `content/adapters/qformat.js`.
- **Vrstica sledilnika**: sledilnik vaji doda povezavo »‹ Vse vaje«, stanje shranjevanja in gumb Odjava. Če ima vaja svojo vedno vidno glavo z elementom `.lr-top-in`, se vgradijo vanjo (povezava levo, odjava desno, brez ločenega temnega traku; 10. 11. 2026; v LAV-RAČ je glava ena vrstica, sporočilo o shranjevanju visi pod glavo; 13. 11. 2026); sicer dobijo svoj temni trak na vrhu strani.
- **Pisave in tresenje strani ob osvežitvi** (dogovorjeno in izvedeno 12. 11. 2026, enako kot pri LAV-ELS): ob F5 ali ob ponovnem kliku na isto povezavo se je stran malo stresla, ker se je besedilo najprej izrisalo z nadomestno pisavo in nato skočilo, ko je prispela prava. Vzrok: datoteke `.woff2` so se strežile z `no-cache` (pri vsakem nalaganju so šle na strežnik), vaje pa so `fonts.css` povezale brez različice. Zdaj so `.woff2` nespremenljive (`immutable`, eno leto; **spremenjena pisava dobi novo ime datoteke** in `fontPreloads` v `src/assets.js` se popravi), vsaka stran (portal in vaje) najavi štiri datoteke pisave Atkinson (`preload`, `crossorigin`) pred `fonts.css`, vaje pa dobijo `fonts.css` z različico (zamenjava v `renderExercise`, `src/catalog.js`). V vaji povezave na `fonts.css` ne spreminjaj (`/static/fonts/fonts.css`). Preizkus: pisave pridejo po F5 iz predpomnilnika.
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
- Stran **Kateri podatki se beležijo** (`/zasebnost`) našteje shranjeno: ime, uporabniško ime, e-pošta in čas prijave; odgovori, točke, namigi, rešitve; ogledane strani in čas; ponastavitve. Opis portala je na vrhu strani (iz `content/portal.json`).
- Odstranitev iz razreda podatkov ne izbriše. **Izbris uporabnika** pod Administracija je trajen: račun, napredek, zgodovina, ime v dnevniku (nadomesti ga »izbrisan uporabnik«) in seje. Skrbnik lahko izbriše tudi neaktivne dijake (najmanj 30 dni; najprej se pokaže seznam, brisanje potrdi skrbnik, razdelek 8).
- Izbrisani uporabnik ostane izbrisan tudi po obnovi stare kopije: baza hrani samo zgoščeno vrednost njihovega `oid` (`erased_users`, ne ime ali račun), po obnovi pa uporabnike, ki so starejši od izbrisa, znova izbriše.

## 8. Skrbnik

Strani: Uporabniki (filter, iskanje, urejanje s svinčnikom; dijakom brez razreda skrbnik izbere razred in shrani vse naenkrat), Vaje (pregled), Razredi (urejanje s svinčnikom), Šolsko leto (samo z letniki), Kopije, Dnevnik (razvrščanje po stolpcih, brisanje zapisov, starejših od 1, 2 ali 3 mesecev; zadnji zapis o kopiji in o zaključku šolskega leta vedno ostaneta), Čiščenje (izbris neaktivnih dijakov). Dolgi seznami (Uporabniki, Dnevnik) so po straneh, 10, 20 ali 50 na stran, privzeto 20 (10. 11. 2026). Dnevnik dejanj beleži, kdo je kaj naredil (slovenska imena dejanj).

**Seznami s svinčnikom** (dogovor 15. 11. 2026): v vrstici razreda ali uporabnika je samo ikona svinčnika, ki odpre eno okno za vse spremembe te vrstice; Shrani zapiše vse naenkrat, Prekliči, Escape ali klik zunaj okna ga zapre brez shranjevanja. Okno brez skripta ne dela (napisano je na strani). Besedila na teh straneh tečejo čez celotno širino strani, tudi na Kopijah in Čiščenju.
- **Razredi:** razredi so v skupinah po letnikih (2., 3., 4., nato brez letnika), vsaka skupina ima število razredov in dijakov. Razred brez učitelja ima oznako v vrstici in opozorilo nad tabelo (število tudi v naslovu skupine). Okno razreda: ime, letnik, prejšnji letniki (vsak posebej, samo pod letnikom razreda), učitelji; izbris razreda je v istem oknu. **Imena razredov so edinstvena** brez razlikovanja velikih in malih črk ter presledkov (skrbnik ne more ustvariti ali preimenovati razreda v že obstoječe ime; to drži tudi baza, `classes_name_key`); razred sme spremeniti pisavo svojega imena.
- **Uporabniki:** okno uporabnika: vloga (dijak, učitelj ali nadzorni z izbranimi letniki), za dijaka razred (skrbnik ga lahko premakne v drug razred, napredek ostane pri dijaku), za učitelja razredi, ki jih poučuje; izbris je v istem oknu. Dijak je v enem razredu, učitelj ni dijak: pri spremembi vloge se razredi druge vloge odstranijo. Skrbnika iz nastavitev strežnika ni mogoče urejati. Po shranjevanju se skrbnik vrne na isti seznam z istim filtrom in stranjo. Vsaka sprememba je v dnevniku (določil učitelja, dodal učitelja razredu, dodal dijaka v razred …).
- **Čiščenje:** skrbnik vpiše število dni (najmanj 30) in dobi seznam ujemajočih dijakov (ime, razred, zadnja prijava; učitelji in skrbniki niso na seznamu), privzeto vsi označeni; odznačeni ostanejo. Brisanje zahteva svež prenos kopije (30 minut) in potrditev; strežnik ob brisanju znova preveri, da je izbrani še vedno dijak brez prijave toliko dni, drugih ne izbriše (prijavljeni po predogledu se preskočijo). V dnevnik gre samo število.

**Kopije** (Administracija > Kopije):
- Prenos: `pg_dump` (zapis `custom`, brez sej), datoteka se ne shrani na strežnik, ampak samo na skrbnikov računalnik. Zadnja kopija se zabeleži v dnevnik.
- **Opozorilo** (rumeno, ne napaka) na vseh skrbniških straneh, če kopije ni ali je starejša od 7 dni.
- Obnova: nalaganje, preverjanje (podpis arhiva, tabele, ali se prebere v celoti, različica migracij, število uporabnikov), predogled, potrditev z vpisom OBNOVI, pred tem svež prenos (30 minut) ali izrecno »ne potrebujem«. Skript se najprej napiše v datoteko in izvede v eni transakciji (`DROP SCHEMA`, vsebina), zato ob napaki ostane stara baza. Med obnovo portal odgovarja 503, po njej so vsi odjavljeni. Kopija iz novejše različice portala se zavrne, starejša se posodobi z migracijami.
- Datoteka vsebuje osebne podatke; hrani se varno in se po izteku roka hrambe izbriše. `.env` ni del kopije.

**Šolsko leto** (Administracija > Šolsko leto, samo s `years`, dogovorjeno 6. 11. 2026): zaključek leta naredi samo skrbnik.
- Predogled je po letnikih (od 15. 11. 2026): razdelek »4. letnik: izbris«, nato »3. → 4. letnik«, »2. → 3. letnik« (po vrstnem redu prehoda; razdelek je viden tudi, če je prazen). V njem so razredi (nižji letniki s predlaganim novim imenom, npr. R2A v R3A, ki se lahko popravi), razredi brez letnika ostanejo. Pri vsakem razredu so dijaki, privzeto vsi označeni.
- Zadnji letnik: označeni dijaki se trajno izbrišejo (kot izbris uporabnika, tudi `erased_users`), odznačeni ostanejo brez razreda; razredi se izbrišejo. Pred potrditvijo predogled z imeni pove, kdo je še v razredih zadnjega letnika in se izbriše, in zahteva dodatno kljukico (strežnik jo preveri tudi pri ročno poslanem obrazcu).
- Nižji letniki: razred dobi višji letnik in novo ime, vklopijo se prejšnji letniki (vsi nižji, skrbnik jih lahko pri razredu izklopi), odprta poglavja se ponastavijo (vse zaprto), učitelji se odstranijo (dodeli jih skrbnik). Odznačeni dijaki (ki ne napredujejo) ostanejo brez razreda in nimajo dostopa do vaj, dokler jih učitelj ali skrbnik ne doda v razred; predogled pred potrditvijo našteje njihova imena. Napredek in prejšnji letniki ostanejo (naloge iz nižjega letnika dijak vidi, kolikor je pri razredu vklopljeno).
- Imena: nova imena morajo biti edinstvena. Razredi se preimenujejo prek vmesnih imen, zato R2A→R3A ob R3A→R4A ni težava; novo ime, ki ga ima razred, ki ostane (ali dva razreda z istim novim imenom), strežnik zavrne in ne spremeni nič, predogled pa opozori vnaprej.
- Pogoji: svež prenos kopije (30 minut, brez možnosti »ne potrebujem«), potrditev z vpisom PREHOD, drugi zaključek v 120 dneh še dodatna potrditev. Vse se zgodi v eni transakciji; spremeni se samo, kar je bilo v predogledu (dijak, dodan medtem, ostane, kjer je). V dnevnik gre število izbrisanih in premaknjenih, brez imen.

## 9. Seznami in vmesnik

- Vse, kar vidi uporabnik, je v slovenščini. Komentarji v kodi in sporočila commitov so angleški.
- Seznami oseb (brez razreda, dijaki v razredu, skrbniški seznam uporabnikov) so v slovenski abecedi (č, š, ž za c, s, z), ker je zbirka podatkov ne uredi tako. Ime je »Ime Priimek«, priimek je zadnja beseda. Seznam brez razreda in rezultate razreda je mogoče razvrstiti tudi po priimku.
- Seznam brez razreda kaže samo ime in priimek; UPN je v oblačku ob miški; iskanje je samo po imenu.
- Rezultati razreda: tabela po vajah, izvoz CSV, podrobnosti dijaka (naloge, točke pred zadnjo ponastavitvijo, čas po straneh).
- Podrobnosti dijaka (dogovor 15. 11. 2026): časovnica odgovorov ima obdobje 7 dni, 30 dni (privzeto), 90 dni, šolsko leto in vse (`?obdobje=`). Šolsko leto se šteje od 1. septembra. Do 92 dni je en stolpec en dan, daljše obdobje je po tednih (od ponedeljka do nedelje). Namigi se ne štejejo med odgovore, v pojavnem oknu pa so. Pojavno okno kaže dan, število odgovorov in namigov, uro prvega in zadnjega dogodka (samo pri dnevu), po vajah številke nalog in izide; podatki so iz `task_events`, časa reševanja po dnevih portal ne hrani. Okno deluje z miško, dotikom in tipkami (puščice, Home, End, Escape). Traki nalog pri vajah se začnejo povsod na istem mestu.
- Dijak z odprto vajo po posodobitvi portala osveži stran.
- Časi (dogovor 18. 11. 2026): pod minuto »pod 1 min«, do 60 min »N min«, od 60 min »H h M min«, od 24 h »D d H h«. Velja za vse časovne vrednosti na portalu (`duration` v `src/format.js`).
- Stran Vaje (dogovor 18. 11. 2026): vsak letnik je zložljiv razdelek, na začetku zaprt, odpre se posamično; brez gumba »Odpri vse«.
- Poglavja v pripravi (dogovor 18. 11. 2026): učitelji in skrbniki vidijo naslove poglavij, ki še niso uvožena (`planned` v `content/sources.json`), dijaki jih ne vidijo.

## 10. Postavitev

- Docker Compose: aplikacija (Node 22, Express 5, EJS, vrata 4000) in PostgreSQL 17. Slika vsebuje odjemalca PostgreSQL 17 (`pg_dump`, `pg_restore`, `psql`), ki mora ustrezati različici baze.
- Podatki so v trajnem nosilcu. Migracije (`src/migrations/`) se izvedejo same ob zagonu (z zaklepom, da se ne zaženeta dve naenkrat).
- `.env`: `PUBLIC_URL`, `OIDC_TENANT_ID`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `ADMIN_EMAILS`, `SESSION_SECRET` (vsaj 32 znakov), `POSTGRES_PASSWORD`, po potrebi `BIND_ADDRESS`, `APP_PORT`.
- Entra: nova registracija aplikacije, en najemnik, preusmeritev `https://DOMENA/auth/callback` in še `https://DOMENA/` za vrnitev po odjavi, skrivnost z rokom veljavnosti (pred iztekom jo obnovi), brez dodatnih dovoljenj.
- Pred njim obratni posredovalnik (pri LAV-ELS nginx v `ssl-proxy`) s `X-Forwarded-Proto: https`, za nalaganje kopij `client_max_body_size 200m;`. Lahko tudi Caddy s samodejnim HTTPS.
- Preverjanje: `/healthz`. Posodobitev: `git pull && docker compose up -d --build`.
- Noga na strani »Kateri podatki se beležijo« (`/zasebnost`) je skrita, tudi vrstica o kodi (dogovor 18. 11. 2026, kot v LAV-ELS).
- Različica kode za skrbnika (dogovor 18. 11. 2026, kot v LAV-ELS): v nogi strani je samo skrbniku vidna vrstica »Koda na strežniku: <kratek commit>, posodobljeno <čas zadnjega pulla>«. Vir je mapa `.git`, ki jo `docker-compose.yml` priklopi v vsebnik samo za branje (`src/version.js`). Ime varnostne kopije ima isti commit in lokalni čas portala; brez mape `.git` je »neznano«.
- Demo brez Microsofta: `docker compose -f docker-compose.demo.yml up --build` (lažna prijava, samo za preizkuse).

## 11. Preizkusi in CI

- `npm test`: e2e preizkusi z resničnim strežnikom, PostgreSQL in brskalnikom (Playwright), prijavo nadomesti `test/mock-oidc.js`; preizkus migracij; preizkusi spremenljivih števil; preizkus imen in `portal.json`.
- Vsebina se pri portalih menja, zato glavni preizkusi tečejo na svojih vajah v `test/fixtures/content` (`CONTENT_DIR`), `test/content.test.js` pa preveri portal s pravo vsebino.
- Baza `TEST_DATABASE_URL` se ob vsakem zagonu izbriše. Preizkus kopij potrebuje `pg_dump`, `pg_restore` in `psql` iste različice kot baza (`PG_BIN`).
- GitHub Actions: `test` (postgres:17, odjemalec 17) in `docker` (gradnja demo slike, preverjanje orodij v sliki in produkcijske datoteke Compose).
- Vsaka sprememba, ki jo vidi uporabnik, dobi preizkus. Spremembe gredo v `main`, portal na strežniku pa se posodobi šele, ko je CI zelen.
- Koliko se preizkuša pred objavo (dogovor 11. 11. 2026): sprememba, ki zadeva samo eno vajo (njen vir, adapter), pred objavo požene preizkuse, ki jo zadevajo (`node --test --test-name-pattern='…' test/content.test.js`). Celoten `npm test` je obvezen, kadar se spremeni skupna koda (`src/`, `content/shell/`, `content/portal.json`, skupni izgled) ali se vaja ali del doda ali odstrani. CI teče ob vsaki objavi in preveri vse; njegov rezultat se pogleda po objavi, brez čakanja. Pri portalih, ki so v CLAUDE.md zapisali drugače, velja njihov zapis.

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

## Dogovori 24. 11. 2026 (popravki 4. letnika, navodila `navodila/POPRAVKI_4_LETNIK.md`)

- 4.2: odstranjeni razlagi Transakcije (ACID) in Vloge (ROLE) ter naloge A12, A13, F5, H1, H2, H5 (`remove` v `prepare`). Dodani so razlaga 3 Shranjevanje in organizacija podatkov, razdelek Prednosti in slabosti PB v razlagi 2 in tri naloge na koncu sklopa A. Različica 2.
- 4.4: TRUNCATE ostane po odločitvi učitelja (odstopa od navodil). B11 in razlaga 6 pokrivata MySQL 8.0, 8.4 in 9.x. Izpis `SHOW CREATE TABLE` za MySQL 9.x je iz razlage 6 odstranjen (24. 11. 2026, na željo učitelja).
- Sklop Ponavljanje nimata 4.4 in 4.5 (vse naloge so bile ponovitve ali so odpadle).
- Preverjanje SQL: MariaDB 10.11 kot nadomestilo za MySQL. Sprejeti so zapisi brez narekovajev pri uporabniku in gostitelju ter z `ON TABLE`; `%` brez narekovajev MariaDB zavrne, zato ni sprejet. Skupne lupine (`content/shell/vaja.js`) nismo spreminjali, zato so sprejeti zapisi v `acc` nalog.
- Nova različica vaje ne briše več odgovorov, ki jih imajo dijaki. Naloge se shranjujejo po mestu (`task.i`), zato se ob odstranitvi nalog premaknejo. Tabela `task_map` (migracija 014) hrani naloge vsake različice po vrstnem redu, naloga pa je ista, če se začne z istim vprašanjem (prvih 80 črk, brez oznak in velikih črk). Ob prvem odpiranju nove različice se odgovori nalog, ki ostanejo, prestavijo na nova mesta, ostali se odstranijo; točke, namigi in rešitve se preračunajo, poskus (attempt) ostane. Vaje z variantami (`hasVariants`) ostanejo pri starem ponastavljanju.
- Pred objavo nove različice (npr. 4.2 in 4.4 v2) starejo različico zapiše skripta: `git show <zadnji-commit-stare-različice>:content/catalog.json > /tmp/catalog-old.json && node scripts/seed-task-map.mjs /tmp/catalog-old.json`. Skripta je enkratna in zapiše samo tiste različice, ki še niso v tabeli. Šele nato se objavi nova različica.
- Odgovori nalog, ki se pri spremembi vsebine odstranijo ali spremenijo po vrsti (4.4 B11, iz izbire v razvrščanje), se ob prehodu v novo različico ne prenesejo; to je dogovor 24. 11. 2026. Pri vsaki prihodnji spremembi vsebine veljajo zgornja pravila: odgovori ostanejo, dokler se naloga ne spremeni po vsebini.
- Spremembe strani in nalog 4.5 (stran »Unija, presek in razlika« na mestu VIEW, sklop D z novimi nalogami in naslovom, G7 z letnico 2026, devet dodatnih kontrolnih podatkov) so v viru `content/sources/4.5.html` in v artefaktu (24. 11. 2026); adapter jih ne vstavlja več. Odstranitev sklopa H ostane v adapterju. Artefakt 4.3 je enak viru (zadnja sprememba pred uvozom). Dijakov v 4.5 ni, zato prehod različice ni bil potreben.

## Dogovori 26. 11. 2026 (prikaz, prijave napak, črke možnosti)

**Prikaz (tema in dostopnost).** Ikona v glavi (portal in vsaka vaja) odpre okno »Prikaz« s petimi nastavitvami: tema (samodejno, svetla, temna), velikost besedila (običajna, večja, največja), razmik med vrsticami in črkami, kontrast (običajen, visok) in animacije (kot v sistemu, zmanjšane). Nastavitve so pri uporabniku v bazi (`users.prefs`, migracija 015), zato veljajo na vseh računalnikih. Strežnik jih zapiše v značke `data-theme`, `data-size`, `data-spacing`, `data-contrast` in `data-motion` v `<html>` (portal in vaje), zato se stran prvič nariše pravilno in skripta ničesar ne popravlja po nalaganju. Neznane vrednosti se zavržejo (`src/prefs.js`). Spremembe veljajo takoj in se shranijo prek `POST /api/prikaz`. Koda je v `src/public/js/hdr.js` in `src/public/css/hdr.css`; temo v vajah prevzame `content/shell/vaja.css` (`:root[data-theme="dark"]`), v portalu `app.css`.
- Zunanjega vtičnika za dostopnost (UserWay in podobni) ne uporabljamo: potreboval bi omilitev CSP za vse strani, pošiljal bi podatke dijakov zunanjemu ponudniku in ne nadomešča dostopnosti same vsebine. Dostopnost rešuje plošča »Prikaz«, ki je naša, brez zunanjih skript.

**Prijave napak.** Ikona z zastavico v glavi (portal in vaje) odpre okno z besedilom (do 2000 znakov). Vsebino (v oknu vrstica »Vsebina«, začne se z letnikom in poglavjem) izpolni stran: v vaji vaja, stran in naloga (`exercise_id`, `page_id`, `task_label`, `task_no`), drugje naslov strani. Strežnik kraj preveri (vaja mora obstajati, stran mora biti njena, oznaka naloge mora imeti obliko `B.3`) in ga ne sprejme slepo.
- Oddajo imajo dijaki, učitelji in nadzorni; skrbnik ne (popravi sam). Največ 10 prijav na uporabnika v 24 urah.
- Dijak vidi svoje prijave na strani `/prijave` (»Moje prijave«): stanje (Odprto, Rešeno) in odgovor skrbnika. Pri ikoni je številka, dokler ne odpre seznama, če je skrbnik odgovoril ali spremenil stanje (`reports.unseen`).
- Skrbnik: Administracija > Prijave. Razvrščanje po razredih in dijakih (privzeto) ali po letnikih in poglavjih vaje; filter stanja (odprte, rešene, vse), razreda in letnika vaje. Pri vsaki prijavi lahko napiše odgovor, označi kot rešeno ali jo ponovno odpre; odgovor in stanje sta neodvisna. Kraj je povezava na točno to nalogo. Število odprtih prijav je v meniju.
- Učitelj: Prijave (v glavnem meniju), samo ogled prijav dijakov razredov, kjer uči. Ne odgovarja in ne rešuje.
- Razred se ne shrani v prijavo; seznam ga bere pri avtorju takrat, ko se prikaže, zato prijava sledi dijaku v nov razred.
- Samo znotraj portala, brez e-pošte. Prijave se izbrišejo skupaj z uporabnikom, so del kopij in so opisane na strani »Kateri podatki se beležijo«. V dnevnik gre samo številka prijave, ne besedilo.

**Črke možnosti.** Artifacti dobijo črko možnosti iz niza `"ABCDEF"`, zato je imela sedma možnost črko »undefined« (4.2, sklop E, naloga 11, sedem možnosti). Uvoz (`scripts/import-artifacts.js`) zdaj nadomesti `"ABCDEF"[k]` z `String.fromCharCode(65+k)` pri vseh vajah.

**Opozorila o nenavadnih odgovorih** (dogovor 26. 11. 2026). Odgovori, ki so videti nenavadni, se označijo za učitelja. Nič se ne zavrne in točke se ne spremenijo: opozorilo je samo zapis.
- Zakaj odkrivanje, ne zapora: pravilni odgovori so zdaj v kodi vaje in odgovor preverja brskalnik, strežnik točke le omeji (`legalPoints`). Dokler strežnik ne pozna pravilnih odgovorov, ponarejenih točk ne more preprečiti, lahko jih le opazi. Prava zapora je preverjanje odgovorov na strežniku (odgovori v datotekah samo za strežnik, končna točka za preverjanje, prilagoditev adapterjev); to je veliko delo in je za naprej (`TODO.md`).
- Pravila (`src/flags.js`, čiste funkcije, pragovi v `LIMITS`): (1) **Več nalog naenkrat**: tri ali več nalog dobi točke v enem zahtevku (redni odjemalec pošilja po vsaki nalogi, s premorom 0,4 s); (2) **Prehitro reševanje**: v poskusu je deset ali več nalog s točkami, skupni čas na straneh vaje (`page_time`) pa je manjši od 5 s na nalogo. Pravilo 3 (naloga je končana, v stanju pa ni zapisa odgovora) ni vključeno, ker še ni preverjeno, kaj shrani vsaka vrsta naloge.
- Zaznavanje je v isti transakciji kot zapis napredka (`/api/progress/:id`), samo za dijake (učitelj in nadzorni odpirata vaje za ogled). Eno opozorilo na dijaka, vajo, poskus in pravilo (`UNIQUE`); odločitev se ne razveljavi z naslednjim odgovorom. Tabela `flags` hrani le številke (koliko nalog, koliko sekund), nikoli vsebine odgovora (migracija 016).
- Učitelj (svoji razredi) in skrbnik (vsi) vidita klicaj pri dijaku in v celici vaje (rezultati razreda, rezultati vaje) in razdelek »Opozorila« pri dijaku: razlaga v slovenščini, **Potrdi**, **Razveljavi**, **Spet odpri** in neobvezna opomba (do 500 znakov). V dnevnik gre samo številka opozorila.
- Dijak vidi **samo potrjeno** opozorilo: nevtralno obvestilo na seznamu vaj in na vrhu vaje, ki jo zadeva. Odprto in razveljavljeno opozorilo ostane pri učitelju. Potrditev je samo zapis (ne ponastavi vaje in ne spremeni točk; ponastavitev učitelj še vedno naredi sam).
- Opozorila se izbrišejo skupaj z uporabnikom, so del kopij in so opisana na strani »Kateri podatki se beležijo«.
