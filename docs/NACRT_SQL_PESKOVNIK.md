# Načrt: SQL peskovnik (4. letnik)

Stanje: potrjeno 26. 11. 2026 (odgovori v razdelku 11); fazi 1 in 2 sta narejeni (razdelek 12), faza 3 je narejena za 4.4 in 4.5 (gumbi, 26. 11. 2026); stranska plošča v vaji se ne dela (dva zavihka ob strani), 4.6 dobi gumbe z vnosom `sandbox`, ko bo uvožena. Dogovori so povzeti v `docs/NACRT_PORTALA.md`.

## 1. Namen

Dijaki 4. letnika (4.4 DDL, 4.5 poizvedbe, 4.6 DML) pišejo SQL in ga izvedejo na pravem strežniku **kar v portalu**, v šoli in doma, brez VPN. Portal je posrednik: dijak je prijavljen z Entra, portal stavke pošlje na ločen strežnik MySQL/MariaDB z dijakovim računom in vrne rezultat. V šoli lahko dijak z istim računom dela tudi v MySQL Workbenchu (ER, oblikovanje).

- Peskovnik je za vajo, ne za ocenjevanje (kot ves portal).
- Strežnika SQL ne vidi internet. Portal ga doseže po omrežju, šolske učilnice po potrebi za Workbench.
- Dijak podatkov za dostop v portal ne vpisuje: portal ve, katera baza je njegova.

## 2. Vloge

| Vloga | Kaj lahko |
|---|---|
| Skrbnik | **edini** vpiše strežnik SQL (naslov, vrata, skrbniški račun, TLS) in omejitve; uvozi skupne baze; vidi vse baze vseh razredov (velikost, zadnja uporaba), lahko vse kot učitelj; vidi in počisti »osirotele« baze (na strežniku so, v portalu nimajo dijaka) |
| Učitelj | v **svojih razredih 4. letnika**: ustvari baze (vsem ali izbranim dijakom), ponastavi bazo (prazna ali iz predloge), ponastavi geslo, izbriše bazo; vidi samo »semafor« uporabe (razdelek 7), ne sheme, podatkov ali zgodovine; ima svojo bazo za preizkušanje |
| Dijak 4. letnika | uporablja svojo bazo in skupne baze samo za branje; vidi svoje podatke za Workbench (strežnik, vrata, ime baze, uporabnik, geslo); sam ponastavi svojo bazo; edini vidi svojo zgodovino zagonov |
| Nadzorni, drugi letniki | peskovnika ne vidijo |

Peskovnik se pokaže samo razredom z letnikom 4 (iz `content/portal.json`, `years`) in samo, ko je strežnik v nastavitvah in povezava deluje.

## 3. Baze

1. **Dve osebni bazi** vsakega dijaka (in učitelja), en račun (dogovor 28. 11. 2026): račun `lr_u<id>` z `ALL` samo na obe bazi, brez globalnih pravic in brez `GRANT OPTION`. Baza `lr_u<id>_4_4` (cilj `moja`, »Moja baza (4.4)«) je za poglavje 4.4, baza `lr_u<id>_4_6` (cilj `moja6`, »Moja baza za poglavje 6 (4.6)«) za poglavje 4.6, da ponastavitev na K0 ne uniči dela iz 4.4. Imena so brez pik (pika bi zahtevala obrnjene narekovaje povsod). Vsaka baza ima svojo omejitev velikosti (`size_bytes`, `size_bytes6`). Strežnik SQL ob uvedbi dveh baz še ni bil postavljen, zato starih računov z eno bazo ni in nadgradnje ni (dogovor 28. 11. 2026).
2. **Skupne baze samo za branje**: `lr_skupno_sola`, `lr_skupno_matura` (iz `src/public/sola.sql` in `matura_baze.sql`). En uporabnik `lr_bralec` s `SELECT`. Za 4.5. Nihče jih ne more spremeniti; skrbnik jih po potrebi znova uvozi.
3. **Predloge** za ponastavitev osebne baze: prazna, `sola_struktura.sql`, `sola_struktura.sql` + `sola_zacetni_podatki.sql` (iz 4.4), za poglavje 6 prazna in K0 do K6. Vsaka predloga pripada eni bazi (`db: 'moja'` ali `'moja6'`) in ponastavi samo njo. Seznam predlog je v kodi; skrbnik jih ne nalaga sam (manj napak).

