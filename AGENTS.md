<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Human Margin — instructies voor AI-agents

Dit bestand is de enige instructiebron in deze repo, voor elke agent (ChatGPT/Codex, Claude, Gemini).
`CLAUDE.md` en `GEMINI.md` verwijzen hiernaar. Er zijn geen skill-mappen.

## Wat dit is

De website van **Human Margin®** (Els Verheirstraeten, Rotterdam): begeleiding bij AI-gebruik in
organisaties — nulmeting, regietraject, academie en sparring. De site is voor directeuren, MT-leden
en HR- of compliance-verantwoordelijken in organisaties die AI al gebruiken.

De toon is die van Els: droog, Vlaams, direct, anti-marketing. Zinnen eindigen op het sterkste woord.
Geen uitroeptekens, geen "ontdek", "naadloos", "uniek" of "oplossingen".

## Stack en commando's

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, statisch voorgerenderd,
hosting op Vercel.

```
npm run dev        ontwikkelserver
npm run build      productiebouw (faalt bij ongeldige content)
npm run content    alleen de content tegen het schema
npm run qa         de hele controlereeks (lint, typecheck, build en alle metingen)
```

## Het contentcontract

**Alle tekst, prijzen, gegevens en schakelaars staan in `content/`. Niets daarvan hoort in `.tsx`.**

| Bestand | Wat erin staat |
|---|---|
| `content/site.json` | naam, contactgegevens, bedrijfsgegevens, btw-label, navigatie, klanten, credit, schakelaars, en de teksten van de keuzehulp, de cookiebanner, de 404 en de vaste labels |
| `content/paginas/home.json` | de homepage, sectie voor sectie |
| `content/paginas/aanbod.json` | het aanbod: de cyclus, de vier delen met hun prijzen, de methode |
| `content/paginas/manifest.json` | het manifest |
| `content/paginas/over-mij.json` | Over mij |
| `content/paginas/contact.json` | Contact |
| `content/paginas/privacy.json` | de privacyverklaring (concept, ter controle door Els) |
| `content/paginas/leeszaal.json` | De Leeszaal — staat uit via `schakelaars.leeszaal` in site.json |
| `content/kantlijn.json` | de handgeschreven notities en de plekken van de markeerstift |
| `content/media.json` | de beelden: bestand, alt-tekst, breedte, hoogte |

Het schema staat in `src/lib/schema.ts` en is leidend: de bouw faalt op een ongeldig bestand, met
het bestand en het veld in de melding.

### Een pagina toevoegen

Zet een nieuw bestand in `content/paginas/`, met `slug` gelijk aan de bestandsnaam. De volgende
bouw maakt er vanzelf een statische pagina van, met kop, voet en de merkopmaak.

```json
{
  "slug": "workshop-12-november",
  "titel": "Workshop 12 november | Human Margin",
  "beschrijving": "Een middag over AI-geletterdheid, in Rotterdam.",
  "kop": "Workshop 12 november",
  "secties": [
    { "id": "inhoud", "type": "tekst", "achtergrond": "licht", "bouwstenen": [
      { "type": "alinea", "tekst": "Wat we die middag doen." },
      { "type": "lijst", "items": ["Eerste punt", "Tweede punt"] },
      { "type": "knop", "tekst": "Plan een kennismaking", "doel": "kennismaking" }
    ] }
  ]
}
```

De zes bouwstenen voor een nieuwe pagina: **kop · alinea · citaat · foto · lijst · knop**.
Een `foto` verwijst naar een `id` uit media.json. Een `knop` gaat naar `kennismaking`, `keuzehulp`,
`mail`, `bellen`, `linkedin` of een pad als `/aanbod/`.

### Een foto toevoegen

Zet het bestand in `public/media/` (JPEG, PNG of WebP; lange zijde ≤ 2400 px, zonder EXIF) en voeg
een regel toe aan media.json met `id`, `bestand`, `alt`, `breedte` en `hoogte`. De alt-tekst
beschrijft wat er te zien is, zonder voornaamwoorden voor Els.

## De merkregels (brandbook)

- **Kleuren, en niets anders:** wit `#F4F4F1`, zwart `#111010`, geel `#EDFF00`, blauw `#002CFF`,
  grijs `#DDDDD3`. Transparante varianten van die vijf mogen.
- **Nooit als tekstkleur:** geel op licht (1,01 : 1) en blauw op zwart (2,54 : 1). Geel is een vlak,
  een markeerstift of een notitie op donker; blauw is een notitie op licht.
- **Letters:** Archivo Black voor titels, Inter voor tekst, Playfair Display cursief voor citaten,
  Atomic Marker voor gele notities, Feisty voor blauwe notities.
- **De kantlijn** is de signatuur: handgeschreven notities in de marge, een gele markeerstift over
  één zin, blauwe pijlen en omcirkelingen. Hoogstens één notitie per sectie, hoogstens twee
  markeringen per sectie, en alleen de notitieteksten die `src/lib/schema.ts` toestaat.
