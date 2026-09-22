#!/usr/bin/env node
/**
 * Gewicht en verkeer (AC-T4, AC-T7).
 * - De home tot `load`, zonder te scrollen: ≤ 1,0 MB.
 * - De hero-afbeelding ≤ 200 KB, elke andere afbeelding ≤ 300 KB.
 * - Atomic Marker en Feisty worden vóór de eerste scroll 0 keer opgehaald, en daarna wél.
 * - Zonder toestemming gaan er 0 verzoeken naar een andere host dan de site zelf.
 *   node qa/gewicht-test.mjs
 */
import { startBrowser, BASIS, ROUTES, wacht } from "./lib/browser.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};
const kb = (n) => `${Math.round(n / 102.4) / 10} KB`;

const eigenHost = new URL(BASIS).host;
for (const route of ROUTES) {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const verzoeken = [];
  const vreemdeHosts = [];
  page.on("response", async (r) => {
    const url = new URL(r.url());
    let grootte = Number(r.headers()["content-length"] ?? 0);
    if (!grootte) {
      try {
        grootte = (await r.body()).length;
      } catch {
        grootte = 0;
      }
    }
    verzoeken.push({ url: r.url(), pad: url.pathname, type: r.request().resourceType(), grootte, na: geschrold });
    if (url.host !== eigenHost) vreemdeHosts.push(r.url());
  });
  let geschrold = false;
  await page.goto(BASIS + route, { waitUntil: "load" });
  await wacht(2000);

  // Wat een bezoeker echt binnenhaalt: de verstuurde bytes (gecomprimeerd), via de Resource Timing API.
  const overgedragen = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const bronnen = performance.getEntriesByType("resource");
    return {
      totaal: (nav?.transferSize ?? 0) + bronnen.reduce((s, e) => s + (e.transferSize || 0), 0),
      aantal: bronnen.length + 1,
      grootste: bronnen
        .map((e) => ({ naam: new URL(e.name).pathname.split("/").pop(), bytes: e.transferSize || 0 }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 3),
    };
  });
  const voorScroll = verzoeken.filter((v) => !v.na);
  const totaal = overgedragen.totaal;
  const handschrift = voorScroll.filter((v) => /atomic-marker|feisty/.test(v.pad));
  if (route === "/") {
    meld(
      "AC-T4 home tot load ≤ 1,0 MB",
      totaal <= 1024 * 1024,
      `${kb(totaal)} overgedragen in ${overgedragen.aantal} verzoeken · grootste: ${overgedragen.grootste.map((g) => `${g.naam} ${kb(g.bytes)}`).join(", ")}`,
    );
  }
  meld(`AC-T4 handschriftfonts pas na de eerste scroll (${route})`, handschrift.length === 0, `${handschrift.length} verzoeken vóór de scroll`);

  // Nu scrollen: de kantlijn mag de handschriftfonts ophalen.
  geschrold = true;
  const hoogte = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hoogte; y += 600) {
    await page.mouse.wheel(0, 600);
    await wacht(70);
  }
  await wacht(1500);

  const beelden = verzoeken.filter((v) => v.type === "image" && /_next\/image/.test(v.pad));
  const hero = beelden[0];
  const teZwaar = beelden.filter((v, i) => v.grootte > (i === 0 ? 200 : 300) * 1024);
  if (route === "/") {
    meld("AC-T4 hero ≤ 200 KB", !hero || hero.grootte <= 200 * 1024, hero ? kb(hero.grootte) : "geen beeld");
  }
  meld(`AC-T4 overige beelden ≤ 300 KB (${route})`, teZwaar.length === 0, `${beelden.length} beelden, grootste ${kb(Math.max(0, ...beelden.map((b) => b.grootte)))}`);
  meld(`AC-T7 geen verkeer naar andere hosts (${route})`, vreemdeHosts.length === 0, vreemdeHosts.slice(0, 3).join(", ") || "0 externe verzoeken");

  const naScroll = verzoeken.filter((v) => v.na && /atomic-marker|feisty/.test(v.pad) && v.pad.endsWith(".woff2"));
  if (route === "/") meld("AC-T4 handschriftfonts komen ná de scroll wél", naScroll.length > 0, `${naScroll.length} woff2 (${naScroll.map((v) => `${v.pad.split("/").pop()} ${kb(v.grootte)}`).join(", ")})`);
  await browser.close();
}

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`gewicht-test: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