Predpona `lr_` je nastavitev (privzeto `lr_`) in se po začetku uporabe ne spreminja. Portal nikoli ne dela z bazo ali uporabnikom brez predpone.

## 4. Strežnik SQL

**Izbira (odloči učitelj):** za maturo izbira ni pomembna (vse, kar zahteva, deluje v obeh). Priporočam **MySQL 8.4 LTS**, ker so gradiva (4.4 B11, razlaga 6) in Workbench vezani na MySQL; Workbench ob povezavi na MariaDB opozori na nepodprt strežnik. MariaDB 10.11 ali 11.4 deluje enako dobro s strani portala (isti gonilnik, `mysql2`); ima uporabniško omejitev `MAX_STATEMENT_TIME`, ki je MySQL nima, a portal čas omeji sam (razdelek 6), zato to ni odločilno. »Preizkusi povezavo« pokaže različico.

Priprava strežnika (pošljem točne ukaze ob izvedbi):

- `bind-address` na naslov v šolskem omrežju; požarni zid: 3306 samo z IP portala in iz učilnic (za Workbench). Nikoli z interneta.
- TLS (strežnik ima certifikat); skrbniški račun portala `REQUIRE SSL`.
- `local_infile=0`, `utf8mb4` in slovenska kolacija (`utf8mb4_sl_0900_ai_ci` v MySQL, `utf8mb4_slovenian_ci` v MariaDB), `max_connections` z rezervo (npr. 300).
- Skrbniški račun portala (ne root):

```sql
CREATE USER 'lavrac'@'<IP portala>' IDENTIFIED BY '<geslo>' REQUIRE SSL;
GRANT CREATE USER ON *.* TO 'lavrac'@'<IP portala>';
GRANT ALL PRIVILEGES ON `lr\_%`.* TO 'lavrac'@'<IP portala>' WITH GRANT OPTION;
```

Pomembno: pravica `CREATE USER` v MySQL in MariaDB ni omejena na predpono (z njo je mogoče spremeniti ali izbrisati tudi druge račune). Zato je strežnik namenjen samo temu, root je dosegljiv samo lokalno (`unix_socket`/`auth_socket`), skrbniški račun je samo v portalu.

## 5. Nastavitve (Administracija > SQL, samo skrbnik)

- Naslov, vrata, skrbniški uporabnik in geslo, TLS (vklopljen privzeto; po želji CA certifikat). Geslo se v obrazcu nikoli ne pokaže nazaj (»spremeni geslo«).
- Predpona, omejitve: čas izvajanja (privzeto 5 s), največ vrstic v izpisu (500), največja velikost osebne baze (20 MB), največja dolžina skripta (64 kB), zagonov na minuto (30).
- **Preizkusi povezavo**: poveže se, pokaže različico, preveri pravice (ustvari in izbriše poskusno bazo `lr__preizkus`).
- **Skupne baze**: stanje (uvožena, kdaj, velikost), gumb »Uvozi znova«.
- **Pregled**: vse osebne baze po letnikih in razredih (velikost, zadnja uporaba), osirotele baze z gumbom »Izbriši«.

Gesla (skrbniško, dijakov, bralca) so v bazi portala šifrirana (AES-256-GCM) s ključem `SQL_KEY` iz `.env` (32 bajtov, base64). Brez `SQL_KEY` je razdelek SQL skrit. Ključ **ni del kopije** (kot ves `.env`): kdor obnovi kopijo na drugem strežniku, potrebuje isti ključ, sicer mora skrbnik vpisati strežnik znova in učitelji ponastaviti gesla.

## 6. Izvajanje (`POST /api/sql/run`)

- Samo prijavljen dijak razreda 4. letnika (ali učitelj, skrbnik) z obstoječo bazo; CSRF; omejitev zagonov na minuto.
- Izbira baze: »Moja baza« (dijakov račun) ali skupna baza (račun `lr_bralec`). Druge baze ni mogoče izbrati; pravice to zagotovi tudi strežnik SQL.
- Vsak zagon je **nova povezava** (`multipleStatements`), ki se po zagonu zapre. Spremenljivke `@x`, začasne tabele in odprte transakcije zato ne ostanejo do naslednjega zagona; to piše pod urejevalnikom. `DELIMITER` je ukaz Workbencha, ne strežnika: portal ga prepozna in pove, da v peskovniku ni potreben.
- Časovna omejitev: portal ob izteku z drugo povezavo pošlje `KILL QUERY` (deluje za vse stavke, v MySQL in MariaDB); dodatno `SET SESSION max_execution_time` oziroma `max_statement_time`.
- Rezultat se bere po vrsticah in se ustavi pri omejitvi (»prikazanih prvih 500 vrstic«), zato velik izpis ne obremeni portala.
- Velikost baze se preveri po zagonu (`information_schema`). Nad omejitvijo portal dovoli samo `DELETE`, `DROP`, `TRUNCATE` in ponastavitev, dokler se baza ne zmanjša.
- Odgovor: za vsak stavek posebej vrsta (rezultat, število spremenjenih vrstic, opozorila) in čas; ob napaki koda in sporočilo strežnika ter številka stavka in vrstica v urejevalniku, kjer jo je mogoče določiti.

