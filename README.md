# LAV-ELS

Portal za laboratorijske vaje iz digitalne elektronike. Poveže vaje 1.1 do 3.3, dijakom shranjuje napredek, učiteljem pokaže, kako razred napreduje. Rezultati so za vajo in spremljanje, ne za ocenjevanje, ker se točkovanje izvaja v brskalniku.

## Vloge

| Vloga | Kako jo dobi | Kaj lahko |
|---|---|---|
| Skrbnik | e-poštni naslov v `ADMIN_EMAILS` | določa učitelje, vidi vse, izbriše uporabnike, določa vidnost in vrstni red vaj |
| Učitelj | določi ga skrbnik | ustvarja razrede, dodaja čakajoče, vidi rezultate svojih razredov |
| Dijak | učitelj ga doda v razred | rešuje vaje in vidi svoj napredek |
| Čaka | vsak nov uporabnik | vidi samo obvestilo, da čaka na razred |

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
3. Učitelj ustvari razred pod **Razredi**.
4. Dijaki se prijavijo in čakajo, učitelj jih doda v razred.

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

Portal hrani podatke dijakov, zato se pred uporabo pogovori s pooblaščeno osebo za varstvo podatkov in določi rok hrambe. Kaj se beleži, je opisano na strani **Kateri podatki se beležijo** v portalu. Skrbnik lahko pod **Administracija** izbriše posameznega uporabnika ali vse dijake, ki se dolgo niso prijavili. Stran ne nalaga ničesar z drugih strežnikov.

## Spreminjanje vaj

Vaje so v `content/exercises/`, seznam nalog in strani pa v `content/catalog.json`. Oboje ustvari orodje za uvoz iz mape z datotekami `1.1.html`, `1.2.html` in tako naprej:

```bash
npm ci
node scripts/import-exercises.js POT/DO/MAPE
```

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
