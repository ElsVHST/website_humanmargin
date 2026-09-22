/**
 * hero-motion
 * ------------------------------------------------------------------------
 * Twee samenhangende effecten voor een hero-sectie:
 *
 * 1. Intro: de koptekst rijst letter voor letter op uit een masker
 *    (per regel `overflow:hidden`, elke letter `translateY(105%) → 0`,
 *    gestaggerd), terwijl de overige hero-elementen (subtekst, knoppen,
 *    logo's, …) infaden.
 * 2. Recede: bij wegscrollen (over de eerste viewport-hoogte) schuift de
 *    hero-tekst omhoog en krimpt licht, het beeld iets sterker, en de hele
 *    stage vervaagt.
 *
 * Vanilla ES-module, 0 dependencies, SSR-veilig (raakt window/document pas
 * aan bij `init()`). De letter-animatie zelf is pure CSS (`@keyframes`) —
 * die speelt vanzelf zodra de `.hm-ch`-elementen bestaan, met of zonder JS
 * (relevant als je al gesplitste markup server-side rendert). De recede is
 * wél JS-afhankelijk (scroll-gekoppelde transform).
 *
 * Herkomst: techniek gezien op faresmasharawi.nl (22-09-2026) — daar heet
 * dit `PageMotion` + de CSS-klassen `.hero-line`/`.hero-ch`/`.hero-fade`.
 * Live gemeten (22-09-2026, Playwright, 1440×900): de stagger is 28ms per
 * niet-spatie-teken (spaties erven de vorige teken-delay), en de recede-
 * formule is `e = clamp(scrollY/innerHeight, 0, 1)`:
 * copy → `translate3d(0, -6e vh, 0) scale(1-0.05e)`,
 * figure → `translate3d(0, -10e vh, 0) scale(1-0.04e)`,
 * stage-opacity → `1-0.45e`. Bij scrollY = 450 (e=0,5 op 900px vh) mat de
 * bron exact `translate3d(0px, -3vh, 0px) scale(0.975)` voor de copy,
 * `-5vh scale(0.98)` voor de figure en opacity `0.775` — precies deze
 * formules. Eigen implementatie, geen code overgenomen.
 *
 * @typedef {Object} HeroMotionOptions
 * @property {string} [lineSelector="[data-hero-line]"] Selector voor regel-containers binnen de kop.
 * @property {string} [headingSelector="[data-hero-heading]"] Selector voor de kop zelf (krijgt `aria-label`).
 * @property {string} [fadeSelector="[data-hero-fade]"] Selector voor elementen die infaden.
 * @property {string} [copySelector="[data-hero-copy]"] Selector voor het tekst-blok dat recedet.
 * @property {string} [figureSelector="[data-hero-figure]"] Selector voor het beeld-blok dat recedet.
 * @property {number} [charStep=0.028] Seconden stagger per niet-spatie-letter.
 * @property {number} [fadeBase=0.45] Seconden vóór het eerste fade-element start.
 * @property {number} [fadeStep=0.15] Seconden extra vertraging per volgend fade-element (document-volgorde), tenzij `data-hero-fade-delay` gezet is.
 * @property {boolean} [recede=true] Zet de scroll-recede aan/uit.
 * @property {number} [recedeCopyVh=-6] vh-verschuiving van de copy bij e=1.
 * @property {number} [recedeCopyScale=0.05] Schaalafname van de copy bij e=1 (1 - dit getal).
 * @property {number} [recedeFigureVh=-10] vh-verschuiving van de figure bij e=1.
 * @property {number} [recedeFigureScale=0.04] Schaalafname van de figure bij e=1.
 * @property {number} [recedeOpacity=0.45] Opacity-afname van de stage bij e=1 (1 - dit getal).
 *
 * @param {Element} root De hero-stage: bevat (of is) het element waarop de opacity-recede wordt toegepast.
 * @param {HeroMotionOptions} [options]
 * @returns {() => void} destroy
 */

const CH_ATTR = 'data-hero-ch';

function isSpace(ch) {
  return /^\s$/.test(ch);
}

