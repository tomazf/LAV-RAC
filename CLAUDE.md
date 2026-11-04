# LAV-ELS

Portal z vajami, razredi in spremljanjem napredka (Node 22, Express 5, EJS, PostgreSQL 17, prijava Entra). Teče na `https://els.sc-nm.si`, dijaki ga uporabljajo, zato je vsaka sprememba živa.

**Najprej preberi `docs/NACRT_PORTALA.md`**: splošni dogovor (vloge, pravila, zasebnost, varnost, kopije, pogodba med vajo in portalom, postavitev). Natančno vedenje je v `test/`. Postopek postavitve in vzdrževanja je v `README.md`. Kar je splošno, drži tudi za druge portale iz tega ogrodja; kar je vezano na vsebino, je v razdelku 12 načrta.

## Dogovori pri delu

- Vse, kar vidi uporabnik, je slovensko. Komentarji v kodi in sporočila commitov so angleški.
- Ime in besedila portala so v `content/portal.json`, ne v kodi. `slug` se po začetku uporabe ne spreminja.
- Strežnik odloča o točkah, zaklepanju in dostopu; brskalniku se ne zaupa.
- Skripte portala so samo iz strežnika (stroga CSP, brez vgrajenih skript). Vaje (`/vaje/*`) smejo imeti vgrajeno kodo.
- Razrede in vloge učiteljev določa samo skrbnik. Učitelj se razredu pridruži sam, izpisa ni.
- Seznami oseb so v slovenski abecedi (`byName`, `bySurname` v `src/format.js`), ne po vrstnem redu baze.
- Brisanje uporabnika je trajno in ostane tudi po obnovi kopije (`erased_users`).
- Sprememba, ki jo vidi uporabnik, dobi preizkus. Preden se kaj objavi: `npm test` (potrebuje `TEST_DATABASE_URL`, ki se izbriše, in `pg_dump` iste različice kot baza).
- Ko je pri delu na čem treba odločiti, kar ni zapisano, najprej poročaj, nato spreminjaj. Nov dogovor se zapiše v `docs/NACRT_PORTALA.md`.
