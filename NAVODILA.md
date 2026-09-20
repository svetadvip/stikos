# STIK OS – navodila za namestitev (približno 15 minut)

Vse deluje brezplačno: GitHub (hramba), GitHub Pages (spletna stran) in Cloudflare Workers (branje trgovine + AI).

## 1. Dva repozitorija na GitHubu

| Repozitorij | Vsebina | Vidnost |
|---|---|---|
| `stik-os` | samo `index.html` (aplikacija) | javen (zaradi brezplačnih GitHub Pages) |
| `stik-podatki` | `data.json` + mapa `files/` (tvoji podatki) | **ZASEBEN** |

**Podatkov nikoli ne shranjuj v javni repozitorij** – vsebujejo stranke, cene, račune, pogodbe.

1. Ustvari repozitorij `stik-os` → naloži `index.html` → Settings → Pages → Deploy from a branch → `main` / `(root)`.
   Aplikacija bo na `https://TVOJE-IME.github.io/stik-os/`.
2. Ustvari **zaseben** repozitorij `stik-podatki` → naloži `data.json` iz te mape (ni obvezno, aplikacija ga ustvari sama).

## 2. Dostopni žeton (da aplikacija sme pisati v `stik-podatki`)

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token:
- Repository access: *Only select repositories* → `stik-podatki`
- Permissions → Repository permissions → **Contents: Read and write**
- Expiration: kar želiš (ob izteku naredi novega in ga vpiši v Nastavitve)

## 3. Povezava v aplikaciji

Odpri aplikacijo → Nastavitve → Povezava s podatki → vpiši uporabnika, `stik-podatki`, žeton → **Poveži z GitHub**.
Žeton se shrani samo v tem brskalniku. Na drugi napravi ga vpišeš znova – vsi podatki se naložijo sami.

Od tu naprej se vsaka sprememba po ~2 sekundah samodejno zapiše v `data.json` (zgoraj desno piše »Shranjeno v GitHub«).
Slike in PDF-ji gredo v mapo `files/`. Vsaka sprememba je tudi commit, zato imaš celotno zgodovino.
Če delaš z več naprav hkrati, se spremembe pri shranjevanju samodejno združijo.

Alternativa brez GitHuba: Nastavitve → *Mapa v računalniku* (Chrome/Edge) – zapisuje v mapo na disku.

## 4. Cloudflare Worker (branje spletne trgovine + brezplačen AI)

Potreben je brezplačen račun na cloudflare.com (kartica ni potrebna).

1. dash.cloudflare.com → **Workers & Pages** → Create → **Hello World** → poimenuj `stik-os` → Deploy → **Edit code**.
2. Zamenjaj vso kodo z vsebino `worker.js` (v aplikaciji: Nastavitve → AI in povezave → Kopiraj kodo) → Deploy.
3. Worker → Settings → **Bindings** → Add → **Workers AI** → ime spremenljivke: `AI`.
4. Worker → Settings → Variables and Secrets → dodaj Secret `APP_KEY` (poljubno dolgo geslo).
   Neobvezno: `ALLOWED_ORIGIN` = `https://TVOJE-IME.github.io` in `ALLOWED_HOSTS` = `pickupoprema.si,roadranger.si,avengerbox.si`.
5. V aplikaciji: Nastavitve → AI in povezave → vpiši naslov Workerja (`https://stik-os.XXXX.workers.dev`) in `APP_KEY` → *Preveri povezavo* → *Preizkusi AI*.

Worker samodejno poskusi več brezplačnih modelov (privzeto Gemma 4 26B → Llama 3.3 70B → Llama 3.1 8B). Model lahko zamenjaš v Nastavitvah ali z `AI_MODELS`.
Brezplačna kvota Workers AI je 10.000 nevronov na dan (približno nekaj sto krajših odgovorov). Ko je porabljena, AI do polnoči UTC ne deluje – zaračunavanja ni, ker ni kartice.

## 5. Kako narediš ponudbo

1. Slikovne ponudbe → Nova ponudba (ali v Vnos strank pri stranki klikni ikono ponudbe).
2. Vpiši kupca (ali izberi obstoječega).
3. Prilepi povezave izdelkov iz pickupoprema.si (ena na vrstico) → *Preberi iz trgovine*. Prebere naziv, sliko/slike, opis (alineje »Standardna oprema«) in ceno. Cene v trgovini so z DDV, aplikacija jih pretvori v ceno brez DDV (nastavljivo).
4. Pri vsakem izdelku po potrebi vpiši popust, uvozni transport, montažo. Skupaj z DDV, avans in rok dobave se izračunajo sami.
5. **Word** = urejljiv dokument (.docx); **PDF** = stisnjen (kakovost slik 70 %, nastavljivo v Nastavitvah → Ponudbe).

Številka ponudbe se predlaga samodejno (zadnja uporabljena je nastavljena na 8 → prva nova bo 9; spremeniš v Nastavitvah → Ponudbe).

## Opombe

- Stolpec **DE** pri DFA/IFA sem prevzel iz Excela kot prosto besedilo – če pomeni kaj določenega (npr. država ali datum), ga lahko preimenujem.
- Kilometrina je privzeto 0,43 €/km – višino preveri pri računovodji (Nastavitve → Ostalo).
- Izračun kilometrov iz relacije uporablja javna brezplačna strežnika OpenStreetMap (Nominatim) in OSRM; za redno rabo vpiši km ročno ali po števcu.
- Datoteke v GitHub so omejene na ~25 MB na datoteko.

## Izvoz v PDF

Vsaka rubrika ima gumb PDF (seznam) in ikono PDF pri zapisu; PDF imajo tudi ponudbe, mape, koledar, poročila, nadzorna plošča in AI pogovor. Različica za Google Drive: glej `NAVODILA-GOOGLE-DRIVE.md`.
