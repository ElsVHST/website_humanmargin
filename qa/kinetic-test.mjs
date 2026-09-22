#!/usr/bin/env node
/**
 * Kinetic-type op de slotzin van het manifest (AC-B8, F6). Twee eisen:
 *   1. het font moet een breedte-as hebben die werkt: hetzelfde woord is bij wdth 84 smaller dan
 *      bij wdth 100. Een font zonder die as levert exact dezelfde breedte op — dan gaat de feature
 *      uit, want het "dichtdrukken" is dan alleen een idee, geen beweging;
 *   2. het font mag niet vloeken naast Archivo Black. Daarover oordeelt een mens, met de
 *      schermafbeelding die dit script maakt.
 *
 * Het meet in de pagina zelf, op het element dat de feature gebruikt — niet op een los proefwoord
 * in een lege pagina, want dan meet je een font dat de site misschien niet eens laadt.
 *
 *   node qa/kinetic-test.mjs
 */
import { mkdirSync } from "node:fs";
import { startBrowser, BASIS, wacht } from "./lib/browser.mjs";

const UIT = "qa/uitvoer/kinetic";
mkdirSync(UIT, { recursive: true });

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

const browser = await startBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASIS + "/manifest/", { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await wacht(700);
// Scrollen zoals een bezoeker: de feature volgt de scrollstand, dus halverwege meet je een
// halve animatie. Pas onderaan de pagina staat de slotzin in haar eindstand.
const hoog = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < hoog; y += 400) {
  await page.mouse.wheel(0, 400);
  await wacht(70);
}
await wacht(1800);

const meting = await page.evaluate(async () => {
  const el = document.querySelector("[data-kinetic-type]");
  if (!el) return { fout: "geen element met data-kinetic-type op /manifest/" };
  const stijl = getComputedStyle(el);
  await document.fonts.ready;

  // Meet hetzelfde woord in hetzelfde font, op twee breedtes. Een eigen span in dezelfde ouder,
  // zodat elke erfenis (grootte, letterafstand, transform) gelijk is.
  const proef = document.createElement("span");
  proef.textContent = el.textContent.trim().split(/\s+/)[0] || "Nieuwsgierigheid";
  proef.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
  // Alle letterinstellingen van het échte element overnemen; erven van de ouder meet een ander
  // font en een andere maat, en dan lijkt de as dood terwijl hij nooit gemeten is.
  for (const veld of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "textTransform", "fontFeatureSettings", "fontOpticalSizing"]) proef.style[veld] = stijl[veld];
  el.parentElement.appendChild(proef);
  const breedte = () => {
    proef.getBoundingClientRect();
    return Math.round(proef.getBoundingClientRect().width * 100) / 100;
  };
  // Twee wegen naar dezelfde as: de nette eigenschap en de rechtstreekse as-instelling.
  proef.style.fontVariationSettings = "normal";
  proef.style.fontStretch = "100%";
  const b100 = breedte();
  proef.style.fontStretch = "84%";
  const b84 = breedte();
  proef.style.fontStretch = "normal";
  proef.style.fontVariationSettings = '"wdth" 84';
  const bAs84 = breedte();
  proef.style.fontVariationSettings = '"wdth" 100';
  const bAs100 = breedte();
  const woord = proef.textContent;
  proef.remove();

  return {
    woord,
    b100,
    b84,
    bAs100,
    bAs84,
    familie: stijl.fontFamily,
    grootte: stijl.fontSize,
    aanwezig: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
  };
});

if (meting.fout) {
  meld("AC-B8 de slotzin gebruikt kinetic-type", false, meting.fout);
} else {
  const procent = (((meting.b100 - meting.b84) / meting.b100) * 100).toFixed(1);
  const procentAs = (((meting.bAs100 - meting.bAs84) / meting.bAs100) * 100).toFixed(1);
  meld(
    "AC-B8 de breedte-as werkt: wdth 84 is smaller dan wdth 100",
    meting.b84 < meting.b100 - 0.5 || meting.bAs84 < meting.bAs100 - 0.5,
    `"${meting.woord}" op ${meting.grootte}: font-stretch ${meting.b100} → ${meting.b84} px (${procent} %), wdth-as ${meting.bAs100} → ${meting.bAs84} px (${procentAs} %) · font ${meting.familie}`,
  );
}

// De eindstand: onderaan de pagina hoort de zin dichtgedrukt en op volle kleur te staan.
const eind = await page.evaluate(() => {
  const el = document.querySelector(".slotzin__regel[data-kinetic-type]:last-child") || document.querySelector("[data-kinetic-type]");
  const s = getComputedStyle(el);
  return { as: s.fontVariationSettings, dekking: Number(s.getPropertyValue("--kt-b").trim() || 1), kleur: s.color };
});
const wdth = Number(/"wdth"\s*([\d.]+)/.exec(eind.as)?.[1] ?? 100);
meld("AC-B8 onderaan de pagina staat de zin dichtgedrukt en op volle kleur", wdth <= 90 && eind.dekking >= 0.9, `wdth ${wdth} · dekking ${eind.dekking} · ${eind.kleur}`);

// Het oordeel over de vorm hoort bij een mens: Archivo Black en de variabele Archivo naast elkaar.
await page.screenshot({ path: `${UIT}/slotzin-eindstand.png` });
console.log(`beeld: ${UIT}/slotzin-eindstand.png (Archivo Black boven, variabele Archivo onder)`);

await browser.close();

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`kinetic-test: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