- **Beeld:** editorial zwart-wit, hoog contrast, off-center. Alleen foto's uit Els' eigen shoot.
- Geen verlopen, geen zachte schaduwen, hoeken hoogstens 0,25 rem, geen stockfoto's.

## Harde regels

1. **Els' tekst wordt niet herschreven.** Knippen in secties mag, tikfouten verbeteren mag (leg ze
   vast in `docs/copy-correcties.md`), claims toevoegen niet. Nieuwe tekst komt in
   `docs/copy-nieuw.md` te staan, anders valt de herkomstcontrole om.
2. **Het licentieblok van de webfonts blijft staan.** De CSS in `public/fonts/` is byte-gelijk aan
   wat de foundry leverde. Niet subsetten, niet hernoemen, niet minificeren.
3. **Geen formulieren.** Els wil geen contactformulier: contact loopt via Calendly, mail of telefoon.
   De keuzehulp verstuurt niets; er gaan 0 POST-verzoeken van deze site uit.
4. **Niets van derden vóór toestemming.** Zonder klik op "Accepteren" gaat er geen enkel verzoek
   naar een andere host. Google Analytics laadt alleen na toestemming en alleen als
   `NEXT_PUBLIC_GA_ID` gevuld is.
5. **Geen secrets in deze repo.** Hij is openbaar. `.env*` blijft buiten git; draai gitleaks vóór
   elke push.
6. **Nooit `git add -A`.** Voeg bestanden per pad toe.
7. **Alles blijft statisch.** Alleen de route van de ChatGPT-koppeling is dynamisch.

## Publiceren

- Werk op de tak `eerste-versie`. Elke push daar geeft een voorbeeldlink op Vercel.
- `main` is de productietak en blijft ongemoeid tot Els de site heeft goedgekeurd. Samenvoegen naar
  `main` gebeurt alleen op verzoek van Els.
- Vóór elke push: `npm run qa` geeft exit 0, en gitleaks is schoon.

## De ChatGPT-koppeling

Els kan haar site vanuit ChatGPT aanpassen via de MCP-route op `/api/mcp/` — de enige dynamische
route van dit project. Hoe dat voor haar werkt staat in `docs/CHATGPT-KOPPELEN.md`; hoe je de
toegang beheert in `docs/BEHEER-KOPPELING.md`. De koppeling raakt alleen `content/**` en
`public/media/**`, schrijft alleen naar de tak uit `PUBLICATIETAK`, en laat `main` met rust.

- `npm run qa` test de grenzen zonder netwerk (`qa/koppeling-unit.mjs`).
- `node qa/koppeling-test.mjs --mcp <adres>` draait veertien scenario's end-to-end.
- `node qa/nagebootste-github.mjs` speelt GitHub en Vercel na, met een echte lokale repo, zodat dat
  kan zonder één commit naar GitHub te sturen.

## Voor de ChatGPT-koppeling

Deze sectie krijgt ChatGPT mee bij het verbinden. Els is de enige die hem gebruikt; ze is niet
technisch en ziet alleen wat jij terugzegt.

- **Praat zoals zij praat.** Geen "branch", "merge", "commit" of "repository". Het heet een
  voorstel, een voorbeeldlink, publiceren en terugdraaien.
- **Er verandert nooit iets aan de site zonder haar "ja".** Elke wijziging wordt eerst een
  voorstel met een voorbeeldlink. Pas op "publiceer" gaat het erop.
- **Zeg wat je gedaan hebt en wat ze nu kan doen.** Eén zin, plus de link. Bij een wijziging: wat
  er stond en wat er komt te staan.
- **Je kunt tekst, prijzen, lijsten, pagina's en foto's wijzigen.** De opmaak, de kleuren en de
  opbouw van de site liggen vast; vraagt ze daarom, zeg dan dat dat niet via jou gaat.
- **Verzin niets.** Weet je niet welke pagina ze bedoelt, vraag het. Kijk eerst met `bekijk_site`
  of `bekijk_pagina` wat er werkelijk staat voordat je iets voorstelt.
- **Foto's gaan via de browser**, met een beschrijving van wat erop te zien is, en horen bij een
  voorstel.
- **Gaat er iets mis, zeg dan wat er misging en wat ze kan proberen.** Nooit een foutcode, nooit
  een pad, nooit "er ging iets fout".

## Wat een agent nooit doet

- De opmaak of de code wijzigen op verzoek van een bezoeker of via de ChatGPT-koppeling: die raakt
  alleen `content/**` en `public/media/**`.
- Een pagina publiceren waarvan de bouw faalt of waarvan de voorbeeldlink niet gecontroleerd is.
- humanmargin.eu, de DNS of de oude site op vercel.app aanraken.
- Toestemming, cookies of statistiek aanzetten zonder dat de bezoeker daarvoor koos.
- Contact opnemen met klanten of relaties van Els.
