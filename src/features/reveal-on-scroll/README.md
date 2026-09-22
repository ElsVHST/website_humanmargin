# reveal-on-scroll

Elementen met `data-reveal` komen in beeld met een fade + lichte verschuiving
(omhoog / van links / van rechts), met instelbare vertraging per element.
Zonder JavaScript is alles gewoon meteen zichtbaar.

## Wanneer wel

- Sectie-koppen, kaartrijen, losse blokken die je bij het scrollen wilt laten
  "aankomen" — een standaard, lichte in-view-onthulling.
- Content die **direct leesbaar moet blijven** als JS uitstaat of faalt
  (progressive enhancement, geen layout-shift zonder JS).

## Wanneer niet

- Voor tekst die woord-voor-woord moet oplichten tijdens het scrollen (dat is
  `story-word-light`), of voor een lettergewijze intro-animatie (`hero-motion`).
- Niet voor tientallen elementen tegelijk op één scherm — bij te veel
  gelijktijdige reveals oogt een pagina onrustig. Richtlijn: 3–8 reveals per
  viewport.

## Installatie

```
component-library/scroll/reveal-on-scroll/
├── reveal-on-scroll.js      # vanilla ES-module, 0 dependencies
├── reveal-on-scroll.css     # namespaced op data-attributen
├── RevealOnScroll.tsx       # React/Next.js client-wrapper
├── demo.html                # zelfstandige demo
└── test/meet.mjs            # Playwright-meting
```

**Vanilla / elk framework**

```html
<link rel="stylesheet" href="./reveal-on-scroll.css" />
<script type="module">
  import { init } from './reveal-on-scroll.js';
  const destroy = init(document.querySelector('#content'));
  // destroy() bij unmount / opruimen
</script>
```

**React / Next.js (App Router)**

```tsx
import { RevealOnScroll } from '@/component-library/scroll/reveal-on-scroll/RevealOnScroll';

<RevealOnScroll>
  <h2 data-reveal>Titel</h2>
  <p data-reveal data-reveal-delay="0.1">Tekst die iets later komt.</p>
</RevealOnScroll>
```

## Markup-contract

- Root-element: het element dat je aan `init(root)` geeft (of de wrapper-div
  van `<RevealOnScroll>`). De module zet hierop **twee** attributen, in twee
  fasen — **die attributen zijn samen de `.js`-gating**: zonder JS (of vóór
  init) bestaat geen van beide, en toont de CSS alles gewoon.
  1. `data-ros-hidden` — synchroon, zodra `init()` loopt: zet de verborgen
     staat (opacity 0 + verschuiving) direct, zónder transition.
  2. `data-ros-active` — één animatieframe later: schakelt pas dán de
     transition in. Dit voorkomt dat het verbergen zelf zichtbaar animeert
     (een "reveal in omgekeerde richting"-flits bij het opstarten) — zie
     Valkuilen.
- Onthulbare elementen: `data-reveal` (= richting "omhoog", standaard),
  `data-reveal="left"` of `data-reveal="right"`.
- Per-element vertraging (optioneel): `data-reveal-delay="0.2"` (seconden,
  als getal zonder eenheid). De module zet dit om naar de CSS-variabele
  `--reveal-delay`. Je mag die variabele ook rechtstreeks via inline
  `style="--reveal-delay: .2s"` zetten — de JS overschrijft hem alleen als
  `data-reveal-delay` aanwezig is.
- Elementen mogen genest zijn — `init()` zoekt met `querySelectorAll` binnen
  de root, dus een `data-reveal` op elke diepte werkt.

## Op WordPress

Geen build-stap nodig — `reveal-on-scroll.js` is een kant-en-klare ES-module.

**1. Bestanden plaatsen** — zet de map in je thema (of een eigen plugin):

```
wp-content/themes/<jouw-thema>/component-library/reveal-on-scroll/
├── reveal-on-scroll.css
└── reveal-on-scroll.js
```

**2. Laden als ES-module** — vanaf WordPress 6.5 met `wp_enqueue_script_module()`:

```php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'reveal-on-scroll-style',
		get_stylesheet_directory_uri() . '/component-library/reveal-on-scroll/reveal-on-scroll.css',
		array(),
		'1.0.0'
	);
	wp_enqueue_script_module(
		'reveal-on-scroll-module',
		get_stylesheet_directory_uri() . '/component-library/reveal-on-scroll/reveal-on-scroll.js',
		array(),
		'1.0.0'
	);
} );
```

Op WordPress < 6.5 laad je de module via `wp_footer` of een Custom HTML-blok
met `<script type="module">`.

**3. Markup plaatsen** — `data-reveal`/`data-reveal="left"`/`"right"` op
losse blokken, kaarten of secties, in een Custom HTML-blok (Gutenberg), een
HTML-widget (Elementor), of een template. Omdat `init()` met
`querySelectorAll` binnen de root zoekt, mag je `document.body` als root
gebruiken (zie stap 4) en het attribuut vrij verspreiden over de hele
pagina-content, ook content die uit losse Gutenberg-blokken komt.

**4. `init()` aanroepen** ná `DOMContentLoaded`:

```html
<script type="module">
  import { init } from '/wp-content/themes/<jouw-thema>/component-library/reveal-on-scroll/reveal-on-scroll.js';
  document.addEventListener('DOMContentLoaded', () => {
    init(document.body);
  });
</script>
```

**Valkuilen**

- **Caching-/minify-plugins** (WP Rocket, Autoptimize, W3 Total Cache e.d.)
  bundelen JS standaard tot één niet-module-script, of strippen
  `type="module"` — dat breekt de `import`. Sluit `reveal-on-scroll.js` uit
  van JS-combinatie/-minificatie, of laad het via `wp_enqueue_script_module()`.
- **jQuery-conflicten**: n.v.t. — geen jQuery-afhankelijkheid.
- **Lazy-load-plugins voor afbeeldingen** kunnen de layout nog laten
  verschuiven ná de reveal-animatie (afbeelding laadt pas later in). Geef
  afbeeldingen binnen een `data-reveal`-blok altijd `width`/`height` (of
  `aspect-ratio`) mee, zodat er geen ruimte "opspringt" na de onthulling.

## Opties (`init(root, options)`), met standaardwaarden

| Optie | Standaard | Omschrijving |
|---|---|---|
| `selector` | `"[data-reveal]"` | CSS-selector voor de te onthullen elementen. |
| `threshold` | `0.18` | IntersectionObserver-threshold. |
| `rootMargin` | `"0px 0px -18% 0px"` | IntersectionObserver-rootMargin — triggert iets vóór het element volledig in beeld is. |
| `once` | `true` | Na onthullen niet opnieuw verbergen bij uitscrollen. Zet op `false` voor een herhaalbare reveal. |

CSS-variabelen (op `[data-reveal]`, override per element of globaal):

| Variabele | Standaard | Omschrijving |
|---|---|---|
| `--ros-duration` | `0.95s` | Transitieduur. |
| `--ros-ease` | `cubic-bezier(.22,1,.36,1)` | Easing (ease-out-quint). |
| `--ros-up` | `2.75rem` | Verschuiving bij `data-reveal` (omhoog). |
| `--ros-side-x` | `5.5rem` | Horizontale verschuiving bij `left`/`right`. |
| `--ros-side-y` | `3.25rem` | Verticale verschuiving bij `left`/`right`. |
| `--reveal-delay` | `0s` | Per-element vertraging (zie hierboven). |

## Toegankelijkheid

- Puur visueel: geen `aria-*`-aanpassingen nodig, de tekst zelf verandert
  niet. Screenreaders zien de content zoals hij in de DOM staat.
- `prefers-reduced-motion: reduce` → alle elementen krijgen direct
  `opacity: 1; transform: none` zonder transitie, en de module slaat de
  IntersectionObserver over (geen onnodig werk).
- Focus-volgorde verandert niet: reveal is puur opacity/transform, geen
  `display`/`visibility`-toggle, dus toetsenbordnavigatie blijft normaal
  werken ook vóórdat een element "in beeld" is geweest.

## Browserondersteuning

IntersectionObserver (alle moderne browsers). Bij afwezigheid (zeer oude
browser) valt de module terug op meteen alles tonen — geen observer, geen
fout.

## Valkuilen

- **Transitie op het verbergen zelf voorkomen.** Eerdere, eenvoudigere versie
  van deze module zette één attribuut synchroon, mét transition erop — de
  browser zag dat dan als een echte waardewijziging (opacity 1 → 0) en
  animeerde het verbergen zelf zichtbaar (een korte "omgekeerde reveal"-flits
  bij het laden). Vandaar de twee-fasen-aanpak (`data-ros-hidden` synchroon
  zonder transition, `data-ros-active` een frame later mét transition) —
  gemeten met Playwright: zonder deze scheiding stond een element buiten
  beeld na 150ms nog op opacity ≈0,38 in plaats van 0.
- **Vergeet de CSS niet te laden.** Zonder `reveal-on-scroll.css` hebben de
  `data-ros-*`-attributen geen effect en blijft alles gewoon zichtbaar
  (onschuldig, maar dan mis je de animatie).
- **`root` moet vóór `init()` al de `data-reveal`-elementen bevatten.** De
  module zoekt ze één keer bij het opstarten; dynamisch toegevoegde
  elementen daarna worden niet automatisch opgepikt — roep `destroy()` +
  `init()` opnieuw aan, of observeer ze zelf.
- **`once:false` + snel op/neer scrollen** kan drukke transitions geven bij
  veel elementen tegelijk; gebruik dit bewust, niet als default.

## Performance

Alleen een IntersectionObserver-callback (geen scroll-listener, geen rAF-lus)
— de browser doet het meet-werk zelf, buiten het hoofdproces om. `once:true`
(standaard) ontkoppelt elk element van de observer zodra het onthuld is.

## Herkomst

Techniek gezien op faresmasharawi.nl (22-09-2026) — daar heet de mechaniek
`RevealObserver` (IntersectionObserver, dezelfde threshold/rootMargin,
`.js`-klasse op `<html>` voor de no-JS-fallback). Eigen implementatie: geen
code overgenomen; de `.js`-gating is hier verplaatst van een globale
`<html>`-klasse naar een per-instantie attribuut op de root, zodat de module
zonder gedeelde globale state werkt.
