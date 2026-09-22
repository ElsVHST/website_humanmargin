# kinetic-type

"Dichtdrukken": een woord wordt vetter, smaller en donkerder naarmate het het
midden van het scherm nadert, en weer lichter/dunner/transparanter als het
weggaat. Gebruikt een variabele font met een `wght`- (gewicht) én
`wdth`-as (breedte), live aangestuurd door de scrollpositie via
`requestAnimationFrame` — geen CSS-animatie, geen scroll-library.

Werkt op zichzelf: dit component weet niets van scroll-pins, tracks of
andere componenten. Het meet gewoon de positie van elk `[data-kinetic-type]`-
element t.o.v. het midden van de viewport. Standaard langs de y-as
(verticaal scrollen); zet `data-kinetic-type="x"` op een element om het
langs de x-as te meten (bedoeld voor gebruik bínnen een horizontale track,
zoals `../../scroll/horizontal-scroll-pin/`) — met een terugval naar de y-as
onder een breedte-drempel, want in een gestapelde mobiele layout beweegt een
element nauwelijks horizontaal.

Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026, de koppen in de
sectie "Dit kan ik voor je doen"), eigen implementatie — geen code
overgenomen.

## Wanneer wel

- Eén of enkele grote koppen (hero, sectietitel) waar je een "levend",
  editorial gevoel aan wilt geven tijdens het scrollen.
- Je hebt (of kunt gebruiken) een variabele font met een écht werkende
  `wdth`-as — zie "Lettertype" hieronder, want zonder die as gebeurt er
  zichtbaar niets.

## Wanneer niet

- Lopende tekst / paragrafen: het effect is ontworpen voor korte, grote
  woorden, niet voor leesbaarheid van veel tekst tegelijk.
- Je merk-font heeft geen variabele versie met `wght` én `wdth` en je wilt
  geen tweede font laden. Zonder `wdth`-as blijft alleen de kleur-alpha over
  (nog steeds een subtiel effect, maar niet "het effect").
- `prefers-reduced-motion`-gevoelige contexten waar zelfs subtiele
  doorlopende verandering ongewenst is — dit component respecteert die
  voorkeur niet apart (zie "Toegankelijkheid").

## Installatie

```
kinetic-type/
├── kinetic-type.js
├── kinetic-type.css
├── KineticType.tsx      (alleen nodig in een React/Next.js-project)
└── fonts/
    ├── BricolageGrotesque-Variable.ttf
    └── OFL.txt
```

Vanilla:

```html
<link rel="stylesheet" href="./kinetic-type.css" />
<style>
	@font-face {
		font-family: "Bricolage Grotesque Variable";
		src: url("./fonts/BricolageGrotesque-Variable.ttf") format("truetype-variations");
		font-weight: 200 800;
		font-stretch: 75% 100%;
	}
	[data-kinetic-type] {
		font-family: "Bricolage Grotesque Variable", sans-serif;
	}
</style>
<h2 data-kinetic-type="y">Een dichtdrukbaar woord</h2>
<script type="module">
	import { init } from "./kinetic-type.js";
	const destroy = init(document.body); // zoekt zelf alle [data-kinetic-type] binnen root
</script>
```

React / Next.js App Router:

```tsx
"use client";
import { KineticType, KineticWord } from "@/component-library/typography/kinetic-type/KineticType";

<KineticType>
	<KineticWord as="h2">Een dichtdrukbaar woord</KineticWord>
</KineticType>;
```

## Markup-contract

Elk element dat je wilt animeren krijgt `data-kinetic-type="y"` (of gewoon
`data-kinetic-type`, standaard is verticaal) of `data-kinetic-type="x"`
(horizontaal, met terugval naar y onder `xAxisBelow`).
`init(root, options)` zoekt met `root.querySelectorAll('[data-kinetic-type]')`
— `root` mag een enkel woord zijn (dan telt het zelf ook mee), of een
container met meerdere woorden erin (bv. `document.body`).

