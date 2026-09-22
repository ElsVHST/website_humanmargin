/**
 * header-state
 * ------------------------------------------------------------------------
 * Zet een klasse op een header-element zodra de bezoeker voorbij een
 * drempel van de eerste viewport is gescrold (standaard 75%). Handig om
 * de header dan compacter te maken of onderdelen te laten verdwijnen.
 * Vanilla ES-module, 0 dependencies, SSR-veilig.
 *
 * Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026) — daar
 * toggelt `PageMotion` de klasse `is-past-hero` op `[data-site-header]`
 * zodra `window.scrollY > 0.75 * innerHeight`, gebruikt om het logo en de
 * "Koffie?"-knop te laten wegschuiven/vervagen. Eigen implementatie: los
 * getrokken uit de gecombineerde hero-scroll-lus van de bron, zodat het
 * hier zonder de rest van de hero-motion-logica te gebruiken is.
 *
 * @typedef {Object} HeaderStateOptions
 * @property {number} [threshold=0.75] Fractie van window.innerHeight waarna de klasse wordt gezet.
 * @property {string} [activeClass="is-past-hero"] Klassenaam die aan/uit gaat.
 *
 * @param {Element} root Het header-element dat de klasse krijgt.
 * @param {HeaderStateOptions} [options]
 * @returns {() => void} destroy — verwijdert de listener en de klasse. Idempotent.
 */
export function init(root, options = {}) {
  if (!root || typeof root.classList === 'undefined') {
    throw new Error('header-state: init(root) heeft een DOM-element nodig');
  }

  const { threshold = 0.75, activeClass = 'is-past-hero' } = options;

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;

  let rafId = 0;
  let destroyed = false;
  let lastState = null;

  const apply = () => {
    rafId = 0;
    const past = win.scrollY > threshold * win.innerHeight;
    if (past !== lastState) {
      root.classList.toggle(activeClass, past);
      lastState = past;
    }
  };

  const onScroll = () => {
    if (rafId) return;
    rafId = win.requestAnimationFrame(apply);
  };

  // Directe eerste meting (bv. bij page-load met een scrollpositie > 0 door
  // browser-scroll-restoration), zonder te wachten op het eerste scroll-event.
  apply();

  win.addEventListener('scroll', onScroll, { passive: true });
  win.addEventListener('resize', onScroll, { passive: true });

  return function destroy() {
    if (destroyed) return;
    destroyed = true;
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('resize', onScroll);
    if (rafId) win.cancelAnimationFrame(rafId);
    root.classList.remove(activeClass);
  };
}
