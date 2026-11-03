# LAV-ELS: TODO pred objavo

Podrobna navodila so v `README.md`. Skrbnik vse vrednosti vpiše v `.env` na strežniku.

## Pred objavo (Ferbi priskrbi)

### 1. Domena strežnika
- [ ] Domena ali poddomena portala: `____________`
- [ ] DNS kaže na strežnik.
- [ ] HTTPS: lasten obratni posredovalnik ali Caddy iz Docker Compose.

### 2. Registracija aplikacije v Entra
- [ ] Nova registracija aplikacije samo za šolskega najemnika (single tenant).
- [ ] Tenant ID: `____________`
- [ ] Client ID: `____________`
- [ ] Skrivnost odjemalca (Client secret), rok veljavnosti: `____________`
- [ ] Povratna naslova (Redirect URI, platforma Web): `https://DOMENA/auth/callback` in `https://DOMENA/`.
- [ ] Dovoljenja: `openid`, `profile`, `email`.

Skrivnosti ne pišemo v repozitorij. Vpišejo se samo v datoteko `.env` na strežniku.

### 3. Admin
- [ ] E-poštni naslov admina (ali več naslovov): `____________`
- [ ] Naslov mora biti uporabniško ime za prijavo (UPN), običajno `ime.priimek@sola.si`.

### 4. Varstvo osebnih podatkov
- [ ] Obvestiti pooblaščeno osebo za varstvo podatkov šole.
- [ ] Določiti rok hrambe podatkov dijakov: `____________`
- [ ] Določiti, kdaj in kako se podatki izbrišejo (npr. ob koncu šolskega leta ali ob izpisu).

## Prvi zagon na strežniku
- [ ] Vnos vrednosti v `.env` in `docker compose --profile https up -d --build` (ali brez Caddyja za lasten posredovalnik).
- [ ] Admin se prijavi in določi učitelje.
- [ ] Učitelj ustvari preizkusni razred in vanj doda čakajočega uporabnika.
- [ ] Preizkus pravega dijaškega računa: čakanje, dodelitev v razred, reševanje, ponastavitev, pogled učitelja.
- [ ] Preizkus skupnega računalnika: drug dijak ne vidi napredka prejšnjega.
- [ ] Popravki po prvem preizkusu z razredom.