## 7. Vmesnik

**Stran »SQL peskovnik«** (meni, samo 4. letnik):

```
┌───────────────┬────────────────────────────────────────────────┐
│ Baza [Moja ▾] │  ▶ Zaženi (Ctrl+Enter)  ▶ Izbrano  Shrani poizvedbo  Zgodovina poizvedb  │
│               │ ┌────────────────────────────────────────────┐ │
│ ▾ Tabele      │ │ 1  SELECT ime, priimek                     │ │
│   ▸ dijak     │ │ 2  FROM dijak d JOIN razred r ON …         │ │
│   ▸ razred    │ └────────────────────────────────────────────┘ │
│               │ [1 · 24 vrstic · 3 ms] [2 · 1 spremenjena]     │
│ ⊞ ER diagram  │ ┌────────────────────────────────────────────┐ │
│ ⟲ Ponastavi   │ │ tabela z rezultatom / napaka               │ │
│ 🔑 Workbench  │ └────────────────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────┘
```

- **Urejevalnik CodeMirror 6** z barvanjem SQL (dialekt MySQL), številkami vrstic, oklepaji, zamikom in **dopolnjevanjem** imen tabel in stolpcev izbrane baze. Knjižnica je zapakirana v repozitoriju (`src/public/js/vendor/`, ena datoteka, zgrajena s skriptom iz `devDependencies`), brez CDN, skladno s CSP. Naloži se samo na strani peskovnika. Barve sledijo temi »Prikaz« (svetla, temna, visok kontrast). Izjema od dogovora 18. 11. 2026 (brez barvanja v vnosnem polju): tu je urejevalnik glavni del strani.
- **Zaženi** izvede vse, **Izbrano** samo označeno; Ctrl+Enter, Ctrl+Shift+Enter.
- **Rezultati**: zavihek za vsak stavek; tabela s stalno glavo, številke desno, `NULL` označen, dolge vrednosti skrajšane z ogledom ob kliku; kopiranje in prenos CSV.
- **Napake**: rdeč okvir s kodo in sporočilom strežnika, vrstica je označena v urejevalniku; pod njo kratek slovenski namig za najpogostejše kode (1064 skladnja, 1146 ni tabele, 1054 ni stolpca, 1062 podvojen ključ, 1451/1452 tuji ključ).
- **Drevo tabel** (levo): tabele s številom vrstic; razširitev pokaže stolpce, tipe, PK, FK, NULL; klik vstavi ime v urejevalnik. Osveži se po vsakem zagonu, ki spremeni shemo.
- **ER diagram** osebne baze, narisan iz `information_schema` (lastna koda, SVG, brez knjižnice): tabele, ključi, povezave; premikanje, povečava, prenos SVG. Poveže 4.3 s 4.4.
- **Shrani poizvedbo**: dijak shrani poizvedbo z imenom (na strežniku portala, do 50), da doma nadaljuje. Zadnje stanje urejevalnika se shrani samodejno. **Zgodovina poizvedb**: zadnjih 100 zagonov z izidom.
- **Urejevalnik** (dogovor 28. 11. 2026): privzeta višina je 6 vrstic (dijak jo povečuje z ročko). Izbira z Shift in puščicami je vidna (označena vrstica je prosojna). Samodejno dopolnjevanje (CodeMirror) ponuja ključne besede, tabele izbrane baze (po `FROM`/`JOIN`) in stolpce (po `tabela.` ali vzdevku; tip in PK/UQ); Ctrl+preslednica ga odpre sam. Gumbi podoken so desno, glavno dejanje skrajno desno; ikone so lastne vgrajene SVG (brez pisave ikon in CDN).
- **Ponastavi bazo** (brez `matura_baze.sql` in `sola.sql`: skupni bazi sta za branje, naslovi ne kažejo imen datotek): izbira predloge (skupine »Moja baza (4.4)« in »Moja baza za poglavje 6 (4.6)«) in potrditev; ponastavi se samo baza, ki ji predloga pripada.
- **Katera baza**: izbira baze je v glavi in vsebuje pravo ime (»Moja baza za poglavje 6 (4.6): lr_u57_4_6«); nad urejevalnikom je stalna oznaka »Stavki se izvedejo v bazi …«. Gumb »Odpri v peskovniku« v poglavju izbere bazo poglavja sam (`USE` ni potreben).
- **Certifikat CA za Workbench**: če je v nastavitvah strežnika vnesen CA, okno »Podatki za Workbench« ponudi `ca.pem` (pot `/sql/ca.pem`, ista vsebina kot polje `ca`, brez ključa, za vse z dostopom do peskovnika) in navodilo: zavihek SSL, `Require and Verify CA`, datoteka CA; `Verify Identity` se ne priporoča, ker je certifikat samopodpisan. Brez CA, a s TLS, velja navodilo `Require`. Portal sam CA uporablja za svoje povezave (`rejectUnauthorized`), ime v certifikatu mora ustrezati vpisanemu strežniku (SAN).
- **Moj račun in pravice**: opis (kaj lahko dijak) in zapis pravic v SQL (`GRANT …`); podatki za Workbench vsebujejo obe imeni baz.
- Zgodovina zagonov je vidna samo dijaku (dogovor 26. 11. 2026).
- **Workbench**: okno s strežnikom, vrati, uporabnikom in geslom (gumb Kopiraj) ter kratkim navodilom za novo povezavo.
- Telefon: urejevalnik, rezultat in drevo drug pod drugim; drevo je zložljivo.