function splitHeading(root, options, doc) {
  const headingEl = root.querySelector(options.headingSelector);
  const lines = Array.from(root.querySelectorAll(options.lineSelector));
  if (!headingEl || lines.length === 0) return [];

  const alreadySplit = headingEl.querySelector(`[${CH_ATTR}]`);
  if (alreadySplit) {
    return Array.from(headingEl.querySelectorAll(`[${CH_ATTR}]`));
  }

  const fullText = lines.map((l) => (l.textContent || '').trim()).join(' ');
  headingEl.setAttribute('aria-label', fullText);

  const chars = [];
  let n = 0;

  function wrapInChain(node, chain) {
    let result = node;
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const clone = chain[i].cloneNode(false);
      clone.appendChild(result);
      result = clone;
    }
    return result;
  }

  for (const line of lines) {
    line.setAttribute('aria-hidden', 'true');
    line.classList.add('hm-line');

    const frag = doc.createDocumentFragment();
    let currentWord = null;

    const ensureWord = () => {
      if (!currentWord) {
        currentWord = doc.createElement('span');
        currentWord.className = 'hm-word';
      }
      return currentWord;
    };
    const flushWord = () => {
      if (currentWord) {
        frag.appendChild(currentWord);
        currentWord = null;
      }
    };

    const walk = (node, chain) => {
      if (node.nodeType === 3) {
        const text = node.textContent || '';
        const parts = text.split(/(\s+)/).filter((p) => p.length > 0);
        for (const part of parts) {
          if (isSpace(part)) {
            flushWord();
            const span = doc.createElement('span');
            span.className = 'hm-ch hm-ch--space';
            span.setAttribute(CH_ATTR, '');
            span.style.setProperty('--d', `${(n * options.charStep).toFixed(3)}s`);
            span.appendChild(wrapInChain(doc.createTextNode(' '), chain));
            frag.appendChild(span);
            chars.push(span);
          } else {
            const wordWrap = ensureWord();
            for (const ch of Array.from(part)) {
              n += 1;
              const span = doc.createElement('span');
              span.className = 'hm-ch';
              span.setAttribute(CH_ATTR, '');
              span.style.setProperty('--d', `${(n * options.charStep).toFixed(3)}s`);
              span.appendChild(wrapInChain(doc.createTextNode(ch), chain));
              wordWrap.appendChild(span);
              chars.push(span);
            }
          }
        }
        return;
      }
      if (node.nodeType === 1) {
        for (const child of Array.from(node.childNodes)) walk(child, chain.concat(node));
      }
    };

    for (const child of Array.from(line.childNodes)) walk(child, []);
    flushWord();
    line.replaceChildren(frag);
  }

  return chars;
}

function setupFades(root, options) {
  const fades = Array.from(root.querySelectorAll(options.fadeSelector));
  fades.forEach((el, i) => {
    if (el.style.getPropertyValue('--d')) return; // consument zette al zelf een delay
    const explicit = el.getAttribute('data-hero-fade-delay');
    const delay = explicit !== null && explicit !== '' ? Number(explicit) : options.fadeBase + i * options.fadeStep;
    el.style.setProperty('--d', `${delay.toFixed(3)}s`);
  });
  return fades;
}

export function init(root, options = {}) {
  if (!root || typeof root.getBoundingClientRect !== 'function') {
    throw new Error('hero-motion: init(root) heeft een DOM-element nodig');
  }

  const opts = {
    lineSelector: '[data-hero-line]',
    headingSelector: '[data-hero-heading]',
    fadeSelector: '[data-hero-fade]',
    copySelector: '[data-hero-copy]',
    figureSelector: '[data-hero-figure]',
    charStep: 0.028,
    fadeBase: 0.45,
    fadeStep: 0.15,
    recede: true,
    recedeCopyVh: -6,
    recedeCopyScale: 0.05,
    recedeFigureVh: -10,
    recedeFigureScale: 0.04,
    recedeOpacity: 0.45,
    ...options,
  };

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;

  const reduceMotion =
    !!win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Intro -------------------------------------------------------------
  if (!reduceMotion) {
    splitHeading(root, opts, doc);
    setupFades(root, opts);
  }
  // Bij reduced-motion: NIET splitsen (kop blijft platte, direct leesbare
  // tekst) en geen --d-vertragingen zetten. De CSS-media-query is bovendien
  // een vangnet voor het geval de markup al server-side gesplitst was.

  // --- Recede --------------------------------------------------------------
  const copyEl = root.querySelector(opts.copySelector);
  const figureEl = root.querySelector(opts.figureSelector);

  let destroyed = false;
  let rafId = 0;
  let io = null;
  let listenersActive = false;
  let lastE = -1;

  function apply() {
    rafId = 0;
    const vh = win.innerHeight || 1;
    const e = Math.min(1, Math.max(0, win.scrollY / vh));
    if (Math.abs(e - lastE) < 0.0005) return;
    lastE = e;

    if (copyEl) {
      copyEl.style.transform = `translate3d(0, ${(opts.recedeCopyVh * e).toFixed(2)}vh, 0) scale(${(1 - opts.recedeCopyScale * e).toFixed(3)})`;
    }
    if (figureEl) {
      figureEl.style.transform = `translate3d(0, ${(opts.recedeFigureVh * e).toFixed(2)}vh, 0) scale(${(1 - opts.recedeFigureScale * e).toFixed(3)})`;
    }
    root.style.opacity = (1 - opts.recedeOpacity * e).toFixed(3);
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

  if (opts.recede && !reduceMotion) {
    if (typeof win.IntersectionObserver === 'function') {
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
        { rootMargin: '100% 0px 100% 0px' }
      );
      io.observe(root);
      apply();
    } else {
      addListeners();
      apply();
    }
  }

  return function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (io) io.disconnect();
    removeListeners();
    if (rafId) win.cancelAnimationFrame(rafId);
    if (copyEl) copyEl.style.transform = '';
    if (figureEl) figureEl.style.transform = '';
    root.style.opacity = '';
  };
}
