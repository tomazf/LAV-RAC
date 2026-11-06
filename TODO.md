# TODO

- [x] Gumbi v vajah malo večji (6. 11. 2026).
- [ ] Gumbi za listanje med stranmi brez napisa Naprej/Nazaj (smer povesta puščica in položaj). `content/shell/vaja.js` (`buildPager`), nato `npm run import`.
- [ ] Odpiranje dela poglavja (skupine razlag) namesto celega poglavja. Učitelj se odloči med:
  - A: deli znotraj ene vaje (nova tabela odprtih delov, strežnik in statistika štejeta samo odprte dele; večja sprememba jedra),
  - B: vsak del je samostojna vaja (uvoz iz enega artifacta naredi več vaj, prikaz jih združi pod poglavje; jedro ostane kot v LAV-ELS). Priporočeno.
- [ ] Letnik razreda in prehod v naslednji letnik (glej spodaj).

## Letnik razreda in prehod v naslednji letnik

Dogovorjeno (6. 11. 2026): razred ima letnik in vidi poglavja svojega letnika. Dijak, ki napreduje v naslednji letnik, dobi novo vsebino, vaje prejšnjih letnikov pa mu ostanejo kot zbirka za nazaj. Naslednje leto ga lahko uči drug učitelj.

Za odločiti:
- Ali so vaje prejšnjih letnikov dijaku še odprte za reševanje (vaja za maturo) ali samo za ogled. Predlog: odprte, ločeno pod »Prejšnji letniki«.
- Ali se šolsko leto zaključi z enim dejanjem skrbnika (razredi se arhivirajo, dijaki ostanejo brez razreda) ali s prestavitvijo razreda (iz R2A nastane R3A z istimi dijaki). Predlog: prestavitev, ker je manj dela.
- Ali učitelj novega letnika vidi rezultate dijaka iz prejšnjih let. Predlog: v podrobnostih dijaka, v pregledu razreda samo tekoči letnik.
- Rok hrambe podatkov, ki traja več let (pooblaščena oseba za varstvo podatkov).

Kaj je treba narediti:
- letnik razreda (in šolsko leto) v bazi in pri ustvarjanju razreda; povezava letnika z deli LAV-RAČ2, LAV-RAČ3, LAV-RAČ4 v `content/portal.json`,
- seznam vaj za dijaka, odpiranje vaj, pogled razreda, izvoz CSV in statistika samo za letnik razreda,
- zgodovina članstva dijaka v razredih (iz katerega razreda in leta so stari rezultati),
- prestavitev razreda v naslednji letnik ali zaključek leta,
- razdelek »Prejšnji letniki« za dijaka,
- preizkusi in zapis v `docs/NACRT_PORTALA.md`; razmisliti, ali spremembo jedra ponudimo tudi LAV-ELS, da ostaneta ogrodji enaki.

Odprta vprašanja o vsebini so tudi v `docs/LAV-RAC.md` (razdelek Stanje).
