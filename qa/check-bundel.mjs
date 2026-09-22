#!/usr/bin/env node
/**
 * Wat er niet in de bundel mag staan (PRD-001 §4.2, AC-T7).
 * Zonder GA-meet-ID hoort er geen regel Google Analytics in de productiebundel te staan: Next bakt
 * een ontbrekende NEXT_PUBLIC-variabele niet in en snoeit de code erachter dan ook niet weg —
 * daarom krijgt elke schakelaar een standaardwaarde in next.config.ts, en controleert dit script
 * of dat ook echt gewerkt heeft. Zoekt ook naar sporen van de template (Fares, Bakker, Unsplash).
 *   node qa/check-bundel.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const heeftGa = (process.env.NEXT_PUBLIC_GA_ID ?? "") !== "";
const bestanden = [];
const loop = (map) => {
  for (const naam of readdirSync(map)) {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) loop(pad);
    else if (/\.(js|css)$/.test(naam)) bestanden.push(pad);
  }
};
const DIST = process.env.QA_DIST ?? ".next";
loop(join(DIST, "static"));

const verboden = [
  ...(heeftGa ? [] : [/googletagmanager/i, /gtag\(/]),
  /faresmasharawi/i,
  /fysio ?bakker/i,
  /unsplash/i,
  /example\.com/i,
  /clone-website/i,
];
const fouten = [];
for (const pad of bestanden) {
  const inhoud = readFileSync(pad, "utf8");
  for (const re of verboden) if (re.test(inhoud)) fouten.push(`${pad}: ${re}`);
}
// De HTML mag nergens naar localhost wijzen (canonical, OG, sitemap).
const html = [];
const loopHtml = (map) => {
  for (const naam of readdirSync(map)) {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) loopHtml(pad);
    else if (/\.(html|xml|txt|rsc)$/.test(naam)) html.push(pad);
  }
};
loopHtml(".next/server/app");
for (const pad of html) if (/localhost/i.test(readFileSync(pad, "utf8"))) fouten.push(`${pad}: localhost`);

console.log(
  fouten.length
    ? `check-bundel: FAIL\n  ${fouten.slice(0, 20).join("\n  ")}`
    : `check-bundel: PASS — ${bestanden.length} bundelbestanden, ${html.length} pagina's; 0 treffers${heeftGa ? " (met GA-ID: googletagmanager toegestaan)" : ""}`,
);
process.exit(fouten.length ? 1 : 0);
