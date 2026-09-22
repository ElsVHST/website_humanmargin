# horizontal-scroll-pin

Na een introsectie scrol je verder omlaag, maar de volgende sectie blijft
staan (`position: sticky`) terwijl een rij panelen erin horizontaal
doorschuift. Drie (of meer) woorden bovenin zijn klikbaar, lichten op voor het
actieve paneel, en dunne segmentbalkjes eronder vullen zich mee met de
voortgang. Onder een breedte-drempel (standaard 52rem) is er geen pin meer:
de panelen worden een gewone, native horizontaal scrollbare rij met
scroll-snap.

Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026, sectie "Dit kan ik
voor je doen"), eigen implementatie — geen code overgenomen.

## Wanneer wel

- Een aanbod, portfolio of stappenreeks van 3–5 items die je met opzet één
  voor één wilt tonen, met een duidelijk gevoel van "vastzitten en dan
  verder".
- Je hebt controle over de sectiehoogte (de truc werkt via extra scrolruimte
  boven op 100vh — geen los iframe, geen canvas).

## Wanneer niet

- Meer dan ~5 panelen: de sectie wordt dan erg lang te scrollen op desktop
  (elk paneel kost `vhPerPanel` extra scrolhoogte). Overweeg dan een gewone
  carrousel of tabs.
- Content die zelf al verticaal scrolt (lange teksten, formulieren) past
  slecht in een paneel van exact 100vh/100vw.
- Als de sectie de enige interessante content op de pagina is en "vastzitten"
  vooral irritant aanvoelt op mobiel — bedenk dat het component daar toch al
  automatisch uitschakelt, dus dit is vooral een desktop-afweging.

## Installatie

Kopieer de map naar je project (geen package, geen dependency):

```
horizontal-scroll-pin/
├── horizontal-scroll-pin.js
├── horizontal-scroll-pin.css
└── HorizontalScrollPin.tsx   (alleen nodig in een React/Next.js-project)
```

Vanilla:

```html
<link rel="stylesheet" href="./horizontal-scroll-pin.css" />
<script type="module">
	import { init } from "./horizontal-scroll-pin.js";
	const destroy = init(document.querySelector("[data-scroll-pin]"));
	// destroy() aanroepen bij unmount / paginawissel in een SPA
</script>
```

React / Next.js App Router:

```tsx
"use client";
import { HorizontalScrollPin } from "@/component-library/scroll/horizontal-scroll-pin/HorizontalScrollPin";

<HorizontalScrollPin
	labelledBy="aanbod-kop"
	panels={[
		{ word: "Verkennen", content: <PanelEen /> },
		{ word: "Vormgeven", content: <PanelTwee /> },
		{ word: "Opleveren", content: <PanelDrie /> },
	]}
/>;
```

## Markup-contract (vanilla)

```html
<section data-scroll-pin aria-labelledby="aanbod-kop">
	<div data-scroll-pin-sticky>
		<!-- eigen koptekst (h2 e.d.) mag hier los naast de nav staan -->
		<nav data-scroll-pin-nav aria-label="Ga naar paneel">
			<button type="button" data-scroll-pin-word class="is-active">Verkennen</button>
			<button type="button" data-scroll-pin-word>Vormgeven</button>
			<button type="button" data-scroll-pin-word>Opleveren</button>
		</nav>
		<ul data-scroll-pin-track aria-label="Drie panelen">
			<li data-scroll-pin-panel>…paneel 1…</li>
			<li data-scroll-pin-panel>…paneel 2…</li>
			<li data-scroll-pin-panel>…paneel 3…</li>
		</ul>
		<div data-scroll-pin-seg aria-hidden="true">
			<span><i></i></span>
			<span><i></i></span>
			<span><i></i></span>
		</div>
	</div>
</section>
```

Regels:

- Het aantal `[data-scroll-pin-word]`, `[data-scroll-pin-panel]` en
  `[data-scroll-pin-seg] span` moet gelijk zijn (1 per paneel), in dezelfde
  volgorde.
- `[data-scroll-pin-word]` zijn `<button type="button">`s — geen `<span>` met
  een click-listener (dat was de bron; toetsenbord/focus werkte daar niet).
- `init(root)` verwacht `root` = het `[data-scroll-pin]`-element zelf.
- Paneelinhoud is vrije vorm — het component regelt alleen het scrollgedrag.
  `demo.html` laat één concrete invulling zien (tekstkolom met kinetic-kop,
  subkop, korte tekst, twee label/waarde-rijen en een knop, naast een
  beeldvlak met vaste beeldverhouding), maar dat is een keuze van de
  consument, geen contract.

## Op WordPress

Geen build-stap nodig — `horizontal-scroll-pin.js` is een kant-en-klare
ES-module.

**1. Bestanden plaatsen** — zet de map in je thema (of een eigen plugin):

```
wp-content/themes/<jouw-thema>/component-library/horizontal-scroll-pin/
├── horizontal-scroll-pin.css
└── horizontal-scroll-pin.js
```

**2. Laden als ES-module** — vanaf WordPress 6.5 met `wp_enqueue_script_module()`:

