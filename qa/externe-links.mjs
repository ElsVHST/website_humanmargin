#!/usr/bin/env node
/**
 * Externe links (AC-T9): Calendly, LinkedIn, Co-Creatie.ai en eventuele klantsites geven 200 of 3xx
 * bij één verzoek. LinkedIn antwoordt vaak met 999 op een bot; dat melden we als bekende meetfout,
 * niet als kapotte link. Dit script vraagt internet; het draait apart van `npm run qa`.
 *   node qa/externe-links.mjs
 */
import { BASIS, ROUTES } from "./lib/browser.mjs";

/*
 * Alleen adressen bij anderen. De eigen domeinnaam staat ook in de HTML (canonical, Open Graph,
 * sitemap) en wijst naar een site die nog niet bestaat: die meerekenen levert 404's op die niets
 * met deze bouw te maken hebben.
 */
const eigenHost = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://humanmargin.eu").host;
const adressen = new Set();
const eigen = new Set();
for (const route of ROUTES) {
  const html = await (await fetch(BASIS + route)).text();
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const adres = m[1].replace(/&amp;/g, "&");
    if (new URL(adres).host === eigenHost) eigen.add(adres);
    else adressen.add(adres);
  }
}

const fouten = [];
const meldingen = [];
for (const adres of adressen) {
  try {
    const r = await fetch(adres, { method: "GET", redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36" } });
    const ok = r.status < 400;
    const bekend = r.status === 999 && adres.includes("linkedin.com");
    meldingen.push(`${r.status} ${adres}`);
    if (!ok && !bekend) fouten.push(`${adres}: status ${r.status}`);
  } catch (e) {
    fouten.push(`${adres}: ${e.message}`);
  }
}

console.log(meldingen.join("\n"));
console.log(`(${eigen.size} adressen op ${eigenHost} overgeslagen: de site staat daar nog niet)`);
console.log(fouten.length ? `externe-links: FAIL\n  ${fouten.join("\n  ")}` : `externe-links: PASS — ${adressen.size} adressen bij anderen`);
process.exit(fouten.length ? 1 : 0);