```html
<h2 data-kinetic-type="y">Verticaal (standaard)</h2>
<h3 data-kinetic-type="x">Horizontaal — bedoeld binnen een horizontale track</h3>
```

## Opties

`init(root, options)`:

| Optie | Standaard | Betekenis |
|---|---|---|
| `xAxisBelow` | `"52rem"` | CSS-lengte; onder deze breedte meten x-mode-elementen alsnog langs de y-as. |
| `yFactor` | `0.6` | Normalisatie-afstand voor de y-as, als fractie van de viewporthoogte. |
| `xFactor` | `0.7` | Normalisatie-afstand voor de x-as, als fractie van de viewportbreedte. |
| `minWeight` / `maxWeight` | `300` / `800` | `wght` ver van / in het midden. |
| `maxWidth` / `minWidth` | `100` / `84` | `wdth` ver van / in het midden (kleiner = smaller). |
| `minAlpha` / `maxAlpha` | `0.4` / `1` | Dekking ver van / in het midden. |

CSS-variabelen (op `[data-kinetic-type]` of een voorouder):

| Variabele | Standaard | Betekenis |
|---|---|---|
| `--kt-color-rgb` | `16 16 16` | Basiskleur als `"r g b"`-triplet — de JS stuurt alleen de alpha (`--kt-b`) aan. |
| `--kt-opsz` | `96` | Optische-grootte-as, als het font die heeft (anders genegeerd). |
| `--kt-w` / `--kt-wd` / `--kt-b` | `300` / `100` / `0.4` | Door de JS elk frame gezet; dit zijn alleen de fallbackwaarden vóór de eerste meting / zonder JS. Niet zelf overschrijven. |

## Lettertype

Dit component heeft een variabele font nodig met een **werkende `wght`- én
`wdth`-as**. Niet elke "variabele font" heeft beide: veel gedistribueerde
subsets bevatten alleen `wght` (en soms `opsz`), en dan doet `--kt-wd` op het
scherm zichtbaar helemaal niets — het woord wordt wel vetter, maar nooit
smaller.

**Controleer dit zelf** voordat je een ander font inzet: render dezelfde
tekst met `font-variation-settings: "wdth" 100` en `"wdth" 84` naast elkaar
(zelfde `wght`) en meet `getBoundingClientRect().width`. Verschilt de breedte
niet, dan heeft het font geen (werkende) `wdth`-as.

