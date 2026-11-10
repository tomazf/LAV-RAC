# LAV-RAČ: stanje in posebnosti

Splošni dogovor je v `NACRT_PORTALA.md`. Tukaj je samo, kar velja za ta portal.

## Stanje

Postavljena je osnova: prijava, vloge, oblika, vstopna stran in struktura z deli LAV-RAČ2, LAV-RAČ3 in LAV-RAČ4. Uvožene so vaje 2.1 Številski sistemi, kodiranje in pariteta, 2.2 Logične funkcije – utrjevanje, 2.3 Arhitektura računalniških sistemov, 3.1 Java in delovanje JVM (LAV-RAČ3, 1. poglavje), 3.2 Algoritmi in diagram poteka (LAV-RAČ3, 2. poglavje), 3.3 Temeljni gradniki programa (LAV-RAČ3, 3. poglavje) in 3.4 Podatkovni tipi v Javi (LAV-RAČ3, 4. poglavje).

Razpored (od učitelja, popravljen 6. 11. 2026). Poglavja se v vsakem letniku štejejo od 1 in tako jih vidijo dijaki in učitelji (`no`); tehnična oznaka vaje (`id`, v povezavah in bazi) je letnik.poglavje, da je enolična:
- LAV-RAČ2 (prazno mesto 4 je za učitelje »V pripravi«, `planned` v `content/sources.json`): 2.1 Številski sistemi, kodiranje in pariteta, 2.2 Logične funkcije – utrjevanje, 2.3 Arhitektura računalniških sistemov, 2.4 (prosto, dodamo kasneje), 2.5 Operacijski sistemi in Linux lupina
- LAV-RAČ3: 3.1 Java in delovanje JVM, 3.2 Algoritmi in diagram poteka, 3.3 Temeljni gradniki programa, 3.4 Podatkovni tipi v Javi, 3.5 Pogojni stavki v Javi, 3.6 Zanke v Javi
- LAV-RAČ4: še ni določeno


## Odločitve

- LAV-RAČ3 (8. 11. 2026): pravila za uvoz poglavij 3. letnika so v `TODO.md` (skupine teorije, »Ponavljanje«, naloge s programom v poljubnem okolju, brez omemb laboratorijskih vaj). Pri nalogah z izpisom ali programom portal hrani tudi vpisani izpis in kodo.
- Točkovanje (6. 11. 2026): naloge »Za doma« se ne točkujejo. Maturitetne naloge se točkujejo smiselno glede na nalogo, kot v maturitetnih polah.
- Letniki in stran Šolsko leto so samo za ta portal; LAV-ELS jih ne dobi (6. 11. 2026).
- Kopije baze (6. 11. 2026): skrbnik jih hrani na svojem računalniku, dokler jih sam ne izbriše; drugi do njih nimajo dostopa.
- Letniki (6. 11. 2026): `years` v `content/portal.json` poveže 2., 3. in 4. letnik z LAV-RAČ2, LAV-RAČ3 in LAV-RAČ4. Razred ima letnik, prejšnji letniki so lahko odprti za ponavljanje, ob koncu leta skrbnik naredi prehod na strani Šolsko leto (razdelka 3 in 8 načrta). Ob postavitvi letos: vsem razredom nastavi letnik, »vidi prejšnje letnike« pusti izklopljeno.
- Ime `LAV-RAČ`, `slug` `lavrac`, naslov `lavrac.sc-nm.si`. `slug` se po začetku uporabe ne spreminja.
- Prave uporabnike, bazo in registracijo v Entra ima portal svoje, z LAV-ELS si deli samo ogrodje.
- Artifacti se pri uvozu pretvorijo v pogodbo iz razdelka 5 načrta, jedro (`tracker.js`, `progress.js`) ostane nespremenjeno, da združitve iz `upstream` ostanejo čiste.
- Vaje LAV-ELS so v `test/fixtures/content`, ker na njih tečejo preizkusi ogrodja. `src/public/js/variants/` ostane iz istega razloga, dijakom se ne naloži, dokler vaja nima spremenljivih števil.

## Vaje iz artifactov

