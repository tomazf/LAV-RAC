# LAV-ELS

Portal za laboratorijske vaje iz digitalne elektronike. Poveže vaje 1.1 do 3.3, dijakom shranjuje napredek, učiteljem pokaže, kako razred napreduje. Rezultati so za vajo in spremljanje, ne za ocenjevanje, ker se točkovanje izvaja v brskalniku.

## Vloge

| Vloga | Kako jo dobi | Kaj lahko |
|---|---|---|
| Skrbnik | uporabniško ime v `ADMIN_EMAILS` | ustvarja in briše razrede, določa učitelje, briše uporabnike, lahko dela vse kot učitelj v vsakem razredu |
| Učitelj | določi ga skrbnik | se pridruži razredom (iz razreda ga lahko odstrani skrbnik), v svojih razredih dodaja in odstranjuje dijake, izbira odprte vaje in vrstni red, vidi rezultate in dijake brez razreda |
| Dijak | učitelj ali skrbnik ga doda v en razred | rešuje odprte vaje, vidi svoj napredek in piše svoje opombe |
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

Če že imaš obratni posredovalnik, ga usmeri na `127.0.0.1:4000`, nato:

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
git pull && docker compose up -d --build
```

Varnostna kopija in obnovitev:

```bash
docker compose exec -T db pg_dump -U lavels lavels | gzip > lavels-$(date +%F).sql.gz
gunzip -c lavels-DATUM.sql.gz | docker compose exec -T db psql -U lavels lavels
```

Skrivnost v Entra poteče. Pred iztekom ustvari novo in posodobi `OIDC_CLIENT_SECRET`.

## Osebni podatki

Portal hrani podatke dijakov, zato se pred uporabo pogovori s pooblaščeno osebo za varstvo podatkov in določi rok hrambe. **Odstranitev iz razreda** podatkov ne izbriše in dijaka lahko dodaš v drug razred. **Izbris uporabnika** je trajen: izbriše račun, napredek, opombe in zgodovino ter ime v dnevniku. Če se ista oseba znova prijavi, je to nov prazen račun. Stare varnostne kopije še vsebujejo podatke, zato jih hrani samo toliko časa, kot je določeno. Kaj se beleži, je opisano na strani **Kateri podatki se beležijo** v portalu. Skrbnik lahko pod **Administracija** izbriše posameznega uporabnika ali vse dijake, ki se dolgo niso prijavili. Stran ne nalaga ničesar z drugih strežnikov.

## Spreminjanje vaj

Vaje so v `content/exercises/`, seznam nalog in strani pa v `content/catalog.json`. **To je zdaj glavna različica vaj.** Objavljeni artefakti in predloge v projektu lahko vsebujejo starejše naloge (npr. vaja 3.2), zato ponovni uvoz iz njih popravke povozi. Oboje ustvari orodje za uvoz iz mape z datotekami `1.1.html`, `1.2.html` in tako naprej:

```bash
npm ci
node scripts/import-exercises.js POT/DO/MAPE
```

Naloge s spremenljivimi števili so naštete v `content/variants.json`, njihovi razponi pa v `src/public/js/variants/`. Če spremeniš nalogo s tega seznama, popravi tudi njen zapis tam.

Napredek je vezan na zaporedno številko naloge. Če spremeniš vrstni red ali število nalog, v vaji povečaj različico v ključu napredka (npr. `scnm_lavele_1_3_v1` v `_v2`). Dijaki tako začnejo nov poskus, prejšnji rezultat pa ostane zabeležen. Popravek besedila različice ne potrebuje.

Nova vaja: dodaj jo v seznam `EXERCISES` v `scripts/import-exercises.js`. Vaja mora napredek shranjevati v `localStorage`, imeti gumb `#resetBtn` s potrditvijo `#resetYes`, naloge `.task` in strani `.page`.

Tehnični ključi `scnm_lavele_*` namenoma ohranijo staro ime.

## Razvoj in preizkusi

```bash
npm ci
npx playwright install chromium
TEST_DATABASE_URL=postgres://uporabnik@localhost/lav_test npm test
```

Preizkusi uporabijo pravi strežnik, PostgreSQL in brskalnik, prijavo pa nadomesti `test/mock-oidc.js`. **Baza `TEST_DATABASE_URL` se ob vsakem zagonu izbriše.**

## Zgradba

- `src/server.js`: strežnik in varnostne nastavitve
- `src/auth.js`: prijava Entra in vloge
- `src/progress.js`: pravila za točke, zaklepanje in namige na strežniku
- `src/public/js/tracker.js`: sledilnik, ki se naloži pred vsako vajo
- `src/routes/`, `src/views/`: strani za dijake, učitelje in skrbnike
- `content/`: vaje in katalog
