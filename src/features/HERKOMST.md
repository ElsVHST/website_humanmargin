# Herkomst van de features in deze map

Alle mappen hier zijn **gevendord** vanuit `bouwen/component-library/` — gekopieerd zodat deze
template zelfstandig blijft (geen `import` die buiten deze repo grijpt, geen risico dat een latere
wijziging in de bibliotheek deze site stilletjes breekt). Elke feature is dependency-vrij vanilla
JS/CSS met een dunne React/Next.js-wrapper (`.tsx`), gekopieerd zonder `test/`, `demo.html` en
`.claude/`.

Eerst gekopieerd 22-09-2026 tijdens de bouw van de effecten voor deze template. **Opnieuw
gekopieerd (verse stand) 22-09-2026, laatste ronde**, nadat de bibliotheek verder was: showcase-
demo's, een testserver op een vrije poort, en progressive enhancement bij
`horizontal-scroll-pin` (zie tabel hieronder). Alle 8 features zijn op dat moment 1-op-1
bytegelijk aan hun bron in `component-library/`, gecontroleerd met `diff -rq` per map
(uitgezonderd `test/`, `demo.html`, `.claude/`).

| Map hier | Bron in `component-library/` | Laatst her-gevendord | Wat het doet |
|---|---|---|---|
| `glass-lens/` | `effects/glass-lens/` | 22-09-2026 | De ronde glazen lens over de hero die de cursor volgt (chromatische aberratie via SVG `feDisplacementMap`). |
| `header-state/` | `scroll/header-state/` | 22-09-2026 | Zet `is-past-hero` op de header zodra > 75% van de eerste viewport is gescrold. |
| `hero-motion/` | `scroll/hero-motion/` | 22-09-2026 | Letter-voor-letter kop-intro + infade van hero-elementen + hero-recede-parallax bij scrollen. |
| `horizontal-scroll-pin/` | `scroll/horizontal-scroll-pin/` | 22-09-2026 — **inhoudelijk bijgewerkt**, zie § Progressive enhancement | De gepinde, horizontaal doorschuivende aanbod-sectie (desktop) / native swipe-carrousel (mobiel). |
| `kinetic-type/` | `typography/kinetic-type/` | 22-09-2026 | "Dichtdrukken": `wght`/`wdth`/dekking van een kop gestuurd door de afstand tot het midden van het scherm. Bevat ook `fonts/BricolageGrotesque-Variable.ttf` + `OFL.txt` (zie § Lettertype in `LEESMIJ.md`). |
| `link-dialog-funnel/` | `modals/link-dialog-funnel/` | 22-09-2026 — **inhoudelijk bijgewerkt**, zie § showStepCount/privacyOnEveryStep | Onderschept aanvraag-links en opent een stapsgewijze `<dialog>`-funnel met vooringevulde interesse. |
| `reveal-on-scroll/` | `scroll/reveal-on-scroll/` | 22-09-2026 | Generieke fade+translate-in-onthulling voor `[data-reveal]`-elementen. Infrastructuur, momenteel 0 doelwitten (zie SPEC §1/§3.6). |
| `story-word-light/` | `scroll/story-word-light/` | 22-09-2026 | De "Wie ik ben"-alinea die woord voor woord oplicht terwijl de sectie sticky blijft staan. |

## Progressive enhancement bij `horizontal-scroll-pin` (22-09-2026, laatste ronde)

De bibliotheek-versie is functioneel gewijzigd sinds de vorige kopie: de CSS-**standaard**
(vóórdat `init()` ooit draait, of zonder JS) is nu op elke breedte de native, scroll-snap-rij —
paneel 2 en 3 blijven dus altijd bereikbaar zonder JS. Pas als `init()` vaststelt dat de viewport
niet-mobiel is, zet de module het attribuut `data-scroll-pin-pinned` op de root; pas dán schakelt
de CSS naar de vastgezette (`position: sticky` + JS-`translateX`) pin-modus. Voorheen paste de
CSS de pin-modus altijd toe boven het breekpunt, ook zonder JS/vóór `init()`.

Geen markup-wijziging nodig in `Aanbod.tsx` — de attributen (`[data-scroll-pin]`,
`[data-scroll-pin-sticky]`, `[data-scroll-pin-track]`, `[data-scroll-pin-panel]`, `[data-scroll-
pin-nav]`, `[data-scroll-pin-word]`, `[data-scroll-pin-seg]`) zijn ongewijzigd; `data-scroll-pin-
pinned` wordt uitsluitend door `HorizontalScrollPin.tsx`s `init()`-aanroep gezet, niet door de
template zelf. Nagemeten met JS uit (zie het beeld-rapport in het antwoord van deze ronde): alle
aanbodpanelen blijven op desktop bereikbaar.

