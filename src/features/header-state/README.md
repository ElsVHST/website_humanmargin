# header-state

Zet een klasse op de header zodra de bezoeker voorbij een drempel van de
eerste viewport is gescrold (standaard 75% van `window.innerHeight`). Los te
gebruiken naast `hero-motion` — deel geen state, elke module heeft zijn
eigen scroll-listener.

## Wanneer wel

- Een header die compacter moet worden, van kleur moet wisselen, of
  onderdelen moet laten verdwijnen (logo, secundaire CTA) zodra de hero
  achter je ligt.
- Losstaand van een hero-recede-effect — je hoeft `hero-motion` niet te
  gebruiken om dit in te zetten.

## Wanneer niet

- Niet voor een progress-afhankelijke animatie (0..1 over de hele hero) —
  dat is een binaire aan/uit-klasse, geen doorlopende transform. Voor dat
  laatste: `hero-motion`.
- Niet voor headers die niet `position: fixed`/`sticky` zijn — de klasse
  heeft dan geen visueel nut (de header scrollt toch al mee).

## Installatie

```
component-library/scroll/header-state/
├── header-state.js      # vanilla ES-module, 0 dependencies
├── header-state.css     # voorbeeld-toepassing, pas aan naar eigen opmaak
├── HeaderState.tsx       # React/Next.js client-wrapper (rendert <header>)
├── demo.html             # zelfstandige demo met live status-indicator
└── test/meet.mjs         # Playwright-meting
```

**Vanilla / elk framework**

```html
<header data-header class="mijn-header">…</header>
<script type="module">
  import { init } from './header-state.js';
  const destroy = init(document.querySelector('[data-header]'));
</script>
```

**React / Next.js (App Router)**

```tsx
import { HeaderState } from '@/component-library/scroll/header-state/HeaderState';

<HeaderState>
  <a href="#top" data-hs-fade>Logo</a>
  <a href="#contact" className="cta">Contact</a>
</HeaderState>
```

`<HeaderState>` rendert zelf het `<header>`-element (met `position: fixed`
uit `header-state.css`) en beheert de scroll-listener via `useEffect`.

## Markup-contract

- Root: het header-element zelf (rechtstreeks aan `init()` gegeven, of het
  element dat `<HeaderState>` rendert).
- De module zet/verwijdert uitsluitend de klasse `is-past-hero`
  (configureerbaar) op dat ene element — verder geen DOM-mutaties.
- Kinderen die moeten reageren: `data-hs-fade` (voorbeeld-CSS in
  `header-state.css`); volledig optioneel, de module zelf weet niets van
  kinderen.

## Op WordPress

Geen build-stap nodig — `header-state.js` is een kant-en-klare ES-module.

**1. Bestanden plaatsen** — zet de map in je thema (of een eigen plugin):

```
wp-content/themes/<jouw-thema>/component-library/header-state/
├── header-state.css
└── header-state.js
```

**2. Laden als ES-module** — vanaf WordPress 6.5 met `wp_enqueue_script_module()`:

```php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'header-state-style',
		get_stylesheet_directory_uri() . '/component-library/header-state/header-state.css',
		array(),
		'1.0.0'
	);
	wp_enqueue_script_module(
		'header-state-module',
		get_stylesheet_directory_uri() . '/component-library/header-state/header-state.js',
		array(),
		'1.0.0'
	);
} );
```

Op WordPress < 6.5 laad je de module via `wp_footer` of een Custom HTML-blok
met `<script type="module">`.

**3. Markup plaatsen** — dit component werkt op het bestaande thema-header-
element, dus meestal pas je `header.php` (of het header-template-part) aan
in plaats van een Custom HTML-blok te gebruiken. Zoek het element dat je
thema als `<header>` rendert (vaak al met een eigen class) en geef het het
attribuut/selector dat je aan `init()` doorgeeft.

**4. `init()` aanroepen** ná `DOMContentLoaded`:

```html
<script type="module">
  import { init } from '/wp-content/themes/<jouw-thema>/component-library/header-state/header-state.js';
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header.site-header');
    if (header) init(header);
  });
</script>
```

**Valkuilen**

- **Caching-/minify-plugins** (WP Rocket, Autoptimize, W3 Total Cache e.d.)
  bundelen JS standaard tot één niet-module-script, of strippen
  `type="module"` — dat breekt de `import`. Sluit `header-state.js` uit van
  JS-combinatie/-minificatie, of laad het via `wp_enqueue_script_module()`.
- **jQuery-conflicten**: n.v.t. — geen jQuery-afhankelijkheid. Veel
  WordPress-thema's laden wél standaard jQuery voor hun eigen sticky-header-
  script; laat dat script uit als je dit component gebruikt, anders vechten
  twee scripts om dezelfde klasse/stijl op de header.
- **Een thema dat de header via een Gutenberg full-site-editing
  header-template rendert**: die template kan bij elke navigatie opnieuw
  hydrateren; roep `init()` dan opnieuw aan ná elke render, of controleer
  eerst of de header al een instantie heeft (zie de `destroy()`-terugkeer
  van `init()` om een dubbele instantie op te ruimen).

## Opties (`init(root, options)`), met standaardwaarden

| Optie | Standaard | Omschrijving |
|---|---|---|
| `threshold` | `0.75` | Fractie van `window.innerHeight` waarna de klasse aangaat. |
| `activeClass` | `"is-past-hero"` | Klassenaam die aan/uit gaat. |

## Toegankelijkheid

- De klasse verandert alleen visuele eigenschappen (opacity/transform via je
  eigen CSS); `data-hs-fade`-elementen krijgen `pointer-events: none` zodra
  ze verborgen zijn, zodat ze geen onzichtbare klikdoelen achterlaten.
- Geen `aria-hidden` nodig zolang de content zelf niet verdwijnt uit de
  toegankelijkheidsboom — voeg dat zelf toe als je een element ook echt wilt
  laten verdwijnen voor screenreaders (`aria-hidden="true"` in combinatie
  met de klasse-toggle, niet door deze module gedaan).
- `prefers-reduced-motion: reduce`: de transitie in `header-state.css` valt
  terug op een korte opacity-fade zonder verschuiving; de klasse-logica zelf
  verandert niet (het is een drempel, geen doorlopende animatie).

## Browserondersteuning

`requestAnimationFrame` + `scroll`/`resize`-events (alle moderne browsers).
Geen IntersectionObserver nodig, geen polyfill vereist.

## Valkuilen

- **Twee modules op dezelfde pagina, zelfde header**: als je zowel
  `header-state` als een eigen scroll-hero-recede gebruikt, geef ze dan
  duidelijk verschillende taken (deze module raakt alleen de header aan,
  nooit hero-content) om dubbele class-toggles te voorkomen.
- **`threshold` op 0 of negatief** laat de klasse vanaf het begin actief
  zijn — bedoeld gedrag, maar niet de standaard use-case.
- **rAF-throttling**: de listener meet niet bij elk scroll-event maar bij
  de eerstvolgende animatieframe; bij zeer snelle programmatische scrolls
  (`scrollTo` zonder `behavior: "smooth"`) kan de klasse één frame later
  wisselen dan de scrollpositie zelf. In de praktijk onmerkbaar.

## Performance

Eén `scroll`- en `resize`-listener (`passive: true`), rAF-throttled, met een
vroege exit als de berekende staat niet verandert (geen onnodige
`classList`-writes). Geen rAF-lus die doorloopt buiten scroll-events.

## Herkomst

Techniek gezien op faresmasharawi.nl (22-09-2026) — daar toggelt
`PageMotion` de klasse `is-past-hero` op `[data-site-header]` als onderdeel
van dezelfde rAF-lus als de hero-recede en de storyline. Eigen
implementatie: hier losgetrokken tot een eigen, onafhankelijke module met
zijn eigen listener, zodat je hem kunt gebruiken zonder de rest van
`hero-motion`.