Artifact je vir vsebine, portal doda obliko in delovanje. Za vsako vajo:
- `content/sources/<id>.html`: artifact, kot je objavljen (prenesen z orodjem Artifact, nespremenjen),
- `content/adapters/<id>.js`: kako se artifact poveže z ogrodjem vaje (nekaj natančnih zamenjav v njegovi kodi, ikone skupin, barve); vsaka zamenjava mora najti svoje mesto, sicer uvoz javi napako,
- `content/sources.json`: seznam vaj, povezava na artifact in različica (`version`).

Skupna oblika vseh vaj je v `content/shell/` (`vaja.js`, `vaja.css`). `npm run import` iz tega zgradi `content/exercises/<id>.html` in `content/catalog.json`. Stran se med uvozom odpre v brskalniku z enako CSP kot v portalu.

Oblika vaje (dogovor 6. 11. 2026):
- vstopna stran Pregled s karticami skupin (ikona, razlage) in kartico Vaje,
- levo navigacija s poudarjenimi naslovi skupin in kljukico pri pregledanih razlagah, na telefonu izbirni seznam,
- levo pri vsakem sklopu vaj majhen krog kot tortni graf v barvah stanj (pravilno, z namigom, napačno, ogledana rešitev, še neodgovorjeno) in števec ob desnem robu; Za doma dobi kljukico, ko je odprt (dogovor 9. 11. 2026, velja za vse vaje, tudi nove),
- v levem stolpcu je oznaka (»A ·«, »1 ·«) v svojem stolpcu, pri prelomu se druga vrstica poravna z začetkom besedila, ne z oznako (dogovor 9. 11. 2026),
- Za doma ima naslednjo črko za zadnjim sklopom vaj (npr. A–E, nato F · Za doma); črke sklopov si sledijo brez vrzeli (dogovor 9. 11. 2026); črko za Za doma doda skupna oblika sama, uvoz pa se ustavi, če v črkah sklopov nastane vrzel,
- zgoraj vedno viden skupni napredek (naloge in točke, barvni trak),
- Vaje so zadnje poglavje in se odklenejo, ko dijak odpre vsako stran razlage (preveri tudi strežnik),
- v sklopu vaj ena naloga naenkrat, oštevilčeni gumbi v barvi stanja, »rešenih x / n«, legenda (desno poravnana, dogovor 9. 11. 2026), Prejšnja/Naslednja naloga,
- pod nalogo levo Preveri, desno obrobljena Namig (−50 %) in Prikaži rešitev (0 točk, z vprašanjem pred ogledom),
- naloge »Sam preveri« (10. 11. 2026, pravila v razdelku 4 načrta): gumb »Preveril sem«, brez točk, rešitev prosto; oznaka »Sam preveri · brez točk«, v seznamu gumbov in legendi svoja barva (modrozelena), v pregledu pravil vrstica »Sam preveri«. Naloga s programom izgubi polje za izpis, naloga z vpisom (3.2 sklop E) namesto polj kaže okvir »Pravilni rezultati za preverjanje«,
- besedilo razlag in nalog obojestransko poravnano z deljenjem besed,
- ozadje vaje je svetlo oranžno (#fffaf4), besedilo in gumbi v vijolični barvi portala,
- besedilo razlag in nalog sega čez vso širino vsebine; gumbi za listanje so majhni,
- naloga, ki je dijak ni izpolnil do konca ali je izraza ni mogoče prebrati, ni oddana (samo opozorilo); vsak drug odgovor jo zaklene, z razlago artifacta, zakaj je napačen (potrjeno 6. 11. 2026),
- Za doma so načeloma naloge brez točkovanja; točkovane naloge, ki jih ima artifact na strani za doma, postanejo svoj sklop med Vajami (2.3: sklop I Ponavljanje; v artifactu »Še več maturitetnih nalog«, preimenovan 8. 11. 2026, ker niso vse naloge iz mature),
- naloge z zbirnikom (2.3): Zaženi teste pokaže rezultate testov in se ne točkuje, Oddaj točkuje in zaklene, tudi če testi ne uspejo,
- skupine razlag: 2.1 Pretvorbe, Računanje, Kodiranje, Pariteta (iz artifacta); 2.2 Logična vrata, Funkcije in poenostavljanje, Aritmetična vezja; 2.3 Podatki in procesor, Zbirnik, Prekinitve in pomnilniki, Vhod, izhod in cevovod; 3.1 Jezik in prevajanje, Orodja, zagon in napake; 3.2 Algoritem in zapis, Gradniki in sled, Od diagrama do programa; 3.3 Program in podatki, Izpis in vnos, Računanje in potek programa; 3.4 Tipi in pretvorbe, Znaki in nizi, Operatorji,
- barve stanj so enake kot v učiteljevem pregledu: pravilno zeleno, pravilno z namigom jantarno, napačno rdeče, ogledana rešitev sivo.

Napisi v diagramih (10. 11. 2026): stikala »Napisi v diagramih« ni več. Diagrami imajo povsod napise iz mature (začetek, preberi, izpiši, konec), kot v teoriji; adapter v kodi artifacta namesto branja izbire iz brskalnika postavi `FLOW.setLang("sl")`, zato se izbira, ki jo je artifact nekoč shranil v brskalniku, ne upošteva.

Prilagoditve posameznih nalog (10. 11. 2026): adapter pred oštevilčenjem pokliče `LavRac.prepare(T, LEVELS, { ... })`. Naloge se imenujejo tako, kot jih vidi učitelj v artifactu: črka sklopa in mesto v njem (`C9`), prebrano pred odstranitvami, zato se imena ne premaknejo, ko se naloga odstrani; neznano ime ustavi uvoz. Možnosti: `self` (Sam preveri), `nobtn` (brez »Kopiraj kodo« in »Odpri Programiz«), `inline` (vrzeli `___` se vpišejo kar v kodo; število vrzeli mora biti enako številu polj), `same` (vsa polja v kodi enako široka), `cols` (polja v dveh stolpcih), `list` (vrstice `- …` v vprašanju postanejo seznam), `example` (rešen primer, rešitev odprta od začetka), `remove` (naloga se izloči, ostale se preštevilčijo). Za doma se imenuje z mestom v seznamu, številke (»D1.«) se računajo na novo. Nalogi z gumbom Kopiraj/Programiz, ki ji gumbov ne odvzameš, ju obdrži.

Ko se vsebina nalog spremeni tako, da se spremeni število ali vrstni red nalog, se `version` poveča (dijaki začnejo nov poskus): 3.1, 3.2 in 3.3 imajo od 10. 11. 2026 različico 2.

Ob vsakem uvozu novega poglavja preveri na zaslonu: levi stolpec (oznake, krogi, števci, zamik pri prelomu), legenda pod gumbi nalog in črko za Za doma; vse to dela skupna oblika vaje (`content/shell/`), v adapterju ni treba ničesar nastavljati.

Pri spremembi artifacta: prenesi novo različico v `content/sources/<id>.html`, popravi adapter, če kaka zamenjava ne najde več mesta, poženi `npm run import` in `npm test`. Če se spremeni vrstni red ali število nalog, povečaj `version` v `content/sources.json` (dijaki začnejo nov poskus).

## Vstopna stran

Sprednja plošča računalnika: ime portala v bajtih (Windows-1250, ker ima tam Č en bajt). Lučke so pravi biti, dijak jih prižiga in vidi znak in šestnajstiško vrednost. Barva loči zgornje in spodnje štiri bite, ker so štirje biti ena šestnajstiška števka.

## Postavitev

Entra, nova registracija aplikacije, en najemnik:
- Redirect URI (platforma Web): `https://lavrac.sc-nm.si/auth/callback` in `https://lavrac.sc-nm.si/`
- Certificates & secrets: nova skrivnost, zapiši rok veljavnosti
- Dovoljenja: samo `openid`, `profile`, `email`

Strežnik: DNS za `lavrac.sc-nm.si`, svoja mapa, `.env` iz `.env.example`, `APP_PORT=4001`, nginx v `ssl-proxy` na ta vrata s `X-Forwarded-Proto: https` in `client_max_body_size 200m;`. Profila `https` (Caddy) ne uporabi, če vrata 80 in 443 že uporablja `ssl-proxy`.
