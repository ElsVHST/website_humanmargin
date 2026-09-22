#!/usr/bin/env node
/**
 * Ligt elke knoptekst écht op de kwaststreep? (AC-M1, AC-A1 — de leesbaarheid van de knoppen.)
 *
 * De knop is zwarte tekst op een gele kwaststreep in een SVG. Een SVG-achtergrond wordt standaard
 * mét behoud van verhouding in zijn vlak gepast, en dan blijft er links en rechts een strook over
 * zonder inkt: daar staat zwarte tekst op een zwarte achtergrond en leest de knop als
 * "AN EEN KENNISMAKING". Geen enkele meting op kleurwaarden ziet dat, want de kleuren kloppen —
 * het is de plék die niet klopt. Daarom meet dit script pixels: waar zit het geel, en waar de tekst.
 *
 * Per knop, op drie schermbreedtes: de gele inkt moet de hele regel tekst dekken, met wat marge.
 *
 *   node qa/knop-test.mjs
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { startBrowser, BASIS, ROUTES, wacht } from "./lib/browser.mjs";

const sharp = createRequire(import.meta.url)("sharp");

const UIT = "qa/uitvoer/knoppen";
mkdirSync(UIT, { recursive: true });

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

const isGeel = (r, g, b) => g > 170 && r > 150 && b < 140;

let bekeken = 0;
const fouten = [];

for (const breedte of [1440, 1024, 390]) {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: breedte, height: 900 } });
  for (const route of ROUTES) {
    await page.goto(BASIS + route, { waitUntil: "load" });
    // Wachten tot de pagina stilligt: de letters binnen, de invaders klaar. Fotografeer je
    // halverwege een overgang, dan meet je een halfdoorzichtige knop en dus een kleur die nergens
    // op de site voorkomt.
    await page.evaluate(() => document.fonts.ready);
    await wacht(2200);
    const knoppen = await page.evaluate(() => {
      const uit = [];
      for (const el of document.querySelectorAll(".knop")) {
        const r = el.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) continue; // staat niet in beeld (mobiel menu dicht)
        if (r.top < 0 || r.bottom > innerHeight) continue; // buiten het venster: niet te fotograferen
        const bereik = document.createRange();
        bereik.selectNodeContents(el);
        const t = bereik.getBoundingClientRect();
        uit.push({
          tekst: el.textContent.trim(),
          knop: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          tekstvak: { links: Math.round(t.left), rechts: Math.round(t.right), boven: Math.round(t.top), onder: Math.round(t.bottom) },
        });
      }
      return uit;
    });

    for (const k of knoppen) {
      bekeken++;
      const marge = 6;
      const vak = {
        x: Math.max(0, k.knop.x - marge),
        y: Math.max(0, k.knop.y - marge),
        width: Math.min(breedte - Math.max(0, k.knop.x - marge), k.knop.w + marge * 2),
        height: k.knop.h + marge * 2,
      };
      const buf = await page.screenshot({ clip: vak });
      const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      const png = { width: info.width, height: info.height, kanalen: info.channels, data };
      // Per beeldrij van de tekst: waar begint en eindigt het geel?
      let links = Infinity;
      let rechts = -Infinity;
      const y0 = Math.max(0, k.tekstvak.boven - vak.y);
      const y1 = Math.min(png.height - 1, k.tekstvak.onder - vak.y);
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < png.width; x++) {
          const i = (png.width * y + x) * png.kanalen;
          if (isGeel(png.data[i], png.data[i + 1], png.data[i + 2])) {
            if (x < links) links = x;
            if (x > rechts) rechts = x;
          }
        }
      }
      const tekstLinks = k.tekstvak.links - vak.x;
      const tekstRechts = k.tekstvak.rechts - vak.x;
      const dekt = links <= tekstLinks && rechts >= tekstRechts;
      if (!dekt) {
        fouten.push(`${route} ${breedte}px "${k.tekst}": inkt ${links}–${rechts}, tekst ${tekstLinks}–${tekstRechts}`);
        await page.screenshot({ path: `${UIT}/knop-${breedte}-${k.tekst.slice(0, 12).replace(/\W+/g, "-")}.png`, clip: vak });
      }
    }
  }
  await browser.close();
}

meld("de tekst van elke knop ligt volledig op de kwaststreep", fouten.length === 0, `${bekeken} knoppen bekeken${fouten.length ? ` · ${fouten.slice(0, 3).join(" | ")}` : ""}`);

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`knop-test: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
