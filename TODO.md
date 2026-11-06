# TODO

- [x] Gumbi v vajah malo večji (6. 11. 2026).
- [x] Gumbi za listanje med stranmi brez napisa Naprej/Nazaj (6. 11. 2026).
- [x] Odpiranje dela poglavja: ne delamo (6. 11. 2026). Poglavje je odprto v celoti; če bo treba, se vsebina razdeli v ločene artifacte, ki postanejo ločene vaje.
- [x] Prazno mesto poglavja (LAV-RAČ2, 4. poglavje) je »V pripravi« za učitelje in skrbnike (6. 11. 2026). Nova prazna mesta se dodajo v `content/sources.json` (`planned`).
- [x] Letnik razreda in prehod v naslednji letnik (6. 11. 2026, glej spodaj).
- [ ] Administracija > Razredi: gumbi Dodaj (učitelj) naj bodo poravnani v stolpcu, ne glede na dolžino imena v izbirnem polju (6. 11. 2026).
- [ ] Administracija > Razredi: pri najnižjem letniku (2.) ni izbire »vidi prejšnje letnike«, ker nižjega letnika ni. Pri 3. in 4. naj napis pove, kaj se odpre (3.: »vidi 2. letnik«, 4.: »vidi 2. in 3. letnik«) (6. 11. 2026).
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