**V poglavjih** (faza 3, narejeno 26. 11. 2026 za 4.4 in 4.5): v glavi vaje ikona »SQL peskovnik« in pod vsakim blokom s celotnim stavkom SQL gumb »Odpri v peskovniku«; oboje se odpre v svojem zavihku (isto okno ob vsakem kliku), da dijak vzporedno gleda nalogo in peskovnik. Koda se prenese, baza je dijakova (4.4) ali skupna (4.5: `sola`, v sklopih E–G `matura`). Stranske plošče v vaji ni (odločitev učitelja 26. 11. 2026: nov zavihek je dovolj in ne potrebuje spremembe CSP). Naloge ostanejo »Sam preveri« po dogovorih 21. 11. 2026.

**Učitelj**, pri razredu 4. letnika zavihek »SQL baze«: dijaki v slovenski abecedi in **semafor** (dogovor 26. 11. 2026): zelena = zagon v zadnjih 7 dneh, rumena = baza je bila uporabljena, a ne v zadnjih 7 dneh, siva = še ni uporabljena, brez pike = baze ni; ob piki datum zadnje uporabe. Sheme, podatkov in zagonov dijaka učitelj ne vidi. Geslo dijaka učitelj vidi samo takoj po ponastavitvi (da ga lahko pove dijaku); gumbi »Ustvari vsem, ki je nimajo«, pri dijaku Ponastavi bazo, Ponastavi geslo, Izbriši; vsako dejanje v dnevnik (brez gesel).

## 7a. Preizkus, statistika in stanje za učitelja (dogovor 28. 11. 2026)

- **Celoten preizkus** (Administracija > SQL, gumb »Celoten preizkus«, samo skrbnik): začasen račun `lr_u0` (id 0, nikoli pravi uporabnik) z bazama `lr_u0_4_4` in `lr_u0_4_6`. Preizkusi: skrbniška povezava in TLS; ustvarjanje računa in obeh baz; pisanje in branje v vsaki (tudi šumniki); ponastavitev na predlogo (struktura šolske baze in K0); račun vidi samo svoji bazi in ne more ustvarjati baz, brati sistemskih baz ali dajati pravic; nastavitev časa stavka in omejitev povezav (največ `connections` povezav, naslednja je zavrnjena); skupni bazi se berejo, pisanje je zavrnjeno. Na koncu se račun in bazi izbrišejo (tudi ob napaki). Izid je tabela po korakih (v redu, napaka, preskočeno); zadnji čas in izid sta v `sql_server.selftest_at/selftest_ok`. Pravih računov se ne dotakne.
- **Statistika uporabe** (samo skrbnik, isti pogled): zagoni, zagoni z napako in povprečni čas po dnevih (14 dni), zagoni po bazi (7 dni), aktivni ljudje na dan, računi (aktivni, neuporabljeni), skupna velikost, največja baza, baze nad omejitvijo, čakalna vrsta za brisanje. Samo števila (tabeli `sql_daily`, `sql_daily_users`, migracija 020), brez besedila stavkov; hrani se 90 dni; zapisi o aktivnosti se izbrišejo z uporabnikom.
- **Stanje za učitelja** (na strani »SQL baze« razreda): pet vrstic z lučkami: povezava s strežnikom je bila preizkušena, celoten preizkus (datum in izid), skupni bazi sta uvoženi, koliko dijakov ima bazi, povezava na lastni bazi za preizkus kot dijak. Brez imen strežnika, računov in drugih podrobnosti; gumba za preizkus učitelj nima (potrebuje skrbniške pravice).

