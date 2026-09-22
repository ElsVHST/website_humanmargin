# story-word-light

Een tekstsectie die blijft staan (sticky) terwijl je eraan voorbij scrolt, en
waarvan de tekst woord voor woord "oplicht" (grijs → inkt) naar gelang de
scrollvoortgang. Benadrukte woorden (`<em>`) worden tegelijk vetter en
smaller — "dichtgedrukt" — zodra ze oplichten.

## Wanneer wel

- Een korte, betekenisvolle alinea (bio, missie, "wie we zijn") die je een
  moment van aandacht wilt geven, met een scroll-gekoppelde nadruk.
- Content waar je 1–2 woorden of frases specifiek wilt uitlichten
  (`<em>`) op het moment dat ze "aankomen".

## Wanneer niet

- Niet voor lange lopende tekst (artikelen, blogposts) — de sticky
  scroll-baan neemt bewust extra scrollruimte in; bij te veel tekst voelt
  dat traag. Richtlijn: 40–90 woorden.
- Niet voor tekst die meteen volledig leesbaar moet zijn zonder scroll-
  interactie (gebruik dan gewoon een paragraaf, of `reveal-on-scroll`).
- Niet voor een lettergewijze intro-animatie — dat is `hero-motion`.

## Installatie

```
component-library/scroll/story-word-light/
├── story-word-light.js      # vanilla ES-module, 0 dependencies
├── story-word-light.css     # namespaced op .swl / [data-story-word]
├── StoryWordLight.tsx        # React/Next.js client-wrapper
├── demo.html                 # zelfstandige demo
└── test/meet.mjs             # Playwright-meting (p = 0 / 0,25 / 0,5 / 0,77 / 1, echt gescrold)
```

**Vanilla / elk framework**

```html
<link rel="stylesheet" href="./story-word-light.css" />

<section data-story-block style="--swl-length: 1.7">
  <div class="swl__sticky">
    <p data-story-text>
      Al meer dan tien jaar bouw ik producten die mensen dagelijks gebruiken,
      met <em>honderdduizenden</em> gebruikers als resultaat.
    </p>
  </div>
</section>

<script type="module">
  import { init } from './story-word-light.js';
  const destroy = init(document.querySelector('[data-story-block]'));
</script>
```

De module voegt zelf de klasse `.swl` niet toe aan de root (dat doe je zelf
in je markup, zoals hierboven) — hij leest alléén attributen/structuur, geen
klassen. `story-word-light.css` verwacht wel `.swl` op de root en
`.swl__sticky` op de binnenkant; zonder die klassen werkt de JS-logica nog
steeds (progress + `is-lit`), maar mist de sticky opmaak.

**React / Next.js (App Router)**

```tsx
import { StoryWordLight } from '@/component-library/scroll/story-word-light/StoryWordLight';

<StoryWordLight lengthVh={1.7}>
  Al meer dan tien jaar bouw ik producten die mensen dagelijks gebruiken,
  met <em>honderdduizenden</em> gebruikers als resultaat.
</StoryWordLight>
```

`<StoryWordLight>` rendert zelf de `.swl` → `.swl__sticky` →
`<p data-story-text>`-structuur; `children` mag gewoon JSX zijn (`<em>`
werkt, want de module leest de uiteindelijke DOM, niet de JSX-bron).

## Markup-contract

- Root (`init(root)` / de sectie): het **buitenste, hoge** element — dat
  bepaalt met `root.offsetHeight` de lengte van de scroll-baan. Zet hierop
  de CSS-variabele `--swl-length` (veelvoud van `100vh`; standaard 1,7 —
  gemeten op de bron).
- Daarbinnen: een element met `data-story-text` (of `textSelector`
  aangepast) dat de zin bevat. Als dat element ontbreekt, gebruikt de
  module `root` zelf.
