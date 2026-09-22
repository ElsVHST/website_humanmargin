/**
 * story-word-light
 * ------------------------------------------------------------------------
 * Een tekstsectie die blijft staan (sticky) terwijl je erlangs scrolt, en
 * waarvan de tekst woord voor woord "oplicht" (grijs → inkt) naar gelang de
 * scrollvoortgang. Benadrukte woorden (`<em>`) worden tegelijk vetter én
 * smaller ("dichtgedrukt") zodra ze oplichten. Vanilla ES-module,
 * 0 dependencies, SSR-veilig.
 *
 * Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026) — daar heet
 * de sectie `storyline` (in de "Wie ik ben"-sectie). Live gemeten
 * (22-09-2026, Playwright, 1440×900): sectiehoogte 1,7× viewport
 * (`lg:h-[170vh]`), 70 woorden, formule `p = clamp(-rect.top / (offsetHeight
 * - innerHeight), 0, 1)`, aantal verlichte woorden = `floor(1.3 * p * N)`.
 * Bij scrollY 4185 (p=0,5 op deze meting) stonden precies 45 van de 70
 * woorden op `.is-lit` — exact gelijk aan de formule. Eigen implementatie,
 * geen code overgenomen.
 *
 * @typedef {Object} StoryWordLightOptions
 * @property {string} [textSelector="[data-story-text]"] Selector (binnen root) voor het element met de zin. Valt terug op `root` zelf als niet gevonden.
 * @property {number} [multiplier=1.3] Vermenigvuldiger in `floor(multiplier * p * aantalWoorden)` — bij 1.3 is alles al verlicht rond p ≈ 0,77.
 *
 * @param {Element} root De buitenste (hoge, scrollbare) sectie — bevat de sticky binnenkant. `root.offsetHeight` bepaalt de scroll-baan.
 * @param {StoryWordLightOptions} [options]
 * @returns {() => void} destroy — ruimt listeners/observer op, verwijdert `is-lit`, en zet — alleen als déze module de tekst zelf splitste — de oorspronkelijke markup terug.
 */

const WORD_ATTR = 'data-story-word';
const LIT_CLASS = 'is-lit';
const EMPHASIS_TAGS = new Set(['em', 'strong', 'b', 'i', 'mark']);

/**
 * Splitst de tekst binnen `container` in woorden, gewrapt in
 * `<span data-story-word>`. Emphasis-elementen (em/strong/b/i/mark) worden
 * NIET als één blok overgeslagen: elk woord daarbinnen krijgt zijn eigen
 * kloon van dat element (zo kan elk woord afzonderlijk oplichten, en blijft
 * `em` semantisch behouden — dit is exact hoe de bron het ook opbouwt, zie
 * README). Andere elementen (bv. `<a>`) blijven als één structureel element
 * staan en worden gewoon in-place herschreven, zodat een link met meerdere
 * woorden erin één link blijft.
 */
function splitWords(container, doc) {
  function build(node, chain) {
    if (node.nodeType === 3) {
      const frag = doc.createDocumentFragment();
      const text = node.textContent || '';
      const parts = text.split(/(\s+)/).filter((p) => p.length > 0);
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          frag.appendChild(doc.createTextNode(part));
          continue;
        }
        const span = doc.createElement('span');
        span.setAttribute(WORD_ATTR, '');
        let content = doc.createTextNode(part);
        for (let i = chain.length - 1; i >= 0; i -= 1) {
          const clone = chain[i].cloneNode(false);
          clone.appendChild(content);
          content = clone;
        }
        span.appendChild(content);
        frag.appendChild(span);
      }
      return frag;
    }
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      if (EMPHASIS_TAGS.has(tag)) {
        const frag = doc.createDocumentFragment();
        for (const child of Array.from(node.childNodes)) {
          frag.appendChild(build(child, chain.concat(node)));
        }
        return frag;
      }
      const clone = node.cloneNode(false);
      for (const child of Array.from(node.childNodes)) {
        clone.appendChild(build(child, chain));
      }
      return clone;
    }
    return doc.createDocumentFragment();
  }

  const frag = doc.createDocumentFragment();
  for (const child of Array.from(container.childNodes)) {
    frag.appendChild(build(child, []));
  }
  container.replaceChildren(frag);
}

export function init(root, options = {}) {
  if (!root || typeof root.getBoundingClientRect !== 'function') {
    throw new Error('story-word-light: init(root) heeft een DOM-element nodig');
  }

  const { textSelector = '[data-story-text]', multiplier = 1.3 } = options;

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;

  const textEl = root.querySelector(textSelector) || root;

  let words = Array.from(textEl.querySelectorAll(`[${WORD_ATTR}]`));
  let weDidSplit = false;
  let originalHTML = null;

  // Al gesplitste markup (bv. server-side gerenderd) wordt herkend en niet
  // opnieuw gesplitst.
  if (words.length === 0) {
    originalHTML = textEl.innerHTML;
    splitWords(textEl, doc);
    weDidSplit = true;
    words = Array.from(textEl.querySelectorAll(`[${WORD_ATTR}]`));
  }

  const reduceMotion =
    !!win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let destroyed = false;
  let rafId = 0;
  let io = null;
  let listenersActive = false;

  function apply() {
    rafId = 0;
    const rect = root.getBoundingClientRect();
    const vh = win.innerHeight;
    const runway = root.offsetHeight - vh;
    const raw = runway > 0 ? -rect.top / runway : rect.top <= 0 ? 1 : 0;
    const p = Math.min(1, Math.max(0, raw));
    const litCount = Math.min(
      words.length,
      Math.max(0, Math.floor(multiplier * p * words.length))
    );
    for (let i = 0; i < words.length; i += 1) {
      const shouldLight = i < litCount;
      if (words[i].classList.contains(LIT_CLASS) !== shouldLight) {
        words[i].classList.toggle(LIT_CLASS, shouldLight);
      }
    }
  }

  function onScroll() {
    if (rafId) return;
    rafId = win.requestAnimationFrame(apply);
  }

  function addListeners() {
    if (listenersActive) return;
    listenersActive = true;
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', onScroll, { passive: true });
  }

  function removeListeners() {
    if (!listenersActive) return;
    listenersActive = false;
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('resize', onScroll);
  }

  if (words.length === 0) {
    // Niets te doen.
  } else if (reduceMotion) {
    for (const w of words) w.classList.add(LIT_CLASS);
  } else if (typeof win.IntersectionObserver === 'function') {
    // rAF/scroll-listener alleen actief terwijl de sectie in of vlak bij
    // beeld is (royale rootMargin als buffer tegen een harde aan/uit-knik).
    io = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            addListeners();
            apply();
          } else {
            removeListeners();
          }
        }
      },
      { rootMargin: '50% 0px 50% 0px' }
    );
    io.observe(root);
    apply();
  } else {
    addListeners();
    apply();
  }

  return function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (io) io.disconnect();
    removeListeners();
    if (rafId) win.cancelAnimationFrame(rafId);
    for (const w of words) w.classList.remove(LIT_CLASS);
    if (weDidSplit && originalHTML !== null) {
      textEl.innerHTML = originalHTML;
    }
  };
}
