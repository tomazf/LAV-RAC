# LAV-RAČ: stanje in posebnosti

Splošni dogovor je v `NACRT_PORTALA.md`. Tukaj je samo, kar velja za ta portal.

## Stanje

Postavljena je osnova: prijava, vloge, oblika, vstopna stran in struktura z deli LAV-RAČ2, LAV-RAČ3 in LAV-RAČ4. Vsebine še ni.

Še ni dogovorjeno:
- vsebina posameznega letnika in seznam artifactov,
- letnik razreda: dijak naj vidi samo svoj letnik in v njem samo vsebine, ki mu jih odpre učitelj. Zdaj vidi vaje, odprte njegovemu razredu; razred še nima letnika, učitelj pa vidi vse vaje,
- kako štejejo naloge »Za doma« in maturitetne naloge.

## Odločitve

- Ime `LAV-RAČ`, `slug` `lavrac`, naslov `lavrac.sc-nm.si`. `slug` se po začetku uporabe ne spreminja.
- Prave uporabnike, bazo in registracijo v Entra ima portal svoje, z LAV-ELS si deli samo ogrodje.
- Artifacti se pri uvozu pretvorijo v pogodbo iz razdelka 5 načrta, jedro (`tracker.js`, `progress.js`) ostane nespremenjeno, da združitve iz `upstream` ostanejo čiste.
- Vaje LAV-ELS so v `test/fixtures/content`, ker na njih tečejo preizkusi ogrodja. `src/public/js/variants/` ostane iz istega razloga, dijakom se ne naloži, dokler vaja nima spremenljivih števil.

## Vstopna stran

Sprednja plošča računalnika: ime portala v bajtih (Windows-1250, ker ima tam Č en bajt). Lučke so pravi biti, dijak jih prižiga in vidi znak in šestnajstiško vrednost. Barva loči zgornje in spodnje štiri bite, ker so štirje biti ena šestnajstiška števka.

## Postavitev

Entra, nova registracija aplikacije, en najemnik:
- Redirect URI (platforma Web): `https://lavrac.sc-nm.si/auth/callback` in `https://lavrac.sc-nm.si/`
- Certificates & secrets: nova skrivnost, zapiši rok veljavnosti
- Dovoljenja: samo `openid`, `profile`, `email`

Strežnik: DNS za `lavrac.sc-nm.si`, svoja mapa, `.env` iz `.env.example`, `APP_PORT=4001`, nginx v `ssl-proxy` na ta vrata s `X-Forwarded-Proto: https` in `client_max_body_size 200m;`. Profila `https` (Caddy) ne uporabi, če vrata 80 in 443 že uporablja `ssl-proxy`.
