# TODO

- [x] Gumbi v vajah malo večji (6. 11. 2026).
- [x] Gumbi za listanje med stranmi brez napisa Naprej/Nazaj (6. 11. 2026).
- [x] Odpiranje dela poglavja: ne delamo (6. 11. 2026). Poglavje je odprto v celoti; če bo treba, se vsebina razdeli v ločene artifacte, ki postanejo ločene vaje.
- [x] Prazno mesto poglavja (LAV-RAČ2, 4. poglavje) je »V pripravi« za učitelje in skrbnike (6. 11. 2026). Nova prazna mesta se dodajo v `content/sources.json` (`planned`).
- [x] Letnik razreda in prehod v naslednji letnik (6. 11. 2026, glej spodaj).
- [x] Administracija > Razredi: gumbi Dodaj (in Shrani) (učitelj) naj bodo poravnani v stolpcu, ne glede na dolžino imena v izbirnem polju (6. 11. 2026).
- [x] Administracija > Razredi: pri najnižjem letniku (2.) ni izbire »vidi prejšnje letnike«, ker nižjega letnika ni. Pri 3. in 4. naj napis pove, kaj se odpre (3.: »vidi 2. letnik«, 4.: »vidi 2. in 3. letnik«) (6. 11. 2026).
- [x] Administracija > Uporabniki (6. 11. 2026):
  - v eni vrstici najprej filter »Prikaži: …«, nato iskalno polje, na koncu gumb Išči,
  - strani: navigacija na dnu, izbira 20/50/100 na stran (privzeto 50); iskanje in filter ostaneta pri menjavi strani,
  - pri filtru »brez razreda« ima vsak dijak izbirno polje z razredi (po letniku in imenu) in na dnu en gumb »Shrani«; dodelitev gre v dnevnik,
  - »Izbriši neaktivne dijake za vedno« se premakne na svoj, 7. zavihek »Čiščenje« (za Dnevnikom), delovanje ostane enako.
- [x] Administracija > Dnevnik (6. 11. 2026):
  - strani kot pri Uporabnikih (20/50/100, privzeto 50) namesto zadnjih 300 zapisov,
  - razvrščanje s klikom na glavo stolpca (čas, oseba, dejanje, podrobnosti), naraščajoče/padajoče, na strežniku; privzeto najnovejši zgoraj,
  - gumb zgoraj: izbriši zapise, starejše od 1/2/3 mesecev, s potrditvijo. Zadnji zapis o prenosu kopije in zadnji zapis o zaključku šolskega leta vedno ostaneta (portal ju bere). Brisanje se zapiše v dnevnik s številom zapisov.
- [x] Ponastavitev vaje (6. 11. 2026): namen je varovalka, če dijak vajo ponastavi po nesreči. Hrani se samo seštevek točk zadnjega poskusa pred ponastavitvijo (en korak nazaj), da se točke ne izgubijo, če vaje ne reši znova. Število ponastavitev in zgodovina vseh poskusov se ne prikazujeta (↺ v pregledu razreda in stolpec »ponastavitve« v CSV se odstranita). Ponastavitev posameznega vprašanja ni potrebna. Upoštevanje (6. 11. 2026): samodejno, brez gumba za vračanje. Dokler dijak v novem poskusu ne odgovori na nobeno nalogo, štejejo prejšnje točke; ko začne reševati, šteje novi poskus. Prejšnje točke učitelj vidi pri dijaku samo kot podatek.
- [x] 2.3: sklop I »Še več maturitetnih nalog« se preimenuje v »Ponavljanje« (8. 11. 2026). Ostane med Vajami in se točkuje kot zdaj; naslov je bil netočen, ker so med 7 nalogami 3, ki niso iz mature. Sprememba v adapterju, artifact ostane, kot je.
- [x] Za doma: v 2.1, 2.2 in 2.3 po 2 dodatni nalogi za doma, smiselni glede na tematiko poglavja (8. 11. 2026). Kot obstoječe: brez točk in samodejnega preverjanja, z vzorčnim odgovorom. Dodam jih v adapterju (artifact ostane, kot je); predloge nalog pred objavo pokažem.
- [x] Administracija > Šolsko leto: lepši in bolj praktičen predogled (6. 11. 2026):
  - naslov razreda (»T4A: razred se izbriše, 0 dijakov«) je v robu okvirja, na sredini črte, in izgleda zamaknjeno; naj bo znotraj kartice kot naslov,
  - seznam razredov je preširok; kartice razredov v dveh (ali več) stolpcih,
  - bolj pregledno in hitreje za delo: strnjen prikaz (razred, novo ime in dijaki v eni vrstici), povzetek na vrhu (koliko razredov se izbriše, koliko napreduje, koliko dijakov), pri razredih z dijaki »izberi vse / nobenega«.
