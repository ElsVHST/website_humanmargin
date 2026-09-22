#!/usr/bin/env node
/**
 * Het contentcontract (AC-P9) en de schakelaar van de Leeszaal (AC-P10).
 * In een aparte bouw, in een tijdelijke map: een nieuw paginabestand met alle zes bouwstenen moet
 * een nieuwe statische route opleveren, met kop, voet en merkopmaak. Tegelijk gaat de schakelaar
 * van de Leeszaal aan, zodat te zien is dat die pagina en het menu-item dan wél verschijnen.
 * De echte bouw blijft ongemoeid en bevat 0 testpagina's.
 *   node qa/contract-test.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { proefBouw } from "./lib/tijdelijk.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

const TESTPAGINA = {
  slug: "proefpagina-contract",
  titel: "Proefpagina contract | Human Margin",
  beschrijving: "Tijdelijke pagina van de controlereeks; hoort nooit in een echte bouw te staan.",
  kop: "Proefpagina van de controle",
  secties: [
    {
      id: "inhoud",
      type: "tekst",
      achtergrond: "licht",
      bouwstenen: [
        { type: "kop", tekst: "Een kop uit een bouwsteen", niveau: 2 },
        { type: "alinea", tekst: "Een alinea uit een bouwsteen, met genoeg woorden om te meten." },
        { type: "citaat", tekst: "Een citaat uit een bouwsteen." },
        { type: "foto", beeld: "els-zebrapad-van-boven" },
        { type: "lijst", items: ["Eerste punt van de lijst", "Tweede punt van de lijst"] },
        { type: "knop", tekst: "Plan een kennismaking", doel: "kennismaking" },
      ],
    },
  ],
};

const proefPad = join("content", "paginas", `${TESTPAGINA.slug}.json`);
const kopie = await proefBouw({
  naam: "contract",
  tijdelijkeBestanden: [proefPad],
  async wijzig({ bewaar }) {
    bewaar(join("content", "site.json"));
    writeFileSync(proefPad, JSON.stringify(TESTPAGINA, null, 2));
    const site = JSON.parse(readFileSync(join("content", "site.json"), "utf8"));
    site.schakelaars.leeszaal = true;
    writeFileSync(join("content", "site.json"), JSON.stringify(site, null, 2));
  },
});

const haal = async (pad) => {
  const r = await fetch(kopie.basis + pad);
  return { status: r.status, html: await r.text() };
};

const nieuw = await haal(`/${TESTPAGINA.slug}/`);
const heeftOnderdelen = ["Een kop uit een bouwsteen", "Een alinea uit een bouwsteen", "Een citaat uit een bouwsteen", "Eerste punt van de lijst", "Plan een kennismaking"].every((t) => nieuw.html.includes(t));
const heeftKader = nieuw.html.includes("data-kop") && nieuw.html.includes("class=\"voet") && nieuw.html.includes("kop-1");
meld("AC-P9 een nieuw contentbestand geeft een nieuwe pagina", nieuw.status === 200 && heeftOnderdelen && heeftKader, `status ${nieuw.status} · alle bouwstenen ${heeftOnderdelen} · kop en voet ${heeftKader}`);

const statisch = readdirSync(join(kopie.dist, "server", "app"), { recursive: true }).filter((p) => String(p).includes(TESTPAGINA.slug) && String(p).endsWith(".html"));
meld("AC-P9 de nieuwe pagina is statisch voorgerenderd", statisch.length > 0, statisch.join(", "));

const leeszaal = await haal("/leeszaal/");
const home = await haal("/");
meld("AC-P10 met de schakelaar aan bestaat de Leeszaal en staat hij in het menu", leeszaal.status === 200 && home.html.includes("Leeszaal"), `status ${leeszaal.status} · menu-item ${home.html.includes("Leeszaal")}`);

kopie.stop();

// De echte bouw mag geen spoor van de proefpagina bevatten.
const echteBouw = readdirSync(join(".next", "server", "app"), { recursive: true }).filter((p) => String(p).includes("proefpagina"));
meld("AC-P9 de productiebouw bevat 0 testpagina's", echteBouw.length === 0, `${echteBouw.length} treffers`);
const terug = JSON.parse(readFileSync(join("content", "site.json"), "utf8"));
meld("de schakelaar van de Leeszaal staat na de proef weer uit", terug.schakelaars.leeszaal === false, `leeszaal = ${terug.schakelaars.leeszaal}`);

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`contract-test: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
