#!/usr/bin/env node
/**
 * Herkomst van alle tekst (AC-I1 en AC-I2).
 *
 * AC-I1  Elke alinea en elk lijstitem uit Els' bronbestanden heeft een plek op de pagina die
 *        PRD-001 §6.1 aanwijst. Uitzonderingen staan hieronder met reden.
 * AC-I2  Elke zichtbare zin van ≥ 4 woorden op de gebouwde pagina's staat letterlijk in de bron,
 *        in docs/copy-nieuw.md of in docs/copy-correcties.md (de "na"-kant).
 *
 *   node qa/herkomst.mjs            (server op BASIS, standaard http://localhost:4610)
 * Exit 0 = 0 bron-eenheden zonder plek én 0 zinnen zonder herkomst.
 */
import { readFileSync } from "node:fs";
import { BASIS, ROUTES } from "./lib/browser.mjs";
import { normaliseer, woorden, zinnen, blokkenUitHtml, eenhedenUitBron } from "./lib/tekst.mjs";

const bron = (naam) => readFileSync(`qa/bron/${naam}`, "utf8");

/** Welke bron hoort bij welke pagina (PRD-001 §6.1). */
const PLEK = [
  { bestand: "home.txt", routes: ["/", "/contact/"] },
  { bestand: "aanbod.txt", routes: ["/aanbod/"] },
  { bestand: "manifest.txt", routes: ["/manifest/"] },
  { bestand: "over-mij.txt", routes: ["/over-mij/"] },
  { bestand: "bedrijfsgegevens.txt", routes: ["/contact/"], perRegel: true },
  { bestand: "brandbook-fragmenten.txt", routes: ["/", "/over-mij/"] },
];

/**
 * Regels uit de bron die géén sitetekst zijn. Elke uitzondering heeft een reden; zonder reden
 * hoort een regel gewoon op de site (AC-I1, AC-I3).
 */
const UITZONDERINGEN = [
  [/^HOMEPAGE HUMAN MARGIN$/i, "kop van het Word-bestand, geen sitetekst"],
  [/^BEDRIJFSGEGEVENS\s*$/i, "kop van het Word-bestand"],
  [/^HET AANBOD VAN HUMAN MARGIN$/i, "titel van het Word-bestand; staat als h1 op /aanbod/"],
  [/=>/, "bouwinstructie (AC-I3)"],
  [/^Knop:/i, "bouwinstructie (AC-I3)"],
  [/^Logobalk:/i, "bouwinstructie (AC-I3)"],
  [/^TER INFO/i, "bouwinstructie (AC-I3)"],
  [/^LEZEN$/i, "sectie Leeszaal staat uit (V10)"],
  [/Link naar substack/i, "sectie Leeszaal staat uit (V10)"],
  [/^Geen contactform/i, "bouwinstructie (AC-I3)"],
  [/^\|$|^v$/i, "pijltje in de ASCII-tekening van de cyclus"],
  [/^\[\d+\]/, "diavermelding in het overgetypte brandbook"],
  [/^# /, "kop van het fragmentenbestand"],
  [/^Linkedin\s*:/i, "adresgegeven; staat als link op /contact/"],
  [/^Human\s+MARGIN\(r\)$/i, "het logo; staat als beeld in de hero"],
];

/** Bouwinstructies tussen haakjes die middenin een regel staan (AC-I3). */
const BOUWINSTRUCTIES = [/\(gaat naar Calendly\)/gi];

const CORRECTIES = "docs/copy-correcties.md";
const NIEUW = "docs/copy-nieuw.md";

/** "vóór → na" uit copy-correcties.md, zodat een gecorrigeerde bronregel ook gevonden wordt. */
const correctieRegels = readFileSync(CORRECTIES, "utf8")
  .split("\n")
  .map((r) => r.split("|").map((c) => c.trim()))
  .filter((c) => c.length >= 5 && /^\d+$/.test(c[1]))
  .map((c) => ({ voor: c[2].replace(/^"|"$/g, ""), na: c[3].replace(/^"|"$/g, "") }))
  .filter((c) => c.voor && c.na);

const paginas = new Map();
for (const route of ROUTES) {
  const html = await (await fetch(BASIS + route)).text();
  paginas.set(route, { html, tekst: normaliseer(blokkenUitHtml(html).join(" ")), blokken: blokkenUitHtml(html) });
}

/* ── AC-I1: elke bron-eenheid heeft een plek ─────────────────────────────────────────────── */
let zonderPlek = 0;
let gecontroleerd = 0;
const gemist = [];
for (const { bestand, routes, perRegel } of PLEK) {
  const doelen = routes.map((r) => paginas.get(r));
  for (const eenheid of eenhedenUitBron(bron(bestand), { perRegel })) {
    const uitzondering = UITZONDERINGEN.find(([re]) => re.test(eenheid));
    if (uitzondering) continue;
    gecontroleerd++;
    let zoek = eenheid;
    for (const re of BOUWINSTRUCTIES) zoek = zoek.replace(re, " ");
    for (const c of correctieRegels) if (zoek.includes(c.voor)) zoek = zoek.split(c.voor).join(c.na);
    const genormaliseerd = normaliseer(zoek);
    if (!genormaliseerd) continue;
    const gevonden = doelen.some((p) => p.tekst.includes(genormaliseerd));
    if (!gevonden) {
      zonderPlek++;
      gemist.push(`${bestand}: "${eenheid.slice(0, 90)}"`);
    }
  }
}

/* ── AC-I2: elke zichtbare zin ≥ 4 woorden komt uit de bron of uit de copy-bestanden ──────── */
// De bron mét de correcties erin verwerkt: een verbeterde tikfout hoort bij dezelfde bronzin.
const metCorrecties = (tekst) => correctieRegels.reduce((t, c) => t.split(c.voor).join(c.na), tekst);
const corpusDelen = [
  ...PLEK.map(({ bestand }) => metCorrecties(bron(bestand))),
  bron("leeszaal.txt"),
  readFileSync(NIEUW, "utf8"),
  readFileSync(CORRECTIES, "utf8"),
];
const corpus = normaliseer(corpusDelen.join("\n"));
let zonderHerkomst = 0;
let zinnenGeteld = 0;
const vreemd = [];
for (const [route, p] of paginas) {
  for (const blok of p.blokken) {
    for (const zin of zinnen(blok)) {
      const w = woorden(zin);
      if (w.length < 4) continue;
      zinnenGeteld++;
      if (!corpus.includes(w.join(" "))) {
        zonderHerkomst++;
        vreemd.push(`${route}: "${zin.slice(0, 100)}"`);
      }
    }
  }
}

console.log(`herkomst: ${gecontroleerd} bron-eenheden gecontroleerd → ${zonderPlek} zonder plek`);
for (const g of gemist.slice(0, 25)) console.log(`   ONTBREEKT ${g}`);
console.log(`herkomst: ${zinnenGeteld} zichtbare zinnen (≥ 4 woorden) → ${zonderHerkomst} zonder herkomst`);
for (const v of vreemd.slice(0, 25)) console.log(`   ZONDER BRON ${v}`);
const ok = zonderPlek === 0 && zonderHerkomst === 0;
console.log(`herkomst: ${ok ? "PASS" : "FAIL"} (${zonderPlek}/${zonderHerkomst})`);
process.exit(ok ? 0 : 1);
