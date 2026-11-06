# TODO

- [x] Gumbi v vajah malo večji (6. 11. 2026).
- [ ] Gumbi za listanje med stranmi brez napisa Naprej/Nazaj (smer povesta puščica in položaj). `content/shell/vaja.js` (`buildPager`), nato `npm run import`.
- [x] Odpiranje dela poglavja: ne delamo (6. 11. 2026). Poglavje je odprto v celoti; če bo treba, se vsebina razdeli v ločene artifacte, ki postanejo ločene vaje.
- [ ] Prazno mesto poglavja (LAV-RAČ2, 4. poglavje) se pokaže kot »V pripravi« v seznamu vaj za učitelje in skrbnike (dijaki ga ne vidijo). Ogrodje zdaj pozna samo prazne dele, ne praznih poglavij.
- [ ] Letnik razreda in prehod v naslednji letnik (glej spodaj).
- [ ] Ikona strani povsod: obstoječi `favicon.svg` tudi na straneh vaj (uvoz doda povezavo), `/favicon.ico` naj vrne isto ikono (brskalniki in zaznamki ga iščejo sami).

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
- Podatki dijaka se hranijo, dokler je vpisan. Za pooblaščeno osebo za varstvo podatkov ostane še rok hrambe kopij baze.

- Dijak, ki ga skrbnik pri prehodu odznači (ne napreduje), ostane brez razreda; skrbnik ga doda v ustrezen razred.

Kaj je treba narediti: letnik in nastavitev v bazi in pri razredu, filtriranje po letniku v vseh pogledih, razdelek »Prejšnji letniki«, stran Šolsko leto s predogledom in izbiro dijakov, preizkusi, zapis v `docs/NACRT_PORTALA.md`. Razmisliti, ali spremembo jedra ponudimo tudi LAV-ELS.

Odprta vprašanja o vsebini so tudi v `docs/LAV-RAC.md` (razdelek Stanje).
