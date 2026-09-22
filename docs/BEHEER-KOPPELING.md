# De ChatGPT-koppeling beheren

Voor Lars en Chris. Els gebruikt de koppeling; hier staat hoe je hem openzet, dichtzet en naloopt.

## Wie er binnen mag

De toegang hangt aan één env-waarde: **`TOEGESTANE_GITHUB_GEBRUIKERS`**, een lijst GitHub-namen
gescheiden door komma's.

- **Leeg betekent niemand.** Dat is de stand waarin de site vertrekt.
- Iemand toevoegen: zet zijn GitHub-naam erbij in de env van het Vercel-project en deploy opnieuw.
- Iemand intrekken: haal de naam weg en deploy. Elk eerder uitgegeven token werkt dan meteen niet
  meer — de lijst wordt bij élke aanroep gelezen, niet alleen bij het inloggen.

Tokens verlopen daarnaast vanzelf. Standaard na 30 dagen; `KOPPELING_TOKEN_DAGEN` zet dat anders.
Wil je alle tokens tegelijk ongeldig maken: verander `KOPPELING_TOKEN_GEHEIM`. Dan moet iedereen
opnieuw inloggen.

## De env-waarden

Alleen de namen; de waarden staan in Vercel en in `.geheim/` op de werkmachine, nooit in deze repo.

| Naam | Waarvoor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | het adres van de site (canonical, Open Graph, sitemap) |
| `NEXT_PUBLIC_GA_ID` | meet-ID van Google Analytics; leeg = geen banner, geen statistiek |
| `NEXT_PUBLIC_DEMO` | `1` maakt er een voorbeeldversie van (noindex) |
| `GITHUB_APP_CLIENT_ID` · `GITHUB_APP_CLIENT_SECRET` | het inloggen via GitHub |
| `GITHUB_APP_ID` · `GITHUB_APP_INSTALLATIE_ID` · `GITHUB_APP_PRIVATE_KEY` | het schrijven in de repo |
| `TOEGESTANE_GITHUB_GEBRUIKERS` | wie de site mag beheren |
| `KOPPELING_TOKEN_GEHEIM` · `KOPPELING_TOKEN_DAGEN` | waarmee tokens ondertekend worden, en hoe lang ze gelden |
| `KOPPELING_REPO` · `PUBLICATIETAK` · `PUBLICATIE_URL` | waar de koppeling naartoe schrijft en waar dat te zien is |
| `KOPPELING_TESTTOKEN` | **alleen lokaal.** Werkt niet op Vercel: de testmodus is daar uit |

`.env.example` in de repo heeft dezelfde lijst, zonder waarden.

## Wat de koppeling wel en niet kan

- Ze schrijft alleen in `content/**` en `public/media/**`. Een poging op wat dan ook daarbuiten
  wordt geweigerd; `qa/koppeling-unit.mjs` test dat zonder netwerk.
- Ze schrijft alleen naar de tak uit `PUBLICATIETAK`. Die staat nu op `eerste-versie`. **`main`
  wordt nooit beschreven** — het testprogramma vergelijkt de hash van `main` vóór en na.
- Een voorstel dat het contentschema breekt komt er niet in, en kan dus ook niet gepubliceerd
  worden.
- Hoogstens vijf voorstellen tegelijk.

## Nalopen

- **Wat is er gebeurd?** De commitgeschiedenis van de repo. Elke wijziging heeft als auteur
  "Els via ChatGPT".
- **Wat ging er mis?** De runtime-logs van Vercel. Daar staan geen tokens en geen foto-inhoud in.
- **Werkt alles nog?** `node qa/koppeling-test.mjs --mcp <adres van de route>` draait veertien
  scenario's, van inloggen tot terugdraaien, en ruimt zijn eigen testtakken op.

## Wat nog openstaat

1. **Els heeft nog geen GitHub-account op de lijst.** Tot die naam in
   `TOEGESTANE_GITHUB_GEBRUIKERS` staat, kan niemand inloggen — dat is bewust.
2. **De GitHub App moet nog op Els' repo geïnstalleerd worden**, en het installatienummer moet in
   `GITHUB_APP_INSTALLATIE_ID`.
3. **`PUBLICATIE_URL` moet gevuld worden** met de voorbeeldlink van de tak `eerste-versie`, zodra
   het Vercel-project bestaat.
4. **Els moet de app in ChatGPT aanmaken** — dat staat in `CHATGPT-KOPPELEN.md`.
