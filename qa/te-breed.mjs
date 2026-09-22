#!/usr/bin/env node
/** Zoekt welk element te ver naar rechts staat. node qa/te-breed.mjs <route> <breedte> */
import { startBrowser, BASIS, wacht } from "./lib/browser.mjs";

const [route = "/", breedte = "320"] = process.argv.slice(2);
const browser = await startBrowser();
const page = await browser.newPage({ viewport: { width: Number(breedte), height: 844 } });
await page.goto(BASIS + route, { waitUntil: "load" });
await wacht(1200);
const lijst = await page.evaluate((vw) => {
  const uit = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5) uit.push({ tag: el.tagName.toLowerCase(), klasse: el.className?.toString().slice(0, 60), rechts: Math.round(r.right), breedte: Math.round(r.width), tekst: (el.textContent || "").trim().slice(0, 30) });
  }
  return uit.slice(0, 15);
}, Number(breedte));
console.log(`${route} @${breedte}: ${lijst.length} elementen voorbij de rand`);
for (const l of lijst) console.log(`  ${l.tag}.${l.klasse} rechts=${l.rechts} breedte=${l.breedte} "${l.tekst}"`);
await browser.close();
