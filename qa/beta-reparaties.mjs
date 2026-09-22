#!/usr/bin/env node
/**
 * De bevindingen van de beta-tester, stuk voor stuk nagemeten (F8).
 *
 * Elke reparatie sluit af met de meting die het gebrek aantoonde — niet met "ziet er goed uit".
 * Wat hier groen staat, stond eerder rood, met dezelfde meting.
 *
 *   BASIS=http://localhost:4770 node qa/beta-reparaties.mjs
 */
import { startBrowser, BASIS, wacht } from "./lib/browser.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

async function metPagina(breedte, route, werk) {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: breedte, height: breedte === 390 ? 844 : 900 } });
  await page.goto(BASIS + route, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await wacht(1800);
  try {
    await werk(page);
  } finally {
    await browser.close();
  }
}

/* ── HOOG: de keuzehulp stond linksboven in de hoek ──────────────────────────────────────── */
for (const breedte of [1440, 390]) {
  await metPagina(breedte, "/", async (page) => {
    await page.locator('.knop:has-text("Stel je vraag"), a:has-text("Stel je vraag"), button:has-text("Stel je vraag")').first().click();
    await wacht(600);
    const m = await page.evaluate(() => {
      const d = document.querySelector("dialog.keuzehulp");
      if (!d || !d.open) return null;
      const r = d.getBoundingClientRect();
      return { links: Math.round(r.left), rechts: Math.round(r.right), boven: Math.round(r.top), onder: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, marge: getComputedStyle(d).margin };
    });
    if (!m) return meld(`keuzehulp opent (${breedte}px)`, false, "de dialoog ging niet open");
    const midden = Math.abs((m.links + m.rechts) / 2 - m.vw / 2) <= 2 && Math.abs((m.boven + m.onder) / 2 - m.vh / 2) <= 2;
    meld(`de keuzehulp staat gecentreerd (${breedte}px)`, midden, `x ${m.links}–${m.rechts} in ${m.vw} · y ${m.boven}–${m.onder} in ${m.vh} · margin ${m.marge}`);
  });
}

/* ── GEMIDDELD: doorhaling en omcirkeling werden ingepast in plaats van uitgerekt ────────── */
await metPagina(1440, "/manifest/", async (page) => {
  // Eerst scrollen en laten uitrollen (de site scrollt zacht), dán pas meten. Meet je vóór de
  // foto, dan is de pagina ondertussen nog een stuk opgeschoven en kijk je naast het woord.
  const gevonden = await page.evaluate(async () => {
    const el = document.querySelector(".doorhaling");
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  });
  if (!gevonden) return meld("de doorhaling dekt het hele woord", false, "geen doorhaling gevonden");
  await wacht(600);
  const m = await page.evaluate(() => {
    const el = document.querySelector(".doorhaling");
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), tekst: el.textContent };
  });
  // Het hele venster fotograferen en daarin naar blauw zoeken op de regel van het woord. Een
  // uitgeknipt vakje is fragiel: één pixel verschuiving en je meet niets.
  const heleVenster = await page.screenshot();
  const { createRequire } = await import("node:module");
  const sharp = createRequire(import.meta.url)("sharp");
  const { data, info } = await sharp(heleVenster).raw().toBuffer({ resolveWithObject: true });
  let links = Infinity;
  let rechts = -Infinity;
  const vanY = Math.max(0, m.y - 2);
  const totY = Math.min(info.height - 1, m.y + m.h + 2);
  for (let y = vanY; y <= totY; y++) {
    for (let x = Math.max(0, m.x - 20); x < Math.min(info.width, m.x + m.w + 20); x++) {
      const i = (info.width * y + x) * info.channels;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // Een dunne blauwe lijn op zwart komt als donkerblauw uit de antialiasing; blauw herken je
      // hier aan de verhouding tussen de kanalen, niet aan een hoge absolute waarde.
      if (b > 60 && b - r > 40 && b - g > 30) {
        if (x < links) links = x;
        if (x > rechts) rechts = x;
      }
    }
  }
  const dekking = links === Infinity ? 0 : Math.round(((rechts - links) / m.w) * 100);
  meld("de doorhaling dekt het hele woord", dekking >= 90, `"${m.tekst}" is ${m.w} px breed op x=${m.x}, y=${m.y}; de streep dekt ${dekking} % (blauw van ${links} tot ${rechts})`);
  if (dekking < 90) await sharp(heleVenster).toFile("qa/uitvoer/doorhaling-meting.png");
});

/* ── GEMIDDELD: de pagina scrollde door achter het mobiele menu ───────────────────────────── */
await metPagina(390, "/", async (page) => {
  await page.locator("button.kop__menuknop").first().click();
  await wacht(500);
  const voor = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 900);
  await wacht(500);
  const na = await page.evaluate(() => scrollY);
  await page.keyboard.press("Escape");
  await wacht(400);
  const naSluiten = await page.evaluate(() => scrollY);
  meld("de pagina blijft staan achter het open menu", voor === na && na === naSluiten, `voor ${voor} · tijdens ${na} · na sluiten ${naSluiten}`);
});