```php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'scroll-pin-style',
		get_stylesheet_directory_uri() . '/component-library/horizontal-scroll-pin/horizontal-scroll-pin.css',
		array(),
		'1.0.0'
	);
	wp_enqueue_script_module(
		'scroll-pin-module',
		get_stylesheet_directory_uri() . '/component-library/horizontal-scroll-pin/horizontal-scroll-pin.js',
		array(),
		'1.0.0'
	);
} );
```

Op WordPress < 6.5 (geen `wp_enqueue_script_module()`) laad je de module via
`wp_footer` of rechtstreeks in een Custom HTML-blok met `<script type="module">`.

**3. Markup plaatsen** — het `[data-scroll-pin]`-contract hierboven in een
Custom HTML-blok (Gutenberg), een HTML-widget (Elementor), of een template.
Gebruik je ook `typography/kinetic-type` voor de paneelkoppen (zoals
`demo.html` doet), enqueue die CSS/JS dan apart volgens diens eigen
WordPress-sectie — dit onderdeel weet niets van kinetic-type en werkt ook
prima met gewone koppen.

**4. `init()` aanroepen** ná `DOMContentLoaded`:

```html
<script type="module">
  import { init } from '/wp-content/themes/<jouw-thema>/component-library/horizontal-scroll-pin/horizontal-scroll-pin.js';
  document.addEventListener('DOMContentLoaded', () => {
    const section = document.querySelector('[data-scroll-pin]');
    if (section) init(section);
  });
</script>
```

**Valkuilen**

- **Caching-/minify-plugins** (WP Rocket, Autoptimize, W3 Total Cache e.d.)
  bundelen JS standaard tot één niet-module-script, of strippen
  `type="module"` — dat breekt de `import`. Sluit `horizontal-scroll-pin.js`
  uit van JS-combinatie/-minificatie, of laad het via
  `wp_enqueue_script_module()`.
- **jQuery-conflicten**: n.v.t. — geen jQuery-afhankelijkheid.
- **Page-builder-secties met eigen `overflow`/`height`**: sommige
  Elementor/Divi-sectiewrappers zetten zelf `overflow: hidden` of een vaste
  hoogte op de container — dat botst met de `position: sticky`/`height:
  calc()` die dit component op `[data-scroll-pin]` zelf zet. Plaats het
  markup daarom in een "gewone" container zonder page-builder-eigen
  overflow-instellingen, of test de pin-modus na het slepen in de builder.

## Opties

`init(root, options)`:

| Optie | Standaard | Betekenis |
|---|---|---|
| `breakpoint` | `"(max-width: 52rem)"` | Media query waaronder de pin uitgeschakeld wordt. **Moet overeenkomen** met de `max-width` in de CSS (zie Valkuilen). |
| `lerp` | `0.14` | Uitdemp-factor per frame (0–1) voor de translateX. `1` = geen vertraging. |
| `wheelMultiplier` | `1.3` | Vermenigvuldiger voor zijwaarts scrollen (trackpad-swipe) omgezet naar verticale `scrollBy`. |
| `vhPerPanel` | `115` | Extra scrolhoogte per paneel na het eerste, in vh. Bepaalt het tempo. |

CSS-variabelen (op `[data-scroll-pin]` of een voorouder):

| Variabele | Standaard | Betekenis |
|---|---|---|
| `--scroll-pin-word-color` | `rgb(16 16 16 / 0.16)` | Kleur van een inactief woord. |
| `--scroll-pin-word-hover` | `rgb(16 16 16 / 0.5)` | Kleur bij hover. |
| `--scroll-pin-word-active` | `#101010` | Kleur van het actieve woord. |
| `--scroll-pin-seg-track` | `rgb(16 16 16 / 0.12)` | Achtergrond van een segmentbalkje. |
| `--scroll-pin-seg-fill` | `#101010` | Vulkleur van een segmentbalkje. |
| `--scroll-pin-panel-gap` | `1rem` | Ruimte tussen panelen in de mobiele (native-scroll) modus. |
| `--scroll-pin-inline-padding` | `clamp(1.25rem, 4vw, 2.5rem)` | Zijmarge van de segmentbalk boven het breekpunt. |
| `--scroll-pin-inline-offset` | `clamp(1.25rem, 4vh, 2.5rem)` | Afstand van de segmentbalk tot de onderkant; wordt ook hergebruikt als paneel-padding boven/onder (ruimte voor een zwevende kop en de segmentbalk) — zie "Valkuilen". |

## Toegankelijkheid

- Navigatiewoorden zijn echte `<button>`s: bereikbaar met Tab, activeerbaar
  met Enter/Space, met een zichtbare `:focus-visible`-ring. (De bron gebruikte
  `<span>` met alleen een click-listener — geen toetsenbordtoegang.)
- **Verbetering t.o.v. de bron**: Tab-en in een paneel (`focusin` op een link
  of knop daarbinnen) brengt dat paneel automatisch in beeld, zowel op
  desktop (scrollt de pagina) als mobiel (`scrollIntoView`). Zo blokkeert de
  pin niet de toetsenbordnavigatie door de inhoud.