## showStepCount / privacyOnEveryStep bij `link-dialog-funnel` (22-09-2026, laatste ronde)

Vorige ronde (beta-NO-GO) had deze template een **projectspecifieke patch in de gevendorde
`link-dialog-funnel.js`** (buiten `component-library/` om, want die was toen off-limits):
`progressEl.hidden` altijd `true` en `privacyEl.hidden` altijd `false`, om de bron na te bootsen
("Stap X van Y" nooit tonen, privacyregel al op stap 1). Die patch is nu overbodig: de bibliotheek
heeft er twee officiële opties voor gekregen, `showStepCount` (standaard `true`) en
`privacyOnEveryStep` (standaard `false`) — zie `component-library/modals/link-dialog-funnel/
README.md` § Opties. De verse kopie in deze map heeft dus **geen patch meer**; `src/components/
AanvraagFunnel.tsx` zet in plaats daarvan `showStepCount={false} privacyOnEveryStep={true}` op de
`<LinkDialogFunnel>`-props. Gedrag ongewijzigd, geen divergentie meer tussen bibliotheek en
template op dit punt.

De eerdere `requiredError`-per-veld-uitbreiding (round 2) zat al in de bibliotheek-bron zelf en
is dus gewoon meegekomen met deze her-vendor — geen actie nodig.

## Hoe je later bijwerkt

1. Vergelijk het bestand in `component-library/<pad>/` met het gelijknamige bestand hier
   (`diff bouwen/component-library/scroll/hero-motion/hero-motion.js
   bouwen/lab/fares-template/src/features/hero-motion/hero-motion.js`).
2. Kopieer opnieuw met dezelfde aanpak (zonder `test/`, `demo.html`, `.claude/`) als de
   bibliotheek-versie is bijgewerkt en je die verbetering wilt overnemen.
3. Wijzig je hier iets projectspecifieks (een kleurtoken, een uitzondering) dat je niet in de
   bibliotheek wilt: noteer het in deze tabel zodat een toekomstige update niet per ongeluk je
   aanpassing overschrijft. Zet zulke aanpassingen bij voorkeur als een **eigen, specifiekere
   CSS-selector in `src/app/globals.css`** (zie § Projectspecifieke CSS-overrides hieronder) of
   als een **prop/optie op de React-wrapper** (zoals `showStepCount`/`privacyOnEveryStep`
   hierboven) — niet als een handmatige wijziging ín het gevendorde bestand zelf. Een wijziging
   ín een gevendord bestand overleeft de volgende her-vendor niet.

## Projectspecifieke CSS-overrides (niet in de bibliotheek, wel hier)

Toegevoegd 22-09-2026 (Final-QA-ronde) in `src/app/globals.css`, bovenop de gevendorde CSS —
allemaal via een eigen, specifiekere selector, zonder de gevendorde bestanden te wijzigen:

- `[data-scroll-pin-word]` / `.is-active` krijgen een eigen `font-variation-settings` (de
  offers-words-legenda "Bouwen, inspireren, leren" — een bron-detail dat los staat van
  `horizontal-scroll-pin`'s eigen kleur-CSS-variabelen).
- `[data-scroll-pin-panel].aanbod-panel` krijgt op desktop meer `padding-block`
  (`clamp(8rem,20vh,11rem) clamp(3.5rem,10vh,6rem)`) dan de bibliotheek-standaard, zodat de
  zwevende kop+nav-rij niet over de paneelinhoud valt — zie `Aanbod.tsx` voor de volledige
  toelichting.
- `#over.swl` krijgt op mobiel (`max-width:52rem`) `min-height:auto` i.p.v. de bibliotheek-
  standaard `1,7×100vh` — op mobiel heeft de bron geen vaste scroll-baanlengte, de sectie is
  gewoon zo hoog als de content.

Projectspecifieke Tailwind-overrides in componenten zelf (niet in `globals.css`, wel buiten de
gevendorde bestanden): `Aanbod.tsx`s nav krijgt `!block` i.p.v. de bibliotheek-standaard
`display:flex` op `[data-scroll-pin-nav]`, zodat de komma-spatie tussen de aanbodwoorden zijn
breedte behoudt (zie de toelichting in `Aanbod.tsx` zelf).

## Wat NIET gevendord is

`accordions/`, `ai-chat/`, en alle andere mappen in `component-library/` die niet in de tabel
hierboven staan — deze site gebruikt ze niet. Vendor alleen wat je gebruikt; een ongebruikte
feature in `src/features/` is dode code die een volgende bouwer voor actief gebruikt kan aanzien.