- **Al gesplitste tekst** (bv. server-side gerenderd): als er binnen het
  tekstelement al `[data-story-word]`-spans staan, splitst de module niets
  opnieuw — hij telt ze en koppelt er direct scrollgedrag aan.
- **Tekst die de module zelf splitst**: gewone tekst, met optioneel
  `<em>`/`<strong>`/`<b>`/`<i>`/`<mark>` voor nadruk en `<a>` voor links.
  Elk woord wordt `<span data-story-word>tekst</span>`; een woord binnen
  `<em>` wordt `<span data-story-word><em>tekst</em></span>` (elk woord
  krijgt zijn eigen kloon van het nadruk-element, zodat elk woord apart kan
  oplichten — dit is ook hoe de bron het opbouwt, zie Herkomst). Een `<a>`
  met meerdere woorden erin blijft één link: de woorden erbinnen krijgen elk
  hun span, maar het linkelement zelf wordt niet gekloond.
- Interpunctie blijft aan het woord vastzitten ("platforms." is één woord),
  net als op de bron.

## Op WordPress

Geen build-stap nodig — `story-word-light.js` is een kant-en-klare ES-module.

**1. Bestanden plaatsen** — zet de map in je thema (of een eigen plugin):

```
wp-content/themes/<jouw-thema>/component-library/story-word-light/
├── story-word-light.css
└── story-word-light.js
```

**2. Laden als ES-module** — vanaf WordPress 6.5 met `wp_enqueue_script_module()`:

```php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'story-word-light-style',
		get_stylesheet_directory_uri() . '/component-library/story-word-light/story-word-light.css',
		array(),
		'1.0.0'
	);
	wp_enqueue_script_module(
		'story-word-light-module',
		get_stylesheet_directory_uri() . '/component-library/story-word-light/story-word-light.js',
		array(),
		'1.0.0'
	);
} );
```

Op WordPress < 6.5 laad je de module via `wp_footer` of een Custom HTML-blok
met `<script type="module">`.

**3. Markup plaatsen** — de sectie met `--swl-length` en het
`data-story-text`-element in een Custom HTML-blok (Gutenberg), of rechtstreeks
in een template. Een WYSIWYG-blok (de normale paragraaftekst-editor) werkt
ook, zolang je de sectie zelf en `data-story-text` via een Custom HTML-blok
of een block-template omheen zet.

**4. `init()` aanroepen** ná `DOMContentLoaded`:

```html
<script type="module">
  import { init } from '/wp-content/themes/<jouw-thema>/component-library/story-word-light/story-word-light.js';
  document.addEventListener('DOMContentLoaded', () => {
    const block = document.querySelector('[data-story-block]');
    if (block) init(block);
  });
</script>
```

**Valkuilen**

- **Caching-/minify-plugins** (WP Rocket, Autoptimize, W3 Total Cache e.d.)
  bundelen JS standaard tot één niet-module-script, of strippen
  `type="module"` — dat breekt de `import`. Sluit `story-word-light.js` uit
  van JS-combinatie/-minificatie, of laad het via `wp_enqueue_script_module()`.
- **jQuery-conflicten**: n.v.t. — geen jQuery-afhankelijkheid.
- **De Gutenberg-editor splitst je tekst niet zelf** — de module doet dat
  client-side bij `init()`. Plak de zin dus als gewone tekst in
  `data-story-text`, niet als losse `<span>`s per woord (tenzij je zelf
  server-side al splitst, zie § Markup-contract).

## Opties (`init(root, options)`), met standaardwaarden

| Optie | Standaard | Omschrijving |
|---|---|---|
| `textSelector` | `"[data-story-text]"` | Selector binnen root voor het tekstelement. |
| `multiplier` | `1.3` | Vermenigvuldiger in `floor(multiplier * p * aantalWoorden)`. Bij 1,3 is alles al verlicht rond p ≈ 0,77 — bewust, zodat de laatste 23% van de scroll-baan "rust" geeft voor je verder scrollt. |

CSS-variabelen:

