# Dodajanje in dopolnjevanje poglavij (LAV-RAČ)

Navodilo za pogovor, v katerem se uvozi novo poglavje ali spremeni obstoječe. Stanje poglavij in seznam čakajočih je v `docs/LAV-RAC.md` (razdelek Stanje), splošni dogovor v `docs/NACRT_PORTALA.md`, pravila dela v `CLAUDE.md`. Artifact je samo vir vsebine; obliko, točke in shranjevanje doda portal.

## Pred začetkom

- Eno poglavje na pogovor, da kontekst ostane majhen in so koraki hitri. Poglavje se pokaže učitelju pred naslednjim.
- Delo gre neposredno v `main` repozitorija `tomazf/LAV-RAC`. LAV-ELS se ne spreminja.
- **Preizkusi: celotnega `npm test` ne zaganjaj brez izrecnega dovoljenja učitelja.** Zaženi samo preizkuse, ki jih sprememba zadeva (glej Preizkusi spodaj); CI požene vse ob objavi, rezultat se pogleda po objavi, brez čakanja.
- Vse, kar vidi uporabnik, je slovensko; komentarji v kodi in sporočila commitov so angleški. Commit konča z vrsticama `Co-Authored-By` in `Claude-Session`, ki ju določi pogovor.

## Priprava okolja v svežem pogovoru

Potrebno je samo za preizkuse in za `npm run import` (uvoz odpre stran v brskalniku).

1. Repozitorij `tomazf/LAV-RAC` priklopi s pravico za zapis (`add_repo`, `access: push`) in ga kloniraj; nato `npm ci`.
2. Chromium za Playwright je v okolju običajno že nameščen. Če ni: `npx playwright install chromium`.
3. Zaženi PostgreSQL (v okolju je običajno ugasnjen; na primer `pg_ctlcluster 16 main start`; različico pokaže `pg_lsclusters`).
4. Ustvari prazno bazo (na primer `lav_test`) in vlogo z geslom ter nastavi `TEST_DATABASE_URL=postgres://VLOGA:GESLO@localhost/lav_test`. **Baza se ob vsakem zagonu preizkusov izbriše**, nikoli ne pokaži na pravo bazo.
5. `pg_dump`, `pg_restore` in `psql` morajo biti iste različice kot strežnik (sicer `PG_BIN`). CI uporablja 17; v okolju je lahko 16 in to deluje.

## Novo poglavje

1. **Vnos v `content/sources.json`**: `id` (letnik.poglavje, na primer `2.5`), `artifact` (povezava), `artifactTitle`, `version` 1, `no` (številka poglavja v letniku). Mesto v `planned` pobriši (uvoz ga sam izpusti iz kataloga, a datoteka naj ne laže).
2. **Vir**: artifact prenesi z orodjem Artifact (`read`) in ga shrani nespremenjenega v `content/sources/<id>.html`.
3. **Adapter** `content/adapters/<id>.js`: po zgledu sosednjega poglavja istega letnika (2.x: `2.3.js`, 3.x: `3.5.js`, 4.x: `4.2.js`). Uporabi skupne dele iz `content/adapters/qformat.js`: `statements`, `QTEXT`, `outputCompare` (izpis programa), `partialCredit` (delno točkovanje; v 2.x `partialCredit2`). Vsaka zamenjava (`patches`) mora najti natanko eno mesto, sicer uvoz javi napako.
4. **Uvoz**: `npm run import -- <id>` zgradi `content/exercises/<id>.html` in posodobi `content/catalog.json` (druge vaje ostanejo, kot so). Uvoz preveri oštevilčenje nalog, črke sklopov brez vrzeli in napake na strani.
5. **Pregled na zaslonu** (učitelj): levi stolpec, skupine razlag (potrdi učitelj), legenda, sklop Za doma, naloge z izpisom, nobenih omemb laboratorijskih vaj v 3. letniku. Pri 4. letniku se sklici na druga poglavja ujemajo z načrtom poglavij.
6. **Dokumentacija**: posodobi tabelo in seznam »Kaj še rabimo« v `docs/LAV-RAC.md`; nov dogovor, ki ni zapisan, najprej poročaj in nato zapiši v `docs/NACRT_PORTALA.md`.
7. **Preizkusi** (glej spodaj), commit, push v `main`, CI.

## Pravila za naloge (povzetek)

- Naloga z `___` v kodi in polji pod vprašanjem je vedno `inline` (vrzeli so v kodi); besedne vrzeli v vprašanju ostanejo polja pod njim.
- Naloge s kodo (18. 11. 2026): točkovane po izpisu, razen če je izpis samo `true`/`false` ali ena ali dve vrednosti, ki jih dijak izračuna na pamet, in programov iz nekdanjih laboratorijskih vaj ter dodatnih zbirk: te so `self` (»Sam preveri«, gumb »Shrani in končaj«, brez točk, namig in rešitev ostaneta). Ob uvozu izpiši seznam nalog s kodo po tem pravilu in ga pokaži učitelju. Samoocena novejših artifactov se ne prevzame (`codeAsBefore` v `qformat.js`).
- Delno točkovanje (16. 11. 2026): naloga z več samostojnimi deli da največ točk × pravilni deli / vsi deli, navzdol na pol točke; z namigom polovica. Naloge z enim odgovorom in posebni tipi v 2.x ostanejo vse ali nič.
- Izpis programa se primerja brez razlikovanja velikih in malih črk in brez podvojenih presledkov; strogost (`exact`) samo, kadar jo naloga izrecno zahteva.
- Naloge »Sam preveri« nimajo točk; naloge »Za doma« se ne točkujejo; pri nalogah s programom portal hrani vpisani izpis in kodo.
- 3. letnik: skupine teorije, »Ponavljanje«, naloge s programom v poljubnem okolju (pravila v `TODO.md`).

## Sprememba obstoječega poglavja

Nova različica artifacta v `content/sources/<id>.html`, popravek adapterja, če kaka zamenjava ne najde več mesta, `npm run import -- <id>`, ustrezni preizkusi. `version` v `content/sources.json` se poveča samo, če se spremeni vrstni red ali število nalog (dijaki začnejo nov poskus).

## Prazno mesto

Poglavje, ki še nima artifacta, dobi vnos v `planned` v `content/sources.json` (`module`, `no`). Učitelji in skrbniki ga vidijo kot »V pripravi«.

## Preizkusi

- Vedno samo po imenu: `node --test --test-name-pattern='<del imena>' test/content.test.js`. Preizkusi poglavja imajo v imenu številko (`3.5: …`); poglej `grep -n "^test(" test/content.test.js`.
- Ob dodani ali odstranjeni vaji se spremenita dva preizkusa v `test/content.test.js`, ki ju je treba posodobiti in zagnati po imenu: `Za doma: two more tasks per chapter, added in the portal, unscored` (seznam vaj s številom nalog in točk) in `parts without exercises wait for staff; a closed class shows a clear message` (vrstice »V pripravi«). Preizkusi v `test/e2e.test.js` tečejo na vajah iz `test/fixtures/content` in jih novo poglavje ne zadene.
- Novo poglavje dobi svoj preizkus (zgled: preizkusi 3.4 in 3.5 v `test/content.test.js`): število nalog, točke, posebnosti nalog.
- Skupna koda (`src/`, `content/shell/`, `content/portal.json`, skupni izgled): pred zagonom celotnega niza vprašaj učitelja in priporoči, kaj je smiselno.
