#!/usr/bin/env node
/**
 * De tegenproef: een controle die nooit rood kan worden, controleert niets.
 *
 * Dit script bouwt per controle één keer een kapotte versie van de site, draait de bijbehorende
 * controle, en eist dat die dan rood wordt (exit ≠ 0). Daarna zet het alles terug. De uitkomst
 * komt in qa/tegenproeven.txt te staan, met de echte melding erbij.
 *
 *   node qa/tegenproef.mjs            alle tegenproeven
 *   node qa/tegenproef.mjs herkomst   alleen deze
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { proefBouw } from "./lib/tijdelijk.mjs";

const HOME = join("content", "paginas", "home.json");
const CSS = join("src", "app", "globals.css");
const FEISTY = join("public", "fonts", "feisty", "feisty.css");
const BANNER = join("src", "components", "Cookiebanner.tsx");

const lees = (p) => readFileSync(p, "utf8");
const json = (p) => JSON.parse(lees(p));

/**
 * Elke tegenproef: wat gaat er stuk, welke controle moet dat zien, en heeft die een draaiende
 * site nodig? `wijzig` krijgt `bewaar`, dat een bestand veiligstelt voor het teruggezet wordt.
 */
const PROEVEN = [
  {
    naam: "content-check",
    breekt: "de titel weghalen uit content/paginas/home.json",
    script: "qa/content-check.mjs",
    bouw: false,
    wijzig({ bewaar }) {
      bewaar(HOME);
      const p = json(HOME);
      delete p.titel;
      writeFileSync(HOME, JSON.stringify(p, null, 2));
    },
  },
  {
    naam: "herkomst",
    breekt: "een zin op de homepage zetten die niet van Els is",
    script: "qa/herkomst.mjs",
    bouw: true,
    wijzig({ bewaar }) {
      bewaar(HOME);
      const p = json(HOME);
      const sectie = p.secties.find((s) => s.bouwstenen?.some((b) => b.type === "alinea"));
      sectie.bouwstenen.unshift({ type: "alinea", tekst: "Wij leveren naadloze oplossingen voor uw organisatie, volledig ontzorgd." });
      writeFileSync(HOME, JSON.stringify(p, null, 2));
    },
  },
  {
    naam: "kleuren",
    breekt: "een zesde kleur in de stijl zetten (#ff0000 op elke sectie)",
    script: "qa/kleuren.mjs",
    bouw: true,
    wijzig({ bewaar }) {
      bewaar(CSS);
      writeFileSync(CSS, lees(CSS) + "\n.sectie p { color: #ff0000; }\n");
    },
  },
  {
    naam: "contrast-axe",
    breekt: "de lopende tekst lichtgrijs maken op een lichte achtergrond",
    script: "qa/contrast-axe.mjs",
    bouw: true,
    wijzig({ bewaar }) {
      bewaar(CSS);
      writeFileSync(CSS, lees(CSS) + '\n.sectie[data-achtergrond="licht"] p { color: #9a9a95; }\n');
    },
  },
  {
    naam: "licentie",
    breekt: "het licentieblok uit de CSS van Feisty halen",
    script: "qa/licentie.mjs",
    bouw: true,
    wijzig({ bewaar }) {
      bewaar(FEISTY);
      writeFileSync(FEISTY, lees(FEISTY).replace(/All details above must always remain unaltered and visible in your CSS/i, "-"));
    },
  },
  {
    naam: "check-bundel",
    breekt: "bouwen mét meet-ID, terwijl de controle uitgaat van een bouw zonder",
    script: "qa/check-bundel.mjs",
    bouw: true,
    bouwEnv: { NEXT_PUBLIC_GA_ID: "G-TEST00000" },
    // De controle zelf draait zonder meet-ID: dan hoort er 0 keer googletagmanager in te staan.
    scriptEnv: { NEXT_PUBLIC_GA_ID: "" },
    gebruiktDist: true,
    wijzig() {},
  },
  {
    naam: "cookie-test",
    breekt: "Google Analytics laten laden vóór de bezoeker gekozen heeft",
    script: "qa/cookie-test.mjs",
    bouw: true,
    bouwEnv: { NEXT_PUBLIC_GA_ID: "G-TEST00000" },
    gebruiktGaBasis: true,
    // Deel A meet de gewone bouw zónder meet-ID; die staat hier niet. Alleen deel B draaien.
    scriptEnv: { QA_ALLEEN_B: "1" },
    wijzig({ bewaar }) {
      bewaar(BANNER);
      writeFileSync(BANNER, lees(BANNER).replace("if (keuze === \"ja\") laadGa(GA_ID);", "laadGa(GA_ID);\n    if (keuze === \"ja\") laadGa(GA_ID);"));
    },
  },
  {
    naam: "knop-test",
    breekt: "de kwaststreep van de knop weer mét verhouding laten inpassen",
    script: "qa/knop-test.mjs",
    bouw: true,
    wijzig({ bewaar }) {
      const svg = join("public", "merk", "getekend", "kwaststreep-knop.svg");
      bewaar(svg);
      writeFileSync(svg, lees(svg).replace(' preserveAspectRatio="none"', ""));
    },
  },
  {
    naam: "links",
    breekt: "een knop naar een pagina die niet bestaat",
    script: "qa/links.mjs",
    bouw: true,
    wijzig({ bewaar }) {
      bewaar(HOME);
      const p = json(HOME);
      const sectie = p.secties.find((s) => Array.isArray(s.bouwstenen));
      sectie.bouwstenen.push({ type: "knop", tekst: "Naar niets", doel: "/bestaat-niet/" });
      writeFileSync(HOME, JSON.stringify(p, null, 2));
    },
  },
];

