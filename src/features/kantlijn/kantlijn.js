/**
 * kantlijn — de signatuur van Human Margin (PRD-001 §6.3, AC-B6, AC-B7, AC-T4).
 * ------------------------------------------------------------------------
 * 1. Handschriftfonts pas na de eerste scroll of aanraking. Atomic Marker (531 KB) en Feisty (138 KB)
 *    komen niet mee met de eerste lading: hun CSS wordt pas ingevoegd bij de eerste interactie, en
 *    alleen voor de kleuren die op deze pagina voorkomen. De CSS-bestanden zelf blijven byte-gelijk
 *    aan de aangeleverde, met het licentieblok van YouWorkForThem erin (AC-M7).
 * 2. Een notitie ([data-notitie]) verschijnt zodra haar anker ([data-notitie-anker], de alinea of
 *    foto ernaast) voor ≥ 30 % in beeld is, en pas als haar font binnen is.
 * 3. Markeerstift ([data-markeer]) tekent zich één keer in zodra de tekst in beeld komt.
 *
 * Zonder JavaScript staat alles gewoon in beeld (notities in het terugvalfont, markering volledig).
 * Vanilla ES-module, geen dependencies. init(root) → destroy().
 */

const FONT_CSS = {
  geel: { href: "/fonts/atomic-marker/atomic-marker-regular.css", familie: "AtomicMarker" },
  blauw: { href: "/fonts/feisty/feisty.css", familie: "FeistyRegular" },
};
const INTERACTIE = ["scroll", "wheel", "touchstart", "keydown", "pointerdown"];

function laadFont(doc, kleur) {
  const f = FONT_CSS[kleur];
  if (!f) return Promise.resolve();
  if (!doc.querySelector(`link[data-kantlijn-font="${kleur}"]`)) {
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = f.href;
    link.dataset.kantlijnFont = kleur;
    doc.head.appendChild(link);
  }
  const fonts = doc.fonts;
  if (!fonts || !fonts.load) return Promise.resolve();
  // Wacht op de CSS en daarna op het font zelf; na 3 s toch tonen (in het terugvalfont).
  const wacht = new Promise((klaar) => {
    const link = doc.querySelector(`link[data-kantlijn-font="${kleur}"]`);
    if (link && link.sheet) klaar();
    else link?.addEventListener("load", () => klaar(), { once: true });
    setTimeout(klaar, 1500);
  }).then(() => fonts.load(`1em "${f.familie}"`));
  return Promise.race([wacht, new Promise((r) => setTimeout(r, 3000))]).catch(() => undefined);
}

export function init(root, options = {}) {
  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const drempel = options.threshold ?? 0.3;
  const notities = Array.from(root.querySelectorAll("[data-notitie]"));
  const markeringen = Array.from(root.querySelectorAll("[data-markeer]"));
  const observers = [];
  let actief = false;

  const zichtbaar = (el) => el.classList.add("is-zichtbaar");

  // Markeerstift: één keer intekenen als de tekst goed in beeld is.
  if (markeringen.length) {
    if (!("IntersectionObserver" in win)) markeringen.forEach((m) => m.classList.add("is-getekend"));
    else {
      const io = new win.IntersectionObserver(
        (items) => {
          for (const it of items) {
            if (it.isIntersecting) {
              it.target.classList.add("is-getekend");
              io.unobserve(it.target);
            }
          }
        },
        { threshold: 1, rootMargin: "0px 0px -12% 0px" },
      );
      markeringen.forEach((m) => io.observe(m));
      observers.push(io);
    }
  }

  /*
   * Kijken en tonen staan los van elkaar. De observers draaien meteen, zodat een sectie die maar
   * kort in beeld is (een notitie bovenaan een lange pagina, terwijl de bezoeker doorscrolt) niet
   * gemist wordt. De handschriftfonts komen pas bij de eerste interactie (AC-T4); wat in de
   * tussentijd gezien is, verschijnt zodra die binnen zijn.
   */
  const gezien = new Set();
  let fontsKlaar = false;

  function toon() {
    if (!fontsKlaar) return;
    for (const sectie of gezien) sectie.querySelectorAll("[data-notitie]").forEach(zichtbaar);
    gezien.clear();
  }

  function kijk() {
    if (!("IntersectionObserver" in win)) {
      notities.forEach((n) => gezien.add(n.closest("section") || root));
      return;
    }
    // Per sectie één anker (de alinea of foto waar de notitie bij hoort); is dat anker voor
    // ≥ 30 % in beeld, dan verschijnen de notities van die sectie.
    const perSectie = new Map();
    for (const n of notities) {
      const sectie = n.closest("section") || root;
      if (!perSectie.has(sectie)) perSectie.set(sectie, sectie.querySelector("[data-notitie-anker]") || n);
    }
    for (const [sectie, anker] of perSectie) {
      const io = new win.IntersectionObserver(
        (items) => {
          const genoeg = items.some((it) => {
            if (!it.isIntersecting) return false;
            // Een anker dat hoger is dan het venster kan nooit voor 30 % van zichzelf in beeld
            // staan — op een telefoon is de privacytekst zo'n anker. Dan telt hoeveel van het
            // vénster het anker vult.
            const venster = win.innerHeight || 1;
            return it.intersectionRatio >= drempel || it.intersectionRect.height / venster >= drempel;
          });
          if (genoeg) {
            gezien.add(sectie);
            io.disconnect();
            toon();
          }
        },
        { threshold: [0, drempel / 6, drempel / 3, drempel] },
      );
      io.observe(anker);
      observers.push(io);
    }
  }

  function activeer() {
    if (actief) return;
    actief = true;
    INTERACTIE.forEach((t) => win.removeEventListener(t, activeer));
    const kleuren = new Set(notities.map((n) => n.dataset.kleur));
    Promise.all(Array.from(kleuren).map((k) => laadFont(doc, k))).then(() => {
      fontsKlaar = true;
      toon();
    });
  }

  if (notities.length) {
    kijk();
    INTERACTIE.forEach((t) => win.addEventListener(t, activeer, { passive: true }));
  }

  return function destroy() {
    INTERACTIE.forEach((t) => win.removeEventListener(t, activeer));
    observers.forEach((o) => o.disconnect());
  };
}
