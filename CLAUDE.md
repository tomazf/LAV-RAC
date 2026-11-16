# LAV-RAČ

Portal z laboratorijskimi vajami iz računalništva za 2., 3. in 4. letnik Tehniške gimnazije (Node 22, Express 5, EJS, PostgreSQL 17, prijava Entra). Bo na `https://lavrac.sc-nm.si`. Ogrodje prihaja iz LAV-ELS (`upstream`). Stanje in posebnosti tega portala so v `docs/LAV-RAC.md`.

**Najprej preberi `docs/NACRT_PORTALA.md`**: splošni dogovor (vloge, pravila, zasebnost, varnost, kopije, pogodba med vajo in portalom, postavitev). Natančno vedenje je v `test/`. Postopek postavitve in vzdrževanja je v `README.md`. Kar je splošno, drži tudi za druge portale iz tega ogrodja; kar je vezano na vsebino, je v razdelku 12 načrta.

## Dogovori pri delu

- Vse, kar vidi uporabnik, je slovensko. Komentarji v kodi in sporočila commitov so angleški.
- Ime in besedila portala so v `content/portal.json`, ne v kodi. `slug` se po začetku uporabe ne spreminja.
- Strežnik odloča o točkah, zaklepanju in dostopu; brskalniku se ne zaupa.
- Skripte portala so samo iz strežnika (stroga CSP, brez vgrajenih skript). Vaje (`/vaje/*`) smejo imeti vgrajeno kodo.
- Razrede in vloge učiteljev določa samo skrbnik. Učitelj se razredu pridruži sam, izpisa ni.
- Seznami oseb so v slovenski abecedi (`byName`, `bySurname` v `src/format.js`), ne po vrstnem redu baze.
- Brisanje uporabnika je trajno in ostane tudi po obnovi kopije (`erased_users`).
- Sprememba, ki jo vidi uporabnik, dobi preizkus. Pred objavo se poženejo samo preizkusi, ki jih sprememba zadeva (`node --test --test-name-pattern='…' test/content.test.js`). Celotnega `npm test` ne zaganjaj brez izrecnega dovoljenja uporabnika (traja dolgo; potrebuje `TEST_DATABASE_URL`, ki se izbriše, in `pg_dump` iste različice kot baza). Pri spremembi skupne kode (`src/`, `content/shell/`, `content/portal.json`, skupni izgled) in pri dodajanju ali odstranjevanju vaje ali dela najprej vprašaj in priporoči, kaj je smiselno. CI požene vse ob objavi; rezultat se pogleda po objavi, brez čakanja (dogovor 17. 11. 2026).
- Dodajanje in dopolnjevanje poglavij: `docs/DODAJANJE_POGLAVIJ.md`. Stanje poglavij in seznam čakajočih: `docs/LAV-RAC.md`, razdelek Stanje.
- Ko je pri delu na čem treba odločiti, kar ni zapisano, najprej poročaj, nato spreminjaj. Nov dogovor se zapiše v `docs/NACRT_PORTALA.md`.