- [x] 3.1 Java in delovanje JVM uvožena (9. 11. 2026).
- [x] Vaja, levi stolpec: števci pri sklopih vaj (npr. 0/10) vedno ob desnem robu, tudi ko gre ime sklopa v eno vrstico (9. 11. 2026, narejeno 9. 11. 2026). Kljukice pri učiteljih ostanejo, kot so (vse razlage označene).
- [x] Vaja, levi stolpec: stanje sklopov vaj (odločeno 9. 11. 2026, narejeno 9. 11. 2026): pred vsakim sklopom majhen krog kot tortni graf v barvah stanj (zeleno pravilno, jantarno pravilno z namigom, rdeče napačno, sivo-vijolično ogledana rešitev, svetlo sivo še neodgovorjeno), brez kljukice ob koncu; števec ob desnem robu. Za doma: kljukica, ko jo dijak odpre. Sprememba je v skupni obliki vaje (`content/shell/`), zato velja za vse že objavljene vaje (ponoven `npm run import`) in za vsa nova poglavja; dogovor je v `docs/LAV-RAC.md` (Oblika vaje).
- [x] Vaja, levi stolpec: viseči zamik pri prelomu (9. 11. 2026, narejeno 9. 11. 2026; izbirni seznam na telefonu je izvorni element brskalnika, zamika ne omogoča, zato ostane, kot je). Oznaka (»A ·«, »1 ·«) je v svojem stolpcu, druga vrstica imena se poravna z začetkom besedila (npr. »kode« pod »Programski«), ne z začetkom oznake. Velja za vse vnose v levem stolpcu (razlage in sklopi vaj) in za vse vaje, tudi nove; tudi na telefonu, kjer je izbirni seznam, preveriti, ali je treba kaj prilagoditi.
- [x] Vaja: »Za doma« dobi naslednjo črko za zadnjim sklopom vaj (9. 11. 2026), v levem stolpcu, na pregledu in v naslovu strani. Črko določi skupna oblika vaje sama, zato velja za vse vaje in nova poglavja brez dela pri uvozu: 2.1 E, 2.2 G, 2.3 J, 3.1 F. Uvoz se ustavi z napako, če se črke sklopov ne nadaljujejo brez vrzeli (A, B, C …).
- [x] Vaja, sklop nalog: legenda barv pod oštevilčenimi gumbi nalog (pravilno, pravilno z namigom, napačno, ogledana rešitev) desno poravnana (9. 11. 2026), v vseh vajah; na telefonu, ko se prelomi, ostane desno (narejeno 9. 11. 2026).
- [x] 3.2 Algoritmi in diagram poteka uvožena (9. 11. 2026): 51 nalog, 89 točk; skupine razlag, Ponavljanje (2 nalogi), stikalo napisov v diagramih, programi v poljubnem okolju.
- [ ] LAV-RAČ3: uvoz 3.3–3.6, po eno poglavje, vsako pokažem pred naslednjim. Dogovorjeno 8. 11. 2026, velja za vsa poglavja 3. letnika:
  - skupine teorije: 3.2 Algoritem in zapis (Kaj je algoritem, Načini zapisa, Simboli) · Gradniki in sled (Zaporedje/vejitev/ponavljanje, Sled) · Od diagrama do programa (Od diagrama do Jave, Kako rešiš nalogo); 3.3 Program in podatki (Struktura, Spremenljivke in tipi) · Izpis in vnos · Računanje in potek programa (Aritmetika, Zaporedje/vejitev/zanka, Pogoste napake); 3.4 Tipi in pretvorbe (Območja, Pretvarjanje) · Znaki in nizi (Znak in ASCII, Integer/Double/niz) · Operatorji (Operatorji, Pogoste napake); 3.5 Stavek if (if, if–else in bloki, Gnezdenje) · Več možnosti (else if in ?:, switch, Pogoste napake); 3.6 Vrste zank (while, for, do-while, Izbira in pretvorba) · Gnezdenje, break in continue · Vzorci (Vzorci in algoritmi, Pogoste napake),
  - sklop »Še več maturitetnih nalog« iz strani Za doma gre med Vaje kot zadnji sklop »Ponavljanje« in se točkuje,
  - stikalo »Napisi v diagramih« (Flowgorithm/Matura) v 3.2 in 3.3 ostane,
  - naloge s programom: »Zaženi program v poljubnem okolju (Eclipse, VS Code, Programiz …) in prilepi njegov izpis«; preveri se izpis; koda in izpis se hranita v portalu,
  - 3.4: sklop E Operatorji (41 nalog) v dva dela: E »Operatorji in izrazi« (prvih 23) in F »Računanje s programi in logični izrazi« (ostalih 18); ponavljanje postane G,
  - laboratorijske vaje se ne omenjajo več: 3.5 sklop E in 3.6 sklop F postaneta »Naloge za utrjevanje«, 3.6 sklop G »Dodatne vaje«; v 3.4 »Laboratorijska vaja N (program X):« postane »Program X:«; brez oznak »RAČ-LAV 3 · vaja N« na nalogah, v opisih sklopov in na dnu strani,
  - »Poglavje N od 12« se ne kaže; sklicevanja na poglavja 7–12 v besedilu ostanejo.