- `[data-scroll-pin-seg]` heeft `aria-hidden="true"`: het is puur decoratief,
  de voortgang is al af te lezen aan welk woord actief is.
- Respecteert `prefers-reduced-motion: reduce`: geen lerp (directe snap per
  frame), geen zijwaartse-wheel-onderschepping, en de klik-scroll gebruikt
  `behavior: "auto"` (geen smooth-scroll-animatie).
- `<ul aria-label="…">` / `<nav aria-label="…">`: geef zelf een zinvol label
  mee dat past bij de content.

## Browserondersteuning

Moderne evergreen browsers (Chrome/Edge/Safari/Firefox, laatste 2 major
versies). Gebruikt `IntersectionObserver`, `matchMedia`, CSS `sticky`,
`scroll-snap-type` en `window.scrollTo({behavior})`. Geen polyfills
meegeleverd.

## Valkuilen

- **`breakpoint`-optie en CSS-media-query moeten synchroon lopen.** Verander
  je de JS-optie, pas dan ook de `max-width`/`min-width`-waarden in
  `horizontal-scroll-pin.css` aan (regel 18 en 27 e.v.). Ze zijn bewust niet
  aan elkaar gekoppeld (CSS kan geen JS-variabele lezen).
- **Progressive enhancement is verplicht ingebouwd, niet optioneel.** De
  CSS-standaard (zonder het attribuut `data-scroll-pin-pinned`) is op elke
  breedte de gewone, native horizontaal scrollbare rij met scroll-snap —
  zonder JS, vóór hydratie, of als `init()` om wat voor reden dan ook niet
  draait, blijven paneel 2 en 3 dus altijd bereikbaar via een gewone
  scroll/swipe. Pas zodra `init()` vaststelt dat de viewport niet-mobiel is,
  zet de module zelf `data-scroll-pin-pinned` op `[data-scroll-pin]`, en pas
  dán schakelt de CSS naar de vastgezette pin-modus met de `calc()`-hoogte op
  basis van `--scroll-pin-panels`. Zet dit attribuut nooit zelf in je markup —
  het is puur een door JS beheerde runtime-vlag.
- Op desktop is `[data-scroll-pin-track]` zelf `position: absolute; inset: 0`,
  zodat hij altijd de volle 100% hoogte van de sticky-wrapper gebruikt,
  ongeacht wat er verder nog in `[data-scroll-pin-sticky]` staat. De
  segmentbalk zweeft er bewust ook zelf als `position: absolute` overheen
  (onderin) — de **nav positioneert deze CSS niet**: die blijft gewoon in de
  flow, zodat je 'm samen met een eigen koptekst op één regel kunt zetten
  (zoals de bron, zie `demo.html`: een eigen `.demo-head`-wrapper die op
  desktop `position: absolute` boven de track zweeft, met
  `pointer-events: none` op de wrapper en `pointer-events: auto` alleen op de
  knoppen, zodat paneelinhoud eronder klikbaar blijft).
- `[data-scroll-pin-panel]` krijgt op desktop een standaard `display: flex;
  align-items: center;` plus verticale padding (`--scroll-pin-inline-offset`)
  zodat paneelinhoud gecentreerd staat tussen een zwevende kop en de
  segmentbalk. Heeft je eigen kop een andere hoogte, overschrijf dan gewoon
  `padding-block` op `[data-scroll-pin-panel]` met een specifiekere regel.
- Wil je meer of minder dan 3 panelen? Gewoon meer `<li data-scroll-pin-panel>`
  + bijpassend aantal `[data-scroll-pin-word]` en seg-`<span>`s toevoegen —
  de JS leest het aantal panelen dynamisch uit de track.

## Performance

- De rAF-loop (desktop-modus) draait alleen terwijl de sectie in of vlak bij
  beeld is (`IntersectionObserver` met een marge van 100% boven/onder) — niet
  de hele paginalevensduur.
- Op mobiel is er helemaal geen rAF-loop: de actieve index volgt native
  `scroll`-events op de track (passief, geen `preventDefault`).
- `will-change: transform` staat alleen op de track, niet op de hele sectie.

## Testen

```
node test/meet.mjs
```

Volledig zelfstandig: het script start zelf een lokale statische server op
een vrije poort (poort 0 — de OS kiest, override via `MEET_PORT`) die de
hele `component-library`-map serveert, draait alle scenario's in een echte
(headless) Chromium via `_tools/browser.mjs`, en sluit de server weer af.
Exit 0 = alles geslaagd. Bewijs-screenshots staan in `test/bewijs/`.

## Herkomst

Techniek gezien op faresmasharawi.nl (22-09-2026), sectie "Dit kan ik voor je
doen:". Eigen implementatie op basis van geobserveerd gedrag — geen
geminificeerde code overgenomen. Zie
`bouwen/tools/clone-knowledge/bron-artefacten/faresmasharawi/LIMA-RECON.md`
§ PageMotion voor de brondocumentatie.
