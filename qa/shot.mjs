#!/usr/bin/env node
/**
 * Schermafbeeldingen om zelf te bekijken.
 *   node qa/shot.mjs <route> <breedte> <hoogte> [vol|<scrollY,...>] [uitmap]
 * vol = de hele pagina; anders één beeld per scrollstand. Echt gescrold, klok loopt.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startBrowser, BASIS, wacht } from "./lib/browser.mjs";

const [route = "/", b = "1440", h = "900", stand = "vol", uit = "qa/uitvoer/shots"] = process.argv.slice(2);
mkdirSync(uit, { recursive: true });
const browser = await startBrowser();
const page = await browser.newPage({ viewport: { width: Number(b), height: Number(h) } });
await page.goto(BASIS + route, { waitUntil: "networkidle" });
await wacht(1600);
const naam = route.replace(/\//g, "_") || "_";
if (stand === "vol") {
  // Scroll eerst langzaam door, zodat onthullingen en notities zijn afgespeeld.
  const hoogte = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hoogte; y += Number(h) * 0.6) {
    await page.mouse.wheel(0, Number(h) * 0.6);
    await wacht(180);
  }
  await wacht(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wacht(600);
  const pad = join(uit, `${naam}-${b}-vol.png`);
  await page.screenshot({ path: pad, fullPage: true });
  console.log(pad);
} else {
  for (const y of stand.split(",").map(Number)) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await wacht(900);
    const pad = join(uit, `${naam}-${b}-${y}.png`);
    await page.screenshot({ path: pad });
    console.log(pad);
  }
}
await browser.close();