Precies dit bleek het geval voor `bouwen/lab/fares-template/public/fonts/
bricolage-grotesque.woff2`: een `fvar`-tabelcheck (WOFF2 → Brotli-decompressie
→ `fvar` uitgelezen, alleen met Node's ingebouwde `zlib`, geen dependency)
liet zien dat dat bestand alleen `opsz` (12–96) en `wght` (200–800) bevat —
géén `wdth`-as. In de browser bevestigde dat zich 1-op-1: 0,00px verschil
tussen `wdth 100` en `wdth 84` bij twee verschillende gewichten.

Daarom staat in `fonts/` een eigen gedownloade kopie van de **volledige**
variabele Bricolage Grotesque, rechtstreeks van de canonieke bron
(`google/fonts`, `ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf`,
SIL Open Font License 1.1 — zie `fonts/OFL.txt`). Die bevat wél alle drie de
assen: `opsz` 12–96, `wght` 200–800, `wdth` 75–100. In de browser gemeten
effect van de `wdth`-as alleen: **16–25% breedteverschil** tussen `wdth 100`
en `wdth 84` bij dezelfde tekst, ruim boven de meetbaarheidsdrempel.

Andere geschikte fonts (zelf controleren met bovenstaande methode): Inter
Variable (heeft géén `wdth`-as in de standaard Google Fonts-distributie —
niet geschikt zonder aanpassing), Roboto Flex (heeft `wdth`), Fraunces
(heeft `wdth`). Kies een font met minstens `wght` + `wdth`; `opsz` is een
mooie bonus maar niet vereist (de CSS negeert een ontbrekende as stilzwijgend).

## Op WordPress

Geen build-stap nodig — `kinetic-type.js` is een kant-en-klare ES-module.
De 408 KB variabele TTF uit `fonts/` moet wél mee — vergeet die niet bij het
kopiëren.

**1. Bestanden plaatsen** — zet de hele map (inclusief `fonts/`) in je thema:

```
wp-content/themes/<jouw-thema>/component-library/kinetic-type/
├── kinetic-type.css
├── kinetic-type.js
└── fonts/
    ├── BricolageGrotesque-Variable.ttf
    └── OFL.txt
```

**2. Laden als ES-module** — vanaf WordPress 6.5 met `wp_enqueue_script_module()`,
en je eigen `@font-face` (de `.ttf`-URL in de CSS is relatief aan
`kinetic-type.css` — die reist automatisch mee zolang `fonts/` naast het
CSS-bestand blijft staan):

```php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'kinetic-type-style',
		get_stylesheet_directory_uri() . '/component-library/kinetic-type/kinetic-type.css',
		array(),
		'1.0.0'
	);
	wp_enqueue_script_module(
		'kinetic-type-module',
		get_stylesheet_directory_uri() . '/component-library/kinetic-type/kinetic-type.js',
		array(),
		'1.0.0'
	);
} );
```

Voeg je eigen `@font-face` toe (met dit `wght`/`wdth`-bereik) in een klein
eigen stylesheet dat je meteen meeneemt in stap 2, of inline in je thema —
zie § Lettertype hierboven voor de exacte assen.

**3. Markup plaatsen** — `data-kinetic-type="y"`/`"x"` op je koppen, in een
Custom HTML-blok (Gutenberg), een HTML-widget (Elementor), of een template.

**4. `init()` aanroepen** ná `DOMContentLoaded`:

```html
<script type="module">
  import { init } from '/wp-content/themes/<jouw-thema>/component-library/kinetic-type/kinetic-type.js';
  document.addEventListener('DOMContentLoaded', () => {
    init(document.body);
  });
</script>
```

**Valkuilen**

- **Caching-/minify-plugins** (WP Rocket, Autoptimize, W3 Total Cache e.d.)
  bundelen JS standaard tot één niet-module-script, of strippen
  `type="module"` — dat breekt de `import`. Sluit `kinetic-type.js` uit van
  JS-combinatie/-minificatie, of laad het via `wp_enqueue_script_module()`.
- **jQuery-conflicten**: n.v.t. — geen jQuery-afhankelijkheid.
- **Media-bibliotheek in plaats van `fonts/`**: upload de `.ttf` niet los via
  de WordPress-mediabibliotheek — die serveert fonts vaak zonder de juiste
  `Content-Type`/CORS-headers voor `@font-face`. Serveer 'm als gewoon
  thema-bestand, zoals hierboven.

## Toegankelijkheid

- Puur visueel effect op al aanwezige, leesbare tekst — geen extra DOM, geen
  `aria-*` nodig. Screenreaders zien gewoon de tekst.
- **Respecteert `prefers-reduced-motion` niet apart**: het is geen
  scroll-jacking of positie-animatie, maar een continue, kleine
  typografische verandering (vergelijkbaar met een kleurovergang). Vind je
  dat voor jouw gebruikers te veel, gate de hele `init()`-aanroep zelf achter
  `!window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- Zorg voor voldoende contrast op de laagste `--kt-b` (0,4 bij de standaard-
  instellingen): tegen een lichte achtergrond (`--color-paper`-achtig) is
  dat meestal nog ruim boven WCAG AA voor grote tekst, maar controleer dit
  bij een eigen kleurkeuze.

## Browserondersteuning

Moderne evergreen browsers. Gebruikt `font-variation-settings`,
`IntersectionObserver`, `matchMedia` en CSS custom properties. Zonder
variabele-font-ondersteuning (zeldzaam in 2026) valt de tekst gewoon terug op
het statische gewicht van de font-fallback-stack — geen crash, wel geen
effect.

## Valkuilen

- **Font zonder `wdth`-as** → `--kt-wd` verandert wel (de CSS-variabele), maar
  er gebeurt niets zichtbaars. Zie "Lettertype" hierboven: altijd zelf meten,
  nooit aannemen dat "variabel" alle assen betekent.
- `xAxisBelow` moet overeenkomen met het breekpunt van een eventuele
  horizontale track eromheen (zoals `horizontal-scroll-pin`), anders meet een
  `data-kinetic-type="x"`-element op mobiel nog steeds horizontaal terwijl de
  track daar allang niet meer horizontaal scrollt.
- Heel lange woorden/zinnen met `data-kinetic-type="x"`: de breedteverandering
  bij een hoge `wght`/lage `wdth` kan de layout laten springen als er geen
  vaste breedte/centrering omheen staat. Geef de ouder `text-align: center`
  of een vaste breedte.

## Performance

- Eén gedeelde `requestAnimationFrame`-loop per `init()`-aanroep, niet per
  woord.
- De loop draait alleen terwijl minstens één van de gevolgde elementen in of
  vlak bij beeld is (`IntersectionObserver`, marge 100% boven/onder) — staat
  de pagina stil met alle woorden ver weg, dan staat de loop ook stil.
- Elementen verder dan ~2 viewports weg worden per frame overgeslagen (goedkope
  boundingClientRect-check) zonder de loop te stoppen — voorkomt onnodig werk
  bij een pagina met veel `[data-kinetic-type]`-elementen verspreid over een
  lange scroll.

## Testen

```
node test/meet.mjs
```

Volledig zelfstandig: het script start zelf een lokale statische server op
een vrije poort (poort 0 — de OS kiest, override via `MEET_PORT`) die de
hele `component-library`-map serveert, draait alle scenario's in een echte
(headless) Chromium via `_tools/browser.mjs`, en sluit de server weer af.
Exit 0 = alles geslaagd. Bewijs-screenshots staan in `test/bewijs/`.

## Wijziging 22-09-2026: `xAxisBelow` (was `xAxisBreakpoint`)

De optie heette eerst `xAxisBreakpoint` en nam een complete media-query-string
(`"(max-width: 52rem)"`). Hernoemd naar `xAxisBelow`, dat een kale CSS-lengte
neemt (`"52rem"`) — duidelijker, en consistent met hoe `horizontal-scroll-pin`
zijn eigen `breakpoint`-optie benoemt. De oude naam blijft werken als alias
(geeft voorrang als je 'm toch meegeeft), zodat een bestaande integratie niet
stilzwijgend breekt.

**Bevestigd tegen de bron**: de standaardwaarde (`52rem`, val terug op de
y-as-formule met `yFactor: 0.6`) is precies wat `PageMotion` in de bron doet
(`"x"!==e.dataset.kinetic||t()` — `t()` is de mobiel-check — SPEC-features.md
§3.4). Met Playwright gemeten op `bouwen/lab/fares-template` op 390×844: een
`data-kinetic-type="x"`-element midden in het beeldvlak (verticaal) kreeg
`--kt-w:800 --kt-wd:84.0 --kt-b:1.000` — exact de "gecentreerd"-vloerwaarden,
identiek aan hoe een y-as-element zich gedraagt. Zie `test/meet.mjs` run 4.

## Herkomst

Techniek gezien op faresmasharawi.nl (22-09-2026), de koppen in de sectie
"Dit kan ik voor je doen:". Eigen implementatie op basis van geobserveerd
gedrag — geen geminificeerde code overgenomen. Zie
`bouwen/tools/clone-knowledge/bron-artefacten/faresmasharawi/LIMA-RECON.md`
§ PageMotion en CSS `.kinetic` voor de brondocumentatie. Lettertype: Bricolage
Grotesque, SIL Open Font License 1.1, via `google/fonts` (`ofl/bricolagegrotesque`).
