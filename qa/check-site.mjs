#!/usr/bin/env node
/**
 * Statische controle op elke pagina (AC-P1, AC-I3, AC-I7, AC-P10, AC-T5, AC-T6, AC-A5).
 *   node qa/check-site.mjs
 * Leest de HTML van de draaiende server; geen browser nodig.
 */
import { BASIS, ROUTES } from "./lib/browser.mjs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://humanmargin.eu";
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
/** Bouwinstructies uit de bron die nooit op de site mogen staan (AC-I3). */
const BOUWINSTRUCTIES = ["=>", "zie aanbod", "Zie manifest", "Knop:", "Logobalk:", "Link naar substack", "TER INFO", "(gaat naar Calendly)", "Geen contactform"];

const fouten = [];
const titels = new Map();
const beschrijvingen = new Map();

const haal = async (pad) => {
  const r = await fetch(BASIS + pad, { redirect: "manual" });
  return { status: r.status, html: await r.text() };
};
const tel = (html, re) => (html.match(re) ?? []).length;

for (const route of ROUTES) {
  const { status, html } = await haal(route);
  // Zonder de scripts: de RSC-lading in de HTML herhaalt teksten, en die ziet een bezoeker niet.
  const zichtbaar = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const f = (t) => fouten.push(`${route}: ${t}`);
  if (status !== 200) f(`status ${status}`);
  if (tel(html, /<h1[\s>]/gi) !== 1) f(`${tel(html, /<h1[\s>]/gi)} h1's (moet 1)`);
  if (!/<html lang="nl"/.test(html)) f("html lang is niet nl");

  const titel = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  if (!titel) f("geen title");
  if (titel.length > 60) f(`title ${titel.length} tekens (max 60): ${titel}`);
  if (titels.has(titel)) f(`title komt ook voor op ${titels.get(titel)}`);
  titels.set(titel, route);

  const beschrijving = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!beschrijving) f("geen description");
  if (beschrijving.length > 155) f(`description ${beschrijving.length} tekens (max 155)`);
  if (beschrijvingen.has(beschrijving)) f(`description komt ook voor op ${beschrijvingen.get(beschrijving)}`);
  beschrijvingen.set(beschrijving, route);

  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical !== `${SITE}${route}`) f(`canonical is ${canonical}, verwacht ${SITE}${route}`);

  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (DEMO && !noindex) f("voorbeeldlink zonder noindex");
  if (!DEMO && noindex) f("noindex op een pagina die geen voorbeeld is");

  for (const woord of ["localhost", "lorem ipsum", "TODO", "PLACEHOLDER"]) if (html.toLowerCase().includes(woord.toLowerCase())) f(`"${woord}" staat in de HTML`);
  for (const b of BOUWINSTRUCTIES) if (html.includes(b)) f(`bouwinstructie "${b}" staat in de HTML`);
  if (html.includes("Leeszaal")) f('"Leeszaal" staat in de HTML terwijl de schakelaar uit staat (AC-P10)');

  const registered = tel(zichtbaar, /®|&#174;|&reg;/g);
  if (registered > 2) f(`® komt ${registered} keer voor in de zichtbare HTML (max 2)`);

  // Alleen de <img> zelf telt; de preload-link in de kop hoort erbij maar is geen afbeelding.
  const prioriteit = tel(zichtbaar, /<img[^>]*fetchpriority="high"/gi);
  if (prioriteit !== 1) f(`${prioriteit} afbeeldingen met fetchpriority="high" (moet 1)`);

  for (const og of ["og:title", "og:description", "og:url", "og:locale", "og:type"]) if (!html.includes(`property="${og}"`)) f(`${og} ontbreekt`);

  // Koppen slaan geen niveau over (AC-A5).
  const niveaus = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < niveaus.length; i++) if (niveaus[i] > niveaus[i - 1] + 1) f(`kop h${niveaus[i]} volgt op h${niveaus[i - 1]}`);

  for (const blok of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(blok[1]);
    } catch (e) {
      f(`ongeldige JSON-LD: ${e.message}`);
    }
  }
}

// Routes die niet mogen bestaan, en de bestanden voor zoekmachines.
const leeszaal = await haal("/leeszaal/");
if (leeszaal.status !== 404) fouten.push(`/leeszaal/ geeft ${leeszaal.status} (moet 404 zijn zolang de schakelaar uit staat)`);
const sitemap = await haal("/sitemap.xml");
const aantalUrls = tel(sitemap.html, /<url>/g);
if (aantalUrls !== ROUTES.length) fouten.push(`sitemap heeft ${aantalUrls} routes (verwacht ${ROUTES.length})`);
if (sitemap.html.includes("leeszaal")) fouten.push("sitemap noemt de leeszaal");
const robots = await haal("/robots.txt");
if (robots.status !== 200 || !robots.html.includes("Sitemap:")) fouten.push("robots.txt ontbreekt of verwijst niet naar de sitemap");
const vierNulVier = await haal("/bestaat-niet/");
if (vierNulVier.status !== 404) fouten.push(`een onbekend adres geeft ${vierNulVier.status} (moet 404)`);

console.log(fouten.length ? `check-site: FAIL (${fouten.length})\n  ${fouten.join("\n  ")}` : `check-site: PASS — ${ROUTES.length} pagina's + 404, titels en beschrijvingen uniek`);
process.exit(fouten.length ? 1 : 0);