| Variabele | Standaard | Omschrijving |
|---|---|---|
| `--swl-length` | `1.7` | Lengte van de scroll-baan, veelvoud van `100vh`. |
| `--swl-ink` | `#101010` | Kleur van verlichte tekst / basis voor de ongelichte (16% dekking). |
| `--swl-em-wdth` / `--swl-em-wght` | `92` / `420` | `font-variation-settings` van `em` vóór het oplichten. |
| `--swl-em-wdth-lit` / `--swl-em-wght-lit` | `88` / `800` | Idem, ná het oplichten — smaller én zwaarder. |

## Toegankelijkheid

- **Geen ARIA-overrides nodig.** De module splitst per wóórd, niet per
  letter: een screenreader leest doodgewoon `<span>tekst</span> <span>...`
  als de aaneengesloten zin, exact zoals de brontekst. (Dit in tegenstelling
  tot `hero-motion`, dat per lettergreep-teken splitst en daarom wél
  `aria-label`/`aria-hidden` gebruikt — zie die README.)
- `<em>`/`<strong>` blijven semantisch intact (elk woord krijgt een eigen
  kloon van het element, geen `<span>` die de nadruk vervangt), dus
  screenreaders kondigen nadruk nog steeds aan waar relevant.
- `prefers-reduced-motion: reduce`: alle woorden krijgen direct `is-lit`,
  geen scroll-listener, geen kleur-/variation-transitie (CSS zet
  `transition: none`).
- Focus-volgorde verandert niet — puur presentationele klassen, geen
  `tabindex`/`display`-toggles.

## Browserondersteuning

`IntersectionObserver` + `requestAnimationFrame` (alle moderne browsers).
`color-mix()` voor de ongelicht-kleur (breed ondersteund; val bij een zeer
oude browser terug op een eigen `--swl-ink-dim`-override met een vast
rgba-getal als je die ondersteuning nog nodig hebt). Variable-font-assen
(`wdth`/`wght` via `font-variation-settings`) hebben alleen zichtbaar effect
met een font dat die assen ondersteunt; zonder zo'n font blijft de rest
(kleur, sticky-gedrag) gewoon werken.

## Valkuilen

- **`--swl-length` te kort** (bv. 1) geeft nauwelijks scroll-baan: alle
  woorden lichten binnen een fractie van de viewport op. Richtlijn: 1,5–2,5.
- **Root zonder hoogte-CSS**: als je de `.swl`-klasse niet laadt (of
  overschrijft) en zelf geen `min-height` zet, heeft de sectie geen
  scroll-baan en blijft alles op p=0 staan.
- **Meerdere instanties op één pagina**: elke instantie heeft zijn eigen
  IntersectionObserver + rAF-gate, dus dat kan probleemloos, maar houd de
  secties niet vlak op elkaar — de sticky-binnenkant van de volgende sectie
  kan anders "onder" de vorige beginnen te schuiven.
- **Dynamisch wisselende tekst**: `init()` splitst één keer bij het
  opstarten. Verander je de tekst daarna, roep dan `destroy()` + `init()`
  opnieuw aan.

## Performance

Scroll-/resize-listeners zijn rAF-throttled én staan alleen aan terwijl de
sectie via een `IntersectionObserver` (royale `rootMargin: "50% 0px 50% 0px"`
buffer) in of vlak bij beeld is — buiten beeld doet de module niets.

## Herkomst

Techniek gezien op faresmasharawi.nl (22-09-2026) — daar heet de sectie
`storyline` in "Wie ik ben". Live gemeten met Playwright (1440×900):
sectiehoogte 1,7× viewport, 70 woorden, en bij scrollY 4185 (rekenkundig
p ≈ 0,5 op die meting) stonden precies 45 van de 70 woorden op `.is-lit` —
exact `floor(1,3 · 0,5 · 70) = 45`. Eigen implementatie: geen code
overgenomen, wel dezelfde formule en verhouding als vertrekpunt.