## 8. Podatki v portalu (migracija 017)

- `sql_server`: ena vrstica z nastavitvami, šifrirano skrbniško geslo, omejitve, stanje skupnih baz.
- `sql_accounts`: `user_id`, imeni obeh baz (`db_name` = 4.4, `db_name6` = 4.6, migracija 019), uporabnik, šifrirano geslo, kdaj in kdo ustvaril, zadnja uporaba, velikosti (`size_bytes`, `size_bytes6`).
- `sql_scripts`: shranjeni skripti dijaka (ime, besedilo, čas).
- `sql_history`: zadnjih 100 zagonov na uporabnika (skrajšano besedilo, izid, čas, število vrstic).

Vse se izbriše z uporabnikom; pri izbrisu uporabnika in ob zaključku šolskega leta (izbris 4. letnika) portal izbriše tudi bazo in uporabnika na strežniku SQL. Če strežnik takrat ni dosegljiv, ostane v seznamu osirotelih baz za skrbnika. Tabele so del kopij in opisane na strani »Kateri podatki se beležijo« (skripti in zgodovina SQL).

## 9. Varnost (povzetek)

- Strežnik SQL ni dosegljiv z interneta; promet portal–strežnik je šifriran (TLS).
- Dijak ima pravice samo na svojo bazo; skupne baze samo `SELECT`; brez `FILE`, `SUPER`, `PROCESS`, `GRANT OPTION`; `local_infile` izklopljen.
- Omejitve: čas (KILL), vrstice, velikost baze, dolžina skripta, zagoni na minuto, `MAX_USER_CONNECTIONS` (npr. 5) pri vsakem računu.
- Gesla šifrirana s `SQL_KEY`; v dnevniku in odgovorih API nikoli gesel.
- Portal nikoli ne vstavi dijakovega besedila v svoje ukaze; skrbniški ukazi (ustvari, izbriši) uporabljajo samo imena, ki jih sestavi portal (`lr_u<id>`).

## 10. Faze

1. **Strežnik in baze**: nastavitve skrbnika, šifriranje, ustvarjanje in brisanje baz (učitelj, skrbnik), skupne baze, stran dijaka s podatki za Workbench, brisanje ob izbrisu uporabnika in ob koncu leta. Preizkusi z MariaDB ali MySQL v CI (dodatna storitev; podaljša CI za približno minuto).
2. **Peskovnik**: stran z urejevalnikom, izvajanje, rezultati, napake, drevo tabel, skripti, zgodovina, ponastavitev.
3. **Poglavja**: »Odpri v peskovniku« v 4.4 in 4.5 (narejeno 26. 11. 2026; 4.6 z vnosom `sandbox` v `content/sources.json`, ko bo uvožena); ER diagram je že v peskovniku.
4. **Za naprej** (ni v tem načrtu): samodejno preverjanje nalog 4.5 s primerjavo rezultata z referenčno poizvedbo na skupni bazi (vrstni red stolpcev in vrstic, ORDER BY, podvojene vrstice), da bi del nalog »Sam preveri« postal točkovan.

Vsaka faza je svoj commit (ali nekaj commitov) s preizkusi; pred vsako vprašam, katere preizkuse poženem, in opomnim na CI.

## 11. Odgovori učitelja (26. 11. 2026)

