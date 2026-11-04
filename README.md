# LAV-ELS

Portal za laboratorijske vaje iz digitalne elektronike. Poveže 9 vaj (1.1 do 3.3, skupaj 266 nalog), dijakom shranjuje napredek, učiteljem pokaže, kako razred napreduje. Rezultati so za vajo in spremljanje, ne za ocenjevanje, ker se točkovanje izvaja v brskalniku.

Portal teče na [els.sc-nm.si](https://els.sc-nm.si) in ga dijaki že uporabljajo.

## Vloge

| Vloga | Kako jo dobi | Kaj lahko |
|---|---|---|
| Skrbnik | uporabniško ime v `ADMIN_EMAILS` | ustvarja, preimenuje in briše razrede, določa učitelje in jih dodeljuje razredom, briše uporabnike, vidi dnevnik dejanj, lahko dela vse kot učitelj v vsakem razredu |
| Učitelj | določi ga skrbnik | se pridruži razredom (iz razreda ga lahko odstrani samo skrbnik), v svojih razredih dodaja in odstranjuje dijake, izbira odprte vaje in vrstni red, vidi rezultate in dijake brez razreda, ponastavi vajo dijaku ali celemu razredu, izvozi rezultate v CSV |
| Dijak | učitelj ali skrbnik ga doda v en razred | rešuje odprte vaje, vidi svoj napredek, sam ponastavi vajo (učitelj to vidi) in piše svoje zasebne opombe. Razreda ne more zapustiti sam |
| Brez razreda | vsak nov ali odstranjen uporabnik | vidi samo obvestilo, da čaka na razred |

## Hitri predogled brez Microsoftovega računa

```bash
docker compose -f docker-compose.demo.yml up --build
```

Odpri http://localhost:4000 in izberi preizkusnega uporabnika. Skrbnik je Sara Skrbnik. Podatki se izbrišejo z `docker compose -f docker-compose.demo.yml down`.

## Postavitev

Potrebuješ strežnik z Dockerjem in Docker Compose, domeno in pravice za registracijo aplikacije v Entra.

### 1. Registracija aplikacije v Entra

V [Microsoft Entra](https://entra.microsoft.com): **App registrations > New registration**.

- **Supported account types**: Accounts in this organizational directory only (single tenant).
- **Redirect URI**: platforma Web, `https://TVOJA-DOMENA/auth/callback`. Pod **Authentication** dodaj še `https://TVOJA-DOMENA/`, da se dijak po odjavi vrne na portal.
- Pod **Certificates & secrets** ustvari skrivnost in si zapiši rok veljavnosti.
- Zapiši **Directory (tenant) ID**, **Application (client) ID** in vrednost skrivnosti.
- Dodatna dovoljenja niso potrebna. Aplikacija zahteva samo `openid`, `profile` in `email`.

### 2. Nastavitve

```bash
git clone https://github.com/tomazf/LAV-ELS.git && cd LAV-ELS
cp .env.example .env
```

V `.env` vpiši vrednosti. `SESSION_SECRET` in `POSTGRES_PASSWORD` ustvari z `openssl rand -hex 32`.

`ADMIN_EMAILS` primerja uporabniško ime za prijavo (UPN), npr. `tomaz.ferbezar@sc-nm.si`. Pri več skrbnikih naslove loči z vejico. Spremembe veljajo po `docker compose up -d`.

### 3. Zagon

S samodejnim HTTPS (Caddy, vrati 80 in 443 morata biti prosta, domena mora kazati na strežnik):

```bash
docker compose --profile https up -d --build
```

Če že imaš obratni posredovalnik, ga usmeri na `127.0.0.1:4000`, nato (tako teče `els.sc-nm.si`, nameščen v `/opt/lav-els`):

```bash
docker compose up -d --build
```

Posredovalnik mora poslati `X-Forwarded-Proto: https`. Preveri delovanje: `curl http://127.0.0.1:4000/healthz`.

### 4. Prvi koraki

1. Skrbnik se prijavi in odpre **Administracija**.
2. Učitelji se enkrat prijavijo, skrbnik jim dodeli vlogo.
3. Skrbnik ustvari razrede pod **Administracija > Razredi**.
4. Učitelj se pod **Razredi** pridruži razredu in pod **Vaje razreda** izbere vaje. Novi razred nima odprte nobene vaje.
5. Dijaki se prijavijo in čakajo, učitelj jih doda v razred.

## Vzdrževanje

Posodobitev:

```bash
cd /opt/lav-els && git pull && docker compose up -d --build
```

Podatki ostanejo, ker so v trajnem nosilcu `db-data`. Spremembe baze (`src/migrations/`) se izvedejo same ob zagonu. Dijaki z odprto vajo naj po posodobitvi osvežijo stran.

Varnostna kopija in obnovitev:

```bash
docker compose exec -T db pg_dump -U lavels lavels | gzip > lavels-$(date +%F).sql.gz
gunzip -c lavels-DATUM.sql.gz | docker compose exec -T db psql -U lavels lavels
```

Skrivnost v Entra poteče. Pred iztekom ustvari novo in posodobi `OIDC_CLIENT_SECRET`.

## Osebni podatki

Portal hrani podatke dijakov, zato se pred uporabo pogovori s pooblaščeno osebo za varstvo podatkov in določi rok hrambe. **Odstranitev iz razreda** podatkov ne izbriše in dijaka lahko dodaš v drug razred. **Izbris uporabnika** je trajen: izbriše račun, napredek, opombe in zgodovino ter ime v dnevniku. Če se ista oseba znova prijavi, je to nov prazen račun. Stare varnostne kopije še vsebujejo podatke, zato jih hrani samo toliko časa, kot je določeno. Kaj se beleži, je opisano na strani **Kateri podatki se beležijo** v portalu. Skrbnik lahko pod **Administracija** izbriše posameznega uporabnika ali vse dijake, ki se dolgo niso prijavili. Stran ne nalaga ničesar z drugih strežnikov.

## Napredek in ponastavitev

Vsak dijak ima pri vaji en trenutni poskus. Rešena naloga je zaklenjena, namig odbije polovico točk, prikaz rešitve pomeni 0 točk. Ta pravila preveri tudi strežnik.

Ponastavitev začne nov poskus. Lahko jo sproži dijak sam, učitelj posameznemu dijaku ali celemu razredu, ali nova različica vaje. Prejšnji rezultat in razlog ostaneta zabeležena, učitelj ju vidi pri rezultatih. Opombe ostanejo.

Novi razred nima odprte nobene vaje, učitelj jih odpre sam. Če učitelj vajo zapre, se novi odgovori ne shranijo.

## Spremenljiva števila

96 od 266 nalog ima za vsakega dijaka svoja števila. Naloga, stopnja in točke so enake, namig, rešitev in ponujeni odgovori pa se izračunajo iz dijakovih vrednosti.

| Vaja | 1.1 | 1.2 | 1.3 | 1.4 | 2.1 | 2.2 | 3.1 | 3.2 | 3.3 |
|---|---|---|---|---|---|---|---|---|---|
| Spremenljive naloge | 7 | 5 | 9 | 8 | 20 | 15 | 16 | 9 | 7 |
| Vseh nalog | 24 | 29 | 40 | 25 | 38 | 31 | 43 | 18 | 18 |

- Števila določa naključno seme poskusa v bazi (`progress.variant_seed`). Zato so enaka po osvežitvi in na drugem računalniku, ponastavitev pa da nova.
- Naloge, ki jih je dijak že začel, preden je poskus dobil seme, obdržijo izvirna števila (`progress.variant_keep`).
- Pri minimizaciji števila niso naključna: naloga izbere s seznama vnaprej preverjenih funkcij z enako težavnostjo.
- Učitelj vidi izvirno besedilo naloge z oznako, da imajo dijaki svoja števila. Številk posameznega dijaka ne vidi.

## Spreminjanje vaj

Vaje so v `content/exercises/`, seznam nalog in strani pa v `content/catalog.json`. **To je zdaj glavna različica vaj.** Objavljeni artefakti in predloge v projektu lahko vsebujejo starejše naloge (npr. vaja 3.2), zato ponovni uvoz iz njih popravke povozi. Oboje ustvari orodje za uvoz iz mape z datotekami `1.1.html`, `1.2.html` in tako naprej:

```bash
npm ci
node scripts/import-exercises.js POT/DO/MAPE
```

Naloge s spremenljivimi števili so naštete v `content/variants.json` (številka naloge je zaporedna od 0, torej naloga #5 ima številko 4), njihovi razponi pa v `src/public/js/variants/`. Če spremeniš nalogo s tega seznama, popravi tudi njen zapis tam in preverjanje v `test/variants.test.js`. Vaji 3.1 in 3.2 imata poleg tega v svoji kodi vrstico `LavelsVariants.apply(...)`, ki jo uvoz vaj ne doda sam.

Napredek je vezan na zaporedno številko naloge. Če spremeniš vrstni red ali število nalog, v vaji povečaj različico v ključu napredka (npr. `scnm_lavele_1_3_v1` v `_v2`). Dijaki tako začnejo nov poskus, prejšnji rezultat pa ostane zabeležen. Popravek besedila različice ne potrebuje.

Nova vaja: dodaj jo v seznam `EXERCISES` v `scripts/import-exercises.js`. Vaja mora napredek shranjevati v `localStorage`, imeti gumb `#resetBtn` s potrditvijo `#resetYes`, naloge `.task` in strani `.page`.

Tehnični ključi `scnm_lavele_*` namenoma ohranijo staro ime.

## Razvoj in preizkusi

```bash
npm ci
npx playwright install chromium
TEST_DATABASE_URL=postgres://uporabnik@localhost/lav_test npm test
```

Preizkusi uporabijo pravi strežnik, PostgreSQL in brskalnik, prijavo pa nadomesti `test/mock-oidc.js`. **Baza `TEST_DATABASE_URL` se ob vsakem zagonu izbriše.** `test/variants.test.js` vsako spremenljivo nalogo primerja z ločenim izračunom in jo reši na strani ter ne potrebuje baze. GitHub Actions ob vsaki objavi požene preizkuse in gradnjo slike Docker.

## Zgradba

- `src/server.js`: strežnik in varnostne nastavitve
- `src/auth.js`: prijava Entra in vloge
- `src/progress.js`: pravila za točke, zaklepanje in namige na strežniku
- `src/public/js/tracker.js`: sledilnik, ki se naloži pred vsako vajo
- `src/public/js/variants/`: spremenljiva števila po vajah
- `src/migrations/`: spremembe baze, izvedejo se ob zagonu
- `src/routes/`, `src/views/`: strani za dijake, učitelje in skrbnike
- `content/`: vaje, katalog in seznam spremenljivih nalog
