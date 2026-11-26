# Načrt: SQL peskovnik (4. letnik)

Stanje: **predlog za potrditev** (26. 11. 2026), odprta vprašanja odgovorjena isti dan (razdelek 11). Nič od tega še ni narejeno. Ko učitelj potrdi, se dogovori prenesejo v `docs/NACRT_PORTALA.md`, delo pa gre po fazah (razdelek 10).

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

1. **Osebna baza** vsakega dijaka (in učitelja): baza `lr_u<id>`, uporabnik `lr_u<id>` z `ALL` samo na svojo bazo, brez globalnih pravic. Za 4.4 in 4.6.
2. **Skupne baze samo za branje**: `lr_skupno_sola`, `lr_skupno_matura` (iz `src/public/sola.sql` in `matura_baze.sql`). En uporabnik `lr_bralec` s `SELECT`. Za 4.5. Nihče jih ne more spremeniti; skrbnik jih po potrebi znova uvozi.
3. **Predloge** za ponastavitev osebne baze: prazna, `sola_struktura.sql`, `sola_struktura.sql` + `sola_zacetni_podatki.sql` (iz 4.4). Seznam predlog je v kodi; skrbnik jih ne nalaga sam (manj napak).

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
│ Baza [Moja ▾] │  ▶ Zaženi (Ctrl+Enter)  ▶ Izbrano  Skripti ▾  │
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
- **Skripti**: dijak shrani skript z imenom (na strežniku portala, do 50 skriptov), da doma nadaljuje. Zadnje stanje urejevalnika se shrani samodejno. **Zgodovina** zadnjih 100 zagonov z izidom.
- **Ponastavi mojo bazo**: izbira predloge in potrditev.
- Zgodovina zagonov je vidna samo dijaku (dogovor 26. 11. 2026).
- **Workbench**: okno s strežnikom, vrati, uporabnikom in geslom (gumb Kopiraj) ter kratkim navodilom za novo povezavo.
- Telefon: urejevalnik, rezultat in drevo drug pod drugim; drevo je zložljivo.

**V poglavjih** (faza 3): ob primerih in nalogah s SQL v 4.4, 4.5 in 4.6 gumb »Odpri v peskovniku« (koda se prenese, pri 4.5 se izbere skupna baza) in stranska plošča v vaji za delo ob branju. Naloge ostanejo »Sam preveri« po dogovorih 21. 11. 2026.

**Učitelj**, pri razredu 4. letnika zavihek »SQL baze«: dijaki v slovenski abecedi in **semafor** (dogovor 26. 11. 2026): zelena = zagon v zadnjih 7 dneh, rumena = baza je bila uporabljena, a ne v zadnjih 7 dneh, siva = še ni uporabljena, brez pike = baze ni; ob piki datum zadnje uporabe. Sheme, podatkov in zagonov dijaka učitelj ne vidi. Geslo dijaka učitelj vidi samo takoj po ponastavitvi (da ga lahko pove dijaku); gumbi »Ustvari vsem, ki je nimajo«, pri dijaku Ponastavi bazo, Ponastavi geslo, Izbriši; vsako dejanje v dnevnik (brez gesel).

## 8. Podatki v portalu (migracija 017)

- `sql_server`: ena vrstica z nastavitvami, šifrirano skrbniško geslo, omejitve, stanje skupnih baz.
- `sql_accounts`: `user_id`, ime baze in uporabnika, šifrirano geslo, kdaj in kdo ustvaril, zadnja uporaba, velikost.
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
3. **Poglavja**: »Odpri v peskovniku« in stranska plošča v 4.4, 4.5 in 4.6; ER diagram.
4. **Za naprej** (ni v tem načrtu): samodejno preverjanje nalog 4.5 s primerjavo rezultata z referenčno poizvedbo na skupni bazi (vrstni red stolpcev in vrstic, ORDER BY, podvojene vrstice), da bi del nalog »Sam preveri« postal točkovan.

Vsaka faza je svoj commit (ali nekaj commitov) s preizkusi; pred vsako vprašam, katere preizkuse poženem, in opomnim na CI.

## 11. Odgovori učitelja (26. 11. 2026)

1. MySQL ali MariaDB: za maturo ni pomembno (raven zahtev je v obeh enaka: DDL, omejitve, SELECT z JOIN, GROUP BY, podpoizvedbe, UNION/INTERSECT/EXCEPT, DML). Priporočilo ostane MySQL 8.4 LTS zaradi Workbencha in razlag v 4.4; končna izbira je pri učitelju ob postavitvi strežnika, portal podpira oba.
2. Dijak vidi strežnik, vrata, ime baze, uporabnika in geslo, da nastavi MySQL Workbench.
3. Učitelj vidi samo semafor uporabe (razdelek 7), ne sheme ali podatkov.
4. Zgodovina zagonov je vidna samo dijaku.
5. Omrežje (požarni zid, dostop iz učilnic za Workbench) uredi učitelj sam.