const gevraagd = process.argv.slice(2);
const teDoen = gevraagd.length ? PROEVEN.filter((p) => gevraagd.includes(p.naam)) : PROEVEN;
const regels = [];
let mislukt = 0;

for (const proef of teDoen) {
  process.stdout.write(`▸ ${proef.naam}: ${proef.breekt}\n`);
  let r;
  if (!proef.bouw) {
    const bewaard = new Map();
    const bewaar = (pad) => {
      copyFileSync(pad, `${pad}.bewaard`);
      bewaard.set(pad, `${pad}.bewaard`);
    };
    proef.wijzig({ bewaar });
    r = spawnSync("node", [proef.script], { encoding: "utf8" });
    for (const [pad, kopie] of bewaard) {
      copyFileSync(kopie, pad);
      unlinkSync(kopie);
    }
  } else {
    const kopie = await proefBouw({ naam: `tegen-${proef.naam}`, env: proef.bouwEnv ?? {}, wijzig: proef.wijzig });
    try {
      const omgeving = { ...process.env, BASIS: kopie.basis, ...(proef.scriptEnv ?? {}) };
      if (proef.gebruiktDist) omgeving.QA_DIST = kopie.dist;
      if (proef.gebruiktGaBasis) omgeving.QA_BASIS_GA = kopie.basis;
      r = spawnSync("node", [proef.script], { encoding: "utf8", env: omgeving });
    } finally {
      kopie.stop();
    }
  }
  const uitvoer = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const melding = uitvoer.split("\n").find((l) => /FAIL|ontbreek|fout|✗|Error/i.test(l))?.trim() ?? uitvoer.split("\n")[0]?.trim() ?? "";
  const goed = (r.status ?? 1) !== 0;
  if (!goed) mislukt++;
  console.log(`${goed ? "✓" : "✗"} ${proef.naam} werd ${goed ? `rood (exit ${r.status})` : "GROEN — die controle controleert niets"}\n  ${melding.slice(0, 200)}\n`);
  regels.push(`${goed ? "✓" : "✗"} ${proef.naam}\n   stuk gemaakt: ${proef.breekt}\n   exit ${r.status}\n   melding: ${melding.slice(0, 220)}\n`);
}

const kop = [
  "Tegenproeven — elke controle is één keer expres rood gemaakt.",
  "Een controle die nooit rood kan worden, controleert niets.",
  "",
  `Gedraaid op ${new Date().toISOString().slice(0, 10)} met: node qa/tegenproef.mjs`,
  "",
].join("\n");
if (!gevraagd.length) writeFileSync("qa/tegenproeven.txt", `${kop}${regels.join("\n")}`);

console.log(mislukt ? `tegenproef: FAIL — ${mislukt} controle(s) bleven groen` : `tegenproef: PASS — alle ${teDoen.length} controles werden rood`);
if (existsSync("qa/tegenproeven.txt") && !gevraagd.length) console.log("uitslag in qa/tegenproeven.txt");
process.exit(mislukt ? 1 : 0);
