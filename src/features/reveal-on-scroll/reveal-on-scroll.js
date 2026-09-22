/**
 * reveal-on-scroll
 * ------------------------------------------------------------------------
 * Elementen met `[data-reveal]` komen in beeld met een fade + lichte
 * verschuiving zodra ze de viewport in scrollen. Vanilla ES-module,
 * 0 dependencies, SSR-veilig: dit bestand raakt `window`/`document` pas aan
 * zodra `init()` wordt aangeroepen — niet bij import.
 *
 * Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026) — daar heet de
 * mechaniek `RevealObserver` (IntersectionObserver, threshold 0.18,
 * rootMargin "0px 0px -18% 0px", met een `.js`-klasse op <html> om zonder
 * JS alles gewoon zichtbaar te tonen). Eigen implementatie: geen code
 * overgenomen, wel dezelfde drempelwaarden als vertrekpunt (zie README
 * "Gemeten constanten").
 *
 * @typedef {Object} RevealOnScrollOptions
 * @property {string} [selector="[data-reveal]"] CSS-selector voor de te onthullen elementen, gezocht binnen `root`.
 * @property {number} [threshold=0.18] IntersectionObserver-threshold.
 * @property {string} [rootMargin="0px 0px -18% 0px"] IntersectionObserver-rootMargin.
 * @property {boolean} [once=true] Na onthullen niet meer opnieuw verbergen bij uitscrollen.
 *
 * @param {Element} root Container waarbinnen naar `[data-reveal]` wordt gezocht. Krijgt de activatie-attributen `data-ros-hidden` (synchroon) en `data-ros-active` (één frame later — zie README "Valkuilen").
 * @param {RevealOnScrollOptions} [options]
 * @returns {() => void} destroy — ruimt observer + attributen/klassen op. Idempotent aan te roepen.
 */
export function init(root, options = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    throw new Error('reveal-on-scroll: init(root) heeft een DOM-element nodig');
  }

  const {
    selector = '[data-reveal]',
    threshold = 0.18,
    rootMargin = '0px 0px -18% 0px',
    once = true,
  } = options;

  const HIDDEN_ATTR = 'data-ros-hidden';
  const ACTIVE_ATTR = 'data-ros-active';
  const IN_CLASS = 'is-in';

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;

  // Progressive enhancement, in twee fasen (zie reveal-on-scroll.css voor
  // waarom): `data-ros-hidden` zet de verborgen staat synchroon, zonder
  // transition. Pas een animatieframe later voegt de module `data-ros-active`
  // toe, wat alléén de transition inschakelt — dat verandert geen waarde en
  // animeert dus niets. Zo mist de allereerste toepassing (verbergen) de
  // transition, en heeft de latere `.is-in`-wissel (via de observer) hem wel.
  // Zolang deze attributen afwezig zijn (module niet geladen / JS uit) toont
  // de CSS alles gewoon.
  root.setAttribute(HIDDEN_ATTR, '');
  let activateRaf = win.requestAnimationFrame
    ? win.requestAnimationFrame(() => {
        activateRaf = 0;
        root.setAttribute(ACTIVE_ATTR, '');
      })
    : (root.setAttribute(ACTIVE_ATTR, ''), 0);

  const elements = Array.from(root.querySelectorAll(selector));

  // Per-element vertraging: data-reveal-delay="0.3" (seconden) -> CSS-var.
  for (const el of elements) {
    const delay = el.getAttribute('data-reveal-delay');
    if (delay !== null && delay !== '') {
      el.style.setProperty('--reveal-delay', `${delay}s`);
    }
  }

  let destroyed = false;

  function cancelActivation() {
    if (activateRaf && win.cancelAnimationFrame) win.cancelAnimationFrame(activateRaf);
    activateRaf = 0;
  }

  function removeAttrs() {
    root.removeAttribute(HIDDEN_ATTR);
    root.removeAttribute(ACTIVE_ATTR);
  }

  const reduceMotion =
    !!win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (elements.length === 0) {
    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelActivation();
      removeAttrs();
    };
  }

  if (reduceMotion || typeof win.IntersectionObserver === 'undefined') {
    // Reduced-motion / geen IO-support: meteen alles tonen, geen observer.
    // data-ros-hidden blijft bewust staan — de @media(prefers-reduced-motion)
    // -regel in de CSS forceert daarbinnen zelf opacity:1/transition:none,
    // wat robuuster is dan hier zelf attributen weghalen.
    cancelActivation();
    for (const el of elements) el.classList.add(IN_CLASS);
    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      removeAttrs();
      for (const el of elements) el.classList.remove(IN_CLASS);
    };
  }

  const observer = new win.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(IN_CLASS);
          if (once) observer.unobserve(entry.target);
        } else if (!once) {
          entry.target.classList.remove(IN_CLASS);
        }
      }
    },
    { threshold, rootMargin }
  );

  for (const el of elements) observer.observe(el);

  return function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelActivation();
    observer.disconnect();
    removeAttrs();
    for (const el of elements) {
      el.classList.remove(IN_CLASS);
      el.style.removeProperty('--reveal-delay');
    }
  };
}
