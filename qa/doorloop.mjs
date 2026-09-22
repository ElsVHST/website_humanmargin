#!/usr/bin/env node
/**
 * Doorloop als bezoeker (AC-B10). Per pagina en per scherm (1440×900 en 390×844):
 * - echt scrollen met het muiswiel, in stapjes op menselijk tempo; de klok loopt gewoon;
 * - ≥ 12 beelden op vaste scrollstanden, samen als contactblad in qa/doorloop/;
 * - per beeld gemeten: overlappende tekst (Range-rects per regel), leeg scherm, afgekapte koppen.
 * Exit 0 = 0 overlappingen, 0 lege schermen langer dan 1 s, 0 afgekapte koppen.
 *
 *   node qa/doorloop.mjs [route ...]          (standaard alle zes)
 */
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { startBrowser, BASIS, ROUTES, wacht } from "./lib/browser.mjs";

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ROUTES;
const SCHERMEN = [
  { naam: "desktop", width: 1440, height: 900 },
  { naam: "mobiel", width: 390, height: 844 },
];
const UIT = "qa/doorloop";
mkdirSync(UIT, { recursive: true });
const FONT = "src/app/fonts/ArchivoBlack-Regular.ttf";

/** In de pagina: meet wat een bezoeker op dit moment ziet. */
function meetBeeld() {
  const vw = innerWidth;
  const vh = innerHeight;
  const zichtbaar = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o > 0.2;
  };
  // Tekst die onder de vaste kopbalk doorschuift is niet zichtbaar: die telt niet mee.
  const kopEl = document.querySelector("[data-kop]");
  const kopOnder = kopEl ? kopEl.getBoundingClientRect().bottom : 0;
  const onderKop = (el, q) => !el.closest("[data-kop], dialog, .cookiebanner") && q.top < kopOnder;
  // Tekstblokken: elementen met eigen tekst. Per regel de rechthoeken via een Range.
  const blokken = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style,noscript,[hidden],dialog:not([open]),.sr-only,details:not([open]) > :not(summary)")) continue;
    if (!zichtbaar(el)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const rects = Array.from(r.getClientRects()).filter(
      (q) => q.width > 2 && q.height > 2 && q.bottom > 0 && q.top < vh && q.right > 0 && q.left < vw && !onderKop(el, q),
    );
    if (rects.length) blokken.push({ el, rects, tekst: n.textContent.trim().slice(0, 40) });
  }
  // Overlap: twee regels uit verschillende blokken die elkaar voor > 25 % van de kleinste hoogte raken.
  const overlap = [];
  const blok = (el) => el.closest("p,li,h1,h2,h3,summary,a,button,span.notitie,figcaption,blockquote,address,label,dd,dt,.prijs") || el;
  for (let i = 0; i < blokken.length; i++) {
    for (let j = i + 1; j < blokken.length; j++) {
      const a = blokken[i];
      const b = blokken[j];
      const ba = blok(a.el);
      const bb = blok(b.el);
      if (ba === bb || ba.contains(bb) || bb.contains(ba)) continue;
      for (const ra of a.rects)
        for (const rb of b.rects) {
          const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (x > 2 && y > 0.25 * Math.min(ra.height, rb.height)) overlap.push(`"${a.tekst}" × "${b.tekst}"`);
        }
    }
  }
  // Leeg: geen tekst en geen beeld in het zichtbare deel onder de kopbalk.
  const beelden = Array.from(document.images).filter((im) => {
    const q = im.getBoundingClientRect();
    return im.complete && im.naturalWidth > 0 && q.bottom > 80 && q.top < vh && q.width > 40 && zichtbaar(im);
  });
  const tekstOnderKop = blokken.filter((b) => !b.el.closest("[data-kop]") && b.rects.some((q) => q.bottom > 80));
  // Afgekapt: een kop die breder is dan zijn doos of buiten het scherm valt.
  const afgekapt = Array.from(document.querySelectorAll("h1,h2,h3,.kop-1,.kop-2,.paneel__woord,.slotzin p"))
    .filter((h) => {
      const q = h.getBoundingClientRect();
      if (q.bottom < 0 || q.top > vh || !zichtbaar(h)) return false;
      if (h.closest("[data-scroll-pin-track]")) return h.scrollWidth > h.clientWidth + 2;
      return h.scrollWidth > h.clientWidth + 2 || q.right > vw + 1 || q.left < -1;
    })
    .map((h) => h.textContent.trim().slice(0, 40));
  return {
    y: Math.round(scrollY),
    overlap: overlap.slice(0, 5),
    leeg: tekstOnderKop.length === 0 && beelden.length === 0,
    afgekapt,
    breedte: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

let fouten = 0;
const verslag = [];
for (const route of routes) {
  for (const scherm of SCHERMEN) {
    const browser = await startBrowser();
    const page = await browser.newPage({ viewport: { width: scherm.width, height: scherm.height } });
    const consolefouten = [];
    page.on("pageerror", (e) => consolefouten.push(String(e)));
    page.on("console", (m) => m.type() === "error" && consolefouten.push(m.text()));
    await page.goto(BASIS + route, { waitUntil: "load" });
    await wacht(1500);
    await page.mouse.move(scherm.width * 0.5, scherm.height * 0.55);
    const hoogte = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const aantal = Math.max(12, Math.ceil((hoogte / scherm.height) * 1.4) + 1);
    const standen = Array.from({ length: aantal }, (_, i) => Math.round((hoogte * i) / (aantal - 1)));
    const map = join(UIT, "tmp", `${route.replace(/\//g, "_") || "_"}-${scherm.naam}`);
    rmSync(map, { recursive: true, force: true });
    mkdirSync(map, { recursive: true });
    const metingen = [];
    let leegSinds = null;
    let langLeeg = 0;
    for (let i = 0; i < standen.length; i++) {
      // Echt wielen tot we bij de stand zijn: ±120 px per tik, 16 ms ertussen (menselijk tempo, klok loopt).
      for (let t = 0; t < 200; t++) {
        const y = await page.evaluate(() => scrollY);
        const rest = standen[i] - y;
        if (Math.abs(rest) < 60) break;
        await page.mouse.wheel(0, Math.sign(rest) * Math.min(120, Math.abs(rest)));
        await wacht(16);
      }
      await wacht(650);
      const m = await page.evaluate(meetBeeld);
      const nu = Date.now();
      if (m.leeg) {
        leegSinds ??= nu;
      } else {
        if (leegSinds && nu - leegSinds > 1000) langLeeg++;
        leegSinds = null;
      }
      metingen.push(m);
      await page.screenshot({ path: join(map, `${String(i).padStart(2, "0")}-y${m.y}.png`) });
    }
    if (leegSinds && Date.now() - leegSinds > 1000) langLeeg++;
    await browser.close();
    const overlappend = metingen.filter((m) => m.overlap.length);
    const afgekapt = metingen.filter((m) => m.afgekapt.length);
    const breed = metingen.filter((m) => m.breedte > 0);
    const blad = join(UIT, `${route.replace(/\//g, "_") || "_"}-${scherm.naam}.png`);
    execFileSync("magick", ["montage", "-font", FONT, "-pointsize", "14", "-label", "%t", "-background", "#DDDDD3", "-geometry", scherm.naam === "desktop" ? "480x300+6+6" : "195x422+6+6", "-tile", scherm.naam === "desktop" ? "4x" : "8x", join(map, "*.png"), blad]);
    const ok = !overlappend.length && !langLeeg && !afgekapt.length && !breed.length && !consolefouten.length;
    if (!ok) fouten++;
    const regel = `${ok ? "PASS" : "FAIL"} ${route} ${scherm.naam}: ${metingen.length} beelden · overlap ${overlappend.length} · lang leeg ${langLeeg} · afgekapt ${afgekapt.length} · zijwaarts ${breed.length} · consolefouten ${consolefouten.length} → ${blad}`;
    verslag.push(regel);
    console.log(regel);
    for (const m of overlappend.slice(0, 3)) console.log(`   overlap bij y=${m.y}: ${m.overlap.join(" | ")}`);
    for (const m of afgekapt.slice(0, 3)) console.log(`   afgekapt bij y=${m.y}: ${m.afgekapt.join(" | ")}`);
    for (const f of consolefouten.slice(0, 3)) console.log(`   console: ${f}`);
  }
}
console.log(`doorloop: ${fouten ? "FAIL" : "PASS"} (${verslag.length - fouten}/${verslag.length})`);
process.exit(fouten ? 1 : 0);
