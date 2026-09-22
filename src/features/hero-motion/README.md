# hero-motion

Twee samenhangende effecten voor een hero-sectie:

1. **Intro**: de koptekst rijst letter voor letter op uit een masker (per
   regel `overflow:hidden`, elke letter `translateY(105%) → 0`, gestaggerd),
   terwijl de overige hero-elementen (subtekst, knoppen, logo's, …) infaden.
2. **Recede**: bij wegscrollen (over de eerste viewport-hoogte) schuift de
   hero-tekst omhoog en krimpt licht, het beeld iets sterker, en de hele
   stage vervaagt.

De header-toestand ("is de bezoeker voorbij de hero") is bewust **geen**
onderdeel van dit component — dat is de losstaande module `header-state`
(zelfde map-niveau), zodat je hem onafhankelijk kunt gebruiken.

## Wanneer wel

- Een hero met één centrale claim (1–2 regels) die je een sterke, eenmalige
  entree wilt geven bij het laden van de pagina.
- Een hero die "meebeweegt" met de eerste scroll, in plaats van abrupt uit
  beeld te verdwijnen.

## Wanneer niet

- Niet voor lange koppen (meer dan ~2 regels/10 woorden) — de letter-voor-
  letter-intro wordt dan traag en afleidend.
- Niet voor een kop met veel geneste interactieve elementen (zie Valkuilen
  — links middenin een regel worden gefragmenteerd).
- Niet als losse bouwsteen voor woord-voor-woord-oplichten tijdens scrollen
  (dat is `story-word-light`) of voor een generieke in-view-reveal (dat is
  `reveal-on-scroll`).

## Installatie

```
component-library/scroll/hero-motion/
├── hero-motion.js       # vanilla ES-module, 0 dependencies
├── hero-motion.css      # namespaced op .hm-* / [data-hero-fade]
├── HeroMotion.tsx        # React/Next.js client-wrapper
├── demo.html              # zelfstandige demo
└── test/meet.mjs          # Playwright-meting
```

**Vanilla / elk framework**

```html
<link rel="stylesheet" href="./hero-motion.css" />

<div data-hero-stage>
  <div class="stage-grid">
    <div data-hero-copy>
      <h1 data-hero-heading>
        <span data-hero-line>Bouw dingen</span>
        <span data-hero-line>die blijven werken.</span>
      </h1>
      <p data-hero-fade>Korte subtekst.</p>
      <a href="#" data-hero-fade>Call to action</a>
    </div>
    <div data-hero-figure>
      <img src="/beeld.jpg" alt="…" />
    </div>
  </div>
</div>

<script type="module">
  import { init } from './hero-motion.js';
  const destroy = init(document.querySelector('[data-hero-stage]'));
</script>
```

**React / Next.js (App Router)**

```tsx
import { HeroMotion } from '@/component-library/scroll/hero-motion/HeroMotion';

<HeroMotion className="stage-grid">
  <div data-hero-copy>
    <h1 data-hero-heading>
      <span data-hero-line>Bouw dingen</span>
      <span data-hero-line>die blijven werken.</span>
    </h1>
    <p data-hero-fade>Korte subtekst.</p>
    <a href="#" data-hero-fade>Call to action</a>
  </div>
  <div data-hero-figure>
    <img src="/beeld.jpg" alt="…" />
  </div>
</HeroMotion>
```

`<HeroMotion>` rendert zelf de `data-hero-stage`-div (waarop de recede-
opacity landt); de rest van de structuur (`data-hero-copy`,
`data-hero-heading`, `data-hero-line`, `data-hero-fade`, `data-hero-figure`)
lever je zelf via `children`.

## Markup-contract

- **Stage** (`init(root)` / de `<HeroMotion>`-wrapper): het element waarop
  de recede-opacity wordt gezet. Zet er `position: relative; overflow:
  hidden` op (zit al in `hero-motion.css` via `[data-hero-stage]`).
- **Kop**: `data-hero-heading` op het kopelement (bv. `<h1>`), met daarbinnen
  één of meer `data-hero-line`-elementen (één per visuele regel — de module
  kan regel-afbrekingen niet zelf detecteren, dat bepaal je zelf in je
  markup). Elke regel mag platte tekst bevatten, met optioneel
  `<em>`/`<strong>`/`<b>`/`<i>`/`<mark>` voor nadruk.
- **Al gesplitste markup** (SSR): als er binnen de kop al elementen met
  `data-hero-ch` staan, splitst de module niets — hij gebruikt ze direct.
  Zet in dat geval **zelf** `aria-label` op de kop en `aria-hidden="true"`
  op elke `data-hero-line` (de module doet dat alleen wanneer hij zelf
  splitst).
- **Fade-elementen**: `data-hero-fade` op alles wat moet infaden (subtekst,
  knoppen, logo's, …). Optioneel `data-hero-fade-delay="0.55"` (seconden)
  voor een eigen volgorde; zonder dat attribuut krijgt elk element in
  document-volgorde `fadeBase + i * fadeStep`.
- **Recede-doelen**: `data-hero-copy` (tekstblok) en `data-hero-figure`
  (beeldblok) binnen de stage. Beide optioneel — ontbreekt er een, dan
  recedet alleen wat aanwezig is; de stage-opacity werkt altijd.
- Woorden breken niet middenin over een regel-wrap: elk woord staat in een
  `white-space: nowrap`-omhulsel (`.hm-word`), losse letters blijven dus bij
  elkaar ook als de browser de regel ergens anders afbreekt dan de auteur
  verwachtte.

## Op WordPress

Geen build-stap nodig — `hero-motion.js` is een kant-en-klare ES-module.

**1. Bestanden plaatsen** — zet de map in je thema (of een eigen plugin):

```
wp-content/themes/<jouw-thema>/component-library/hero-motion/
├── hero-motion.css
└── hero-motion.js
```

**2. Laden als ES-module** — vanaf WordPress 6.5 met `wp_enqueue_script_module()`:

```php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'hero-motion-style',
		get_stylesheet_directory_uri() . '/component-library/hero-motion/hero-motion.css',
		array(),
		'1.0.0'
	);
	wp_enqueue_script_module(
		'hero-motion-module',
		get_stylesheet_directory_uri() . '/component-library/hero-motion/hero-motion.js',
		array(),
		'1.0.0'
	);
} );
```

Op WordPress < 6.5 laad je de module via `wp_footer` of een Custom HTML-blok
met `<script type="module">`.

**3. Markup plaatsen** — meestal de homepage-hero: een front-page-template
(`front-page.php`) is hier praktischer dan een Custom HTML-blok, omdat de
hero doorgaans buiten de post-content valt. Kan ook in een Custom HTML-blok
(Gutenberg) of HTML-widget (Elementor) als je hero al binnen de content zit.

**4. `init()` aanroepen** ná `DOMContentLoaded`:

```html
<script type="module">
  import { init } from '/wp-content/themes/<jouw-thema>/component-library/hero-motion/hero-motion.js';
  document.addEventListener('DOMContentLoaded', () => {
    const stage = document.querySelector('[data-hero-stage]');
    if (stage) init(stage);
  });
</script>
```

**Valkuilen**

- **Caching-/minify-plugins** (WP Rocket, Autoptimize, W3 Total Cache e.d.)
  bundelen JS standaard tot één niet-module-script, of strippen
  `type="module"` — dat breekt de `import`. Sluit `hero-motion.js` uit van
  JS-combinatie/-minificatie, of laad het via `wp_enqueue_script_module()`.
- **jQuery-conflicten**: n.v.t. — geen jQuery-afhankelijkheid.
- **Front-page.php vs. Gutenberg**: schrijft je thema de hero met PHP
  (`front-page.php`), dan is `data-hero-line`/`data-hero-ch` handmatig
  invoegen niet nodig — laat de module zelf splitsen (het standaardpad, zie
  § Markup-contract). Alleen bij een SSR-integratie die zelf al
  `data-hero-ch` rendert, moet je ook zelf `aria-label`/`aria-hidden` zetten.

## Opties (`init(root, options)`), met standaardwaarden

| Optie | Standaard | Omschrijving |
|---|---|---|
| `lineSelector` | `"[data-hero-line]"` | Selector voor regel-containers. |
| `headingSelector` | `"[data-hero-heading]"` | Selector voor de kop. |
| `fadeSelector` | `"[data-hero-fade]"` | Selector voor infade-elementen. |
| `copySelector` | `"[data-hero-copy]"` | Selector voor het recedende tekstblok. |
| `figureSelector` | `"[data-hero-figure]"` | Selector voor het recedende beeldblok. |
| `charStep` | `0.028` | Seconden stagger per niet-spatie-letter (28ms — gemeten op de bron). |
| `fadeBase` | `0.45` | Seconden vóór het eerste fade-element start. |
| `fadeStep` | `0.15` | Extra vertraging per volgend fade-element. |
| `recede` | `true` | Zet de scroll-recede aan/uit. |
| `recedeCopyVh` | `-6` | vh-verschuiving van de copy bij e=1. |
| `recedeCopyScale` | `0.05` | Schaalafname copy bij e=1 (`1 - dit getal`). |
| `recedeFigureVh` | `-10` | vh-verschuiving van de figure bij e=1. |
| `recedeFigureScale` | `0.04` | Schaalafname figure bij e=1. |
| `recedeOpacity` | `0.45` | Opacity-afname van de stage bij e=1. |

`e = clamp(scrollY / innerHeight, 0, 1)` — bij e=1 (één volledige viewport
naar beneden gescrold) is de recede compleet; verder scrollen verandert er
niets meer aan.

## Toegankelijkheid

- **Kop**: de module zet `aria-label` met de volledige, platte zin op het
  kopelement, en `aria-hidden="true"` op elke `data-hero-line` — exact het
  patroon dat de bron zelf gebruikt (`<h1 aria-label="…"><span class=
  "hero-line" aria-hidden="true">…`). Dit is nodig omdát hier per lettér
  gesplitst wordt: zonder deze override zouden sommige screenreaders de
  losse teken-`<span>`s stuk voor stuk oplezen in plaats van de hele zin
  ineens. (Bij `story-word-light`, dat per wóórd splitst, is dit niet nodig
  — zie die README.)
- **Links binnen een regel**: worden bij het splitsen gefragmenteerd tot
  opeenvolgende, los klikbare stukjes (elke letter krijgt zijn eigen kloon
  van de omringende elementen, inclusief `<a>`). Functioneel blijven ze
  klikbaar, maar een screenreader kan zo'n link meermaals aankondigen.
  **Zet interactieve elementen daarom niet binnen `data-hero-line`** — een
  CTA-knop hoort in de `data-hero-fade`-inhoud eronder, niet in de kop zelf.
- `prefers-reduced-motion: reduce`: de module **splitst de kop niet** (blijft
  platte, direct leesbare tekst, geen `aria-label`-omweg nodig) en zet geen
  recede-listener op. De CSS heeft daarnaast een eigen
  `@media (prefers-reduced-motion: reduce)`-vangnet voor het geval je zelf
  al gesplitste markup (SSR) aanlevert.

## Browserondersteuning

CSS `@keyframes` + `animation-delay` via een custom property (`--d`) — alle
moderne browsers. `IntersectionObserver` voor het aan/uit zetten van de
recede-listener; zonder support valt de module terug op een permanent
actieve (rAF-throttled) listener.

## Valkuilen

- **Regel-detectie is handmatig.** De module breekt zelf geen regels af op
  basis van gerenderde breedte — jij bepaalt met `data-hero-line` waar een
  regel eindigt. Bij een responsieve kop kan dat betekenen dat je op mobiel
  een andere regelverdeling wilt; los dat op met eigen breakpoint-markup,
  niet met CSS `white-space: normal` binnen een regel (dat breekt de
  letter-maskering).
- **`data-hero-copy`/`data-hero-figure` buiten de stage** worden genegeerd
  — ze moeten binnen het element staan dat je aan `init()` geeft.
  `querySelector` (niet `querySelectorAll`) pakt de eerste match; gebruik
  per stage maximaal één van elk.
- **Zelf een `--d` zetten vóór `init()`** op een fade-element wordt
  gerespecteerd (de module overschrijft een bestaande `--d` niet) — handig
  voor uitzonderingen op de automatische stagger.
- **`recede: false` zonder de opacity/transform zelf te resetten**: als je
  de recede uitschakelt nadat hij al actief was, roep dan `destroy()` aan
  (die zet `transform`/`opacity` terug naar leeg) vóór je opnieuw met
  `recede:false` initialiseert.

## Performance

De recede-scroll-listener is rAF-throttled en staat (via een
`IntersectionObserver` met `rootMargin: "100% 0px 100% 0px"`) alleen aan
terwijl de stage in of vlak bij beeld is; elke `apply()` schrijft alleen
naar de DOM als `e` daadwerkelijk veranderd is (epsilon-check). De letter-
en fade-animaties zelf zijn pure CSS `@keyframes` — geen JS-tik per frame.

## Herkomst

Techniek gezien op faresmasharawi.nl (22-09-2026) — daar heet dit
`PageMotion`, met CSS-klassen `.hero-line`/`.hero-ch`/`.hero-fade` en
data-attributen `data-hero-stage`/`data-hero-copy`/`data-hero-figure`. Live
gemeten met Playwright (1440×900): de letter-stagger is 28ms per niet-
spatie-teken (bv. "AI aan het werk." → A=28ms, I=56ms, spatie=56ms
(erft), a=84ms, …), en de recede volgt exact
`e = clamp(scrollY/innerHeight, 0, 1)` met de bovenstaande formules — bij
scrollY 450 op 900px viewporthoogte (e=0,5) mat de bron
`translate3d(0px, -3vh, 0px) scale(0.975)` voor de copy, `-5vh scale(0.98)`
voor de figure en stage-opacity `0.775`. Eigen implementatie: geen code
overgenomen, wel dezelfde formules en verhoudingen als vertrekpunt. De
toegankelijkheidsaanpak (`aria-label` + `aria-hidden` op de regels) is
letterlijk overgenomen uit wat er in de bron-HTML stond, omdat dat precies
het juiste patroon is voor deze situatie.