/* ── GEMIDDELD: gat in de gele contactsectie op 1440 ─────────────────────────────────────── */
await metPagina(1440, "/contact/", async (page) => {
  const m = await page.evaluate(async () => {
    const blok = document.querySelector(".contactblok");
    if (!blok) return null;
    blok.scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 600));
    const kinderen = [...blok.children].map((k) => ({ naam: k.className || k.tagName, y: Math.round(k.getBoundingClientRect().top) }));
    return kinderen;
  });
  if (!m || m.length < 2) return meld("de twee kolommen op /contact/ beginnen op dezelfde hoogte", false, "kolommen niet gevonden");
  const verschil = Math.abs(m[0].y - m[1].y);
  meld("de twee kolommen op /contact/ beginnen op dezelfde hoogte", verschil <= 8, `${m.map((k) => `${k.naam.split(" ")[0]} op y=${k.y}`).join(" · ")} (verschil ${verschil} px)`);
});

/* ── LAAG: op de 404 stond de zin ná de knop ─────────────────────────────────────────────── */
await metPagina(1440, "/bestaat-niet-1234/", async (page) => {
  const m = await page.evaluate(() => {
    const zin = document.querySelector(".opening__lead p");
    const knop = document.querySelector(".opening__knoppen .knop");
    if (!zin || !knop) return null;
    return { zinY: Math.round(zin.getBoundingClientRect().top), knopY: Math.round(knop.getBoundingClientRect().top), volgorde: zin.compareDocumentPosition(knop) & Node.DOCUMENT_POSITION_FOLLOWING ? "zin eerst" : "knop eerst" };
  });
  if (!m) return meld("op de 404 staat de zin vóór de knop", false, "niet gevonden");
  meld("op de 404 staat de zin vóór de knop", m.volgorde === "zin eerst" && m.zinY < m.knopY, `${m.volgorde} · zin y=${m.zinY}, knop y=${m.knopY}`);
});

/* ── LAAG: de focusring van de panelenrij viel buiten beeld ──────────────────────────────── */
await metPagina(1440, "/", async (page) => {
  const m = await page.evaluate(() => {
    const spoor = document.querySelector(".panelen [data-scroll-pin-track]");
    if (!spoor) return null;
    spoor.focus();
    const s = getComputedStyle(spoor);
    return { offset: s.outlineOffset, breedte: Math.round(spoor.getBoundingClientRect().width), vw: innerWidth };
  });
  if (!m) return meld("de focusring van de panelenrij valt binnen het venster", false, "spoor niet gevonden");
  const binnen = parseFloat(m.offset) < 0 || m.breedte < m.vw - 8;
  meld("de focusring van de panelenrij valt binnen het venster", binnen, `outline-offset ${m.offset} · spoor ${m.breedte} px in een venster van ${m.vw}`);
});

/* ── GEMIDDELD: de pijl in de cyclus was op mobiel een streepje ──────────────────────────── */
await metPagina(390, "/aanbod/", async (page) => {
  await page.evaluate(() => document.querySelector(".cyclus__pijl")?.scrollIntoView({ block: "center", behavior: "instant" }));
  await wacht(1000);
  const m = await page.evaluate(() => {
    const el = document.querySelector(".cyclus__pijl");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (!m) return meld("de pijl in de cyclus is op mobiel een pijl, geen streepje", false, "geen pijl gevonden");
  const beeld = await page.screenshot();
  const { createRequire } = await import("node:module");
  const sharp = createRequire(import.meta.url)("sharp");
  const { data, info } = await sharp(beeld).raw().toBuffer({ resolveWithObject: true });
  let boven = Infinity;
  let onder = -Infinity;
  for (let y = Math.max(0, m.y - 10); y < Math.min(info.height, m.y + m.h + 10); y++) {
    for (let x = Math.max(0, m.x - 10); x < Math.min(info.width, m.x + m.w + 10); x++) {
      const i = (info.width * y + x) * info.channels;
      if (data[i + 2] > 60 && data[i + 2] - data[i] > 40 && data[i + 2] - data[i + 1] > 30) {
        if (y < boven) boven = y;
        if (y > onder) onder = y;
      }
    }
  }
  const lengte = boven === Infinity ? 0 : onder - boven;
  meld("de pijl in de cyclus is op mobiel een pijl, geen streepje", lengte >= 28, `${lengte} px blauw over de hoogte (vak ${m.w}×${m.h})`);
});

/* ── LAAG: een pijl werd vooraf opgehaald en niet gebruikt ───────────────────────────────── */
{
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const waarschuwingen = [];
  page.on("console", (m) => m.type() === "warning" && waarschuwingen.push(m.text()));
  await page.goto(BASIS + "/aanbod/", { waitUntil: "load" });
  await wacht(4000);
  const preload = waarschuwingen.filter((w) => w.includes("preloaded") && w.includes("not used"));
  meld("niets wordt vooraf opgehaald zonder gebruikt te worden", preload.length === 0, preload[0]?.slice(0, 120) ?? "0 waarschuwingen");
  await browser.close();
}

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`beta-reparaties: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