- [x] Ikona strani povsod (6. 11. 2026): `/favicon.ico` (izdelan iz `favicon.svg` z `node scripts/make-favicon.js`) in povezava na vseh straneh, tudi v vajah.

## Letnik razreda in prehod v naslednji letnik

Dogovorjeno (6. 11. 2026):
- Vsako leto so v portalu 2., 3. in 4. letniki. Razred ima letnik; učitelj pri razredu vidi in odpira samo poglavja tega letnika, pregledi, statistika in CSV kažejo samo ta letnik.
- Razred ima nastavitev »Vidi prejšnje letnike« (za cel razred). Letos je pri vseh izklopljena; ob prehodu v naslednji letnik se vklopi. Takrat dijak vidi vsa poglavja nižjih letnikov ne glede na to, kaj je odprto tem letnikom, ločeno pod »Prejšnji letniki«.
- Vsebina prejšnjih letnikov je vedno trenutna različica (dopolnjene naloge se posodobijo, odstranjene izginejo). Napredek dijaka se pri njih hrani, dijak ga vidi in ga lahko sam ponastavi; učitelj ga ne vidi in ga ne potrebuje.
- Napredek, ki ga je dijak naredil v prejšnjem letu, ostane; ponastavi ga lahko samo dijak sam.
- Prehod naredi samo skrbnik, na novi strani Administracija > Šolsko leto: najprej sveža kopija, nato predogled, potrditev z vpisom besede, zapis v dnevnik.
  - 4. letniki: dijaki se trajno izbrišejo z nalogami, opombami in napredkom (obstoječi izbris uporabnika), njihovi razredi se izbrišejo.
  - 3. in 2. letniki napredujejo; ime razreda se predlaga (R2A v R3A) in se lahko popravi; odprta poglavja se ponastavijo.
  - Seznam dijakov, ki napredujejo, ima privzeto izbrane vse; skrbnik lahko koga odznači.
  - Učitelje razredom dodeli skrbnik (ob prehodu se odstranijo).
- Dijak, ki se med letom izpiše, se izbriše kot zdaj (Administracija > Uporabniki).
- Podatki dijaka se hranijo, dokler je vpisan. Kopije baze hrani skrbnik, dokler jih sam ne izbriše (6. 11. 2026).

- Dijak, ki ga skrbnik pri prehodu odznači (ne napreduje), ostane brez razreda; skrbnik ga doda v ustrezen razred.

Narejeno (6. 11. 2026): letnik in nastavitev pri razredu (migracija 007, `years` v `content/portal.json`), filtriranje po letniku v vseh pogledih učitelja, razdelek »Prejšnji letniki«, stran Šolsko leto, preizkus v `test/content.test.js`, zapis v `docs/NACRT_PORTALA.md`. Dodatno: tudi dijake zadnjega letnika je mogoče odznačiti (ostanejo brez razreda, niso izbrisani).

- [x] Letnikov in strani Šolsko leto ne ponudimo LAV-ELS, so samo za ta portal (6. 11. 2026).

Odprta vprašanja o vsebini so tudi v `docs/LAV-RAC.md` (razdelek Stanje).