1. MySQL ali MariaDB: za maturo ni pomembno (raven zahtev je v obeh enaka: DDL, omejitve, SELECT z JOIN, GROUP BY, podpoizvedbe, UNION/INTERSECT/EXCEPT, DML). Priporočilo ostane MySQL 8.4 LTS zaradi Workbencha in razlag v 4.4; končna izbira je pri učitelju ob postavitvi strežnika, portal podpira oba.
2. Dijak vidi strežnik, vrata, ime baze, uporabnika in geslo, da nastavi MySQL Workbench.
3. Učitelj vidi samo semafor uporabe (razdelek 7), ne sheme ali podatkov.
4. Zgodovina zagonov je vidna samo dijaku.
5. Omrežje (požarni zid, dostop iz učilnic za Workbench) uredi učitelj sam.

## 12. Izvedba (26. 11. 2026)

- Strežnik: **MySQL 8.4 LTS** (odločitev učitelja). Preizkušeno z MySQL 8.0 lokalno, CI uporablja `mysql:8.4`. MariaDB portal podpira (kolacija in časovna omejitev se izbereta po različici), a ni preizkušena.
- Koda: `src/sqlbox.js` (šifriranje, nastavitve, računi, izvajanje, shema), `src/sqlsplit.js` (deli skript na stavke in pozna vrstice), `src/routes/sql.js` (skrbnik, učitelj, peskovnik, API), pogledi `src/views/admin/sql.ejs`, `src/views/teacher/sql.ejs`, `src/views/sql/sandbox.ejs`, `src/public/js/sqlbox.js`, `src/public/css/sqlbox.css`, migracija `017_sqlbox.sql`. Letniki s peskovnikom so v `content/portal.json` (`sqlYears`, privzeto `[4]`).
- Urejevalnik: CodeMirror 6, zapakiran z esbuild v `src/public/js/vendor/sqleditor.js` (vir `scripts/editor/entry.js`, gradnja `npm run build:editor`; datoteka je v repozitoriju, slika Docker ne potrebuje esbuild). Urejevalnik piše svoje sloge v element `<style>`, zato ima stran `/sql` svoj CSP z enkratnim `nonce` samo za sloge (skripte ostanejo samo s strežnika).
- Stavki se izvajajo **eden za drugim** na eni povezavi (ne `multipleStatements`), zato ima vsak svoj rezultat, napaka pove svoj stavek in vrstico (`at line N` v sporočilu MySQL se prišteje vrstici, kjer se stavek začne), izvajanje se ustavi pri prvi napaki (kot Workbench).
- Časovna omejitev: `max_execution_time` v seji (velja za SELECT) in `KILL QUERY` z drugo povezavo **istega** računa ob izteku (račun sme ustaviti svoje stavke brez dodatnih pravic). SELECT, ki doseže omejitev, vrne, kar je imel, z opozorilom.
- Izpis: vrstice se berejo sproti, nad omejitvijo se ne hranijo (število vseh se šteje).
- Pravice v GRANT: podčrtaj v imenu baze je nadomestni znak, zato portal ime v GRANT zapiše z `\_` (`lr\_u12`), sicer ga skrbnikova pravica na `lr\_%` ne pokrije.
- Izbris uporabnika: `eraseUser` v isti transakciji zapiše bazo v `sql_drop_queue`; portal jo izbriše na strežniku MySQL čez nekaj sekund oziroma ob naslednjem poskusu (vsakih 5 minut, ob odprtju strani SQL). Pri zaključku šolskega leta se baze 4. letnika izbrišejo po potrditvi prehoda.
- Povezava iz vaje (za fazo 3): `/sql#koda=<base64url>&baza=sola` doda kodo pod vsebino urejevalnika in izbere bazo. Gumbi v poglavjih (26. 11. 2026): `sandbox` v `content/sources.json` (`db`, po želji `sets`) gre v `catalog.json`; `src/routes/exercises.js` ga pošlje glavi samo uporabniku s `user.sqlOn`; `src/public/js/hdr.js` doda ikono v glavi in gumb pod `pre.code`, ki se začne s stavkom SQL (poznejše strani opazuje `MutationObserver`). Koda je v povezavi kot `base64url`, okno se imenuje `lavrac-sql`, zato ga naslednji klik uporabi znova (`hashchange` v `sqlbox.js` doda kodo). Preizkus: `test/sqlhdr.test.js`.
- Preizkusi: `test/sqlsplit.test.js` (brez baze), `test/sqlbox.test.js` (PostgreSQL, MySQL, brskalnik; brez `TEST_MYSQL_URL` se preskoči).
