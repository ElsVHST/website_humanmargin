#!/usr/bin/env node
/**
 * De hele controlereeks in één commando: `npm run qa`.
 *
 * Volgorde: eerst de goedkope controles (content, lint, typen), dan de bouw, dan alles wat een
 * draaiende site nodig heeft, en tot slot de twee proeven die zelf een aparte bouw maken
 * (het contentcontract en de cookiebanner).
 *
 * De server draait op een poort die het besturingssysteem aanwijst — een vaste poort hergebruiken
 * meet stilletjes de vorige bouw als een oude server nog naloopt.
 *
 * Exit 0 = alles groen. Bij de eerste rode stap stopt de reeks, behalve met --alles.
 * `qa/externe-links.mjs` zit er niet in: dat script vraagt internet en draait apart.
 *
 *   npm run qa            de hele reeks
 *   npm run qa -- --alles alles draaien, ook na een rode stap
 *   npm run qa -- --snel  zonder lint, typen en bouw (vraagt een bouw die er al staat)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { vrijePoort } from "./lib/vrij.mjs";
import { wacht } from "./lib/browser.mjs";

const vlaggen = new Set(process.argv.slice(2));
const alles = vlaggen.has("--alles");
const snel = vlaggen.has("--snel");

const uitslagen = [];
const streep = "─".repeat(78);

function draai(naam, commando, argumenten, omgeving = {}) {
  console.log(`\n${streep}\n▸ ${naam}\n${streep}`);
  const begin = Date.now();
  const r = spawnSync(commando, argumenten, { stdio: "inherit", env: { ...process.env, ...omgeving } });
  const seconden = ((Date.now() - begin) / 1000).toFixed(1);
  const code = r.status ?? 1;
  uitslagen.push({ naam, code, seconden });
  console.log(`${code === 0 ? "✓" : "✗"} ${naam} — ${code === 0 ? "groen" : `exit ${code}`} (${seconden}s)`);
  return code === 0;
}

/* ── Zonder server ───────────────────────────────────────────────────────────────────────── */
const vooraf = [
  ["content — de tien contentbestanden tegen het schema", "node", ["qa/content-check.mjs"]],
  ["agents-md — AGENTS.md klopt met de werkelijkheid", "node", ["qa/agents-md.mjs"]],
  ["koppeling — de grenzen van de ChatGPT-koppeling, zonder netwerk", "node", ["qa/koppeling-unit.mjs"]],
];
if (!snel) {
  vooraf.push(["lint", "npm", ["run", "lint"]]);
  vooraf.push(["typen", "npm", ["run", "typecheck"]]);
  vooraf.push(["bouw", "npm", ["run", "build"]]);
}

let goed = true;
for (const [naam, cmd, args] of vooraf) {
  goed = draai(naam, cmd, args) && goed;
  if (!goed && !alles) break;
}

if (!existsSync(".next/BUILD_ID") && (goed || alles)) {
  console.log("\n✗ er staat geen bouw in .next — draai `npm run build`");
  goed = false;
}

/* ── Met een draaiende productiebouw ─────────────────────────────────────────────────────── */
if (goed || alles) {
  goed = draai("bundel — 0 regels Google Analytics zonder meet-ID", "node", ["qa/check-bundel.mjs"]) && goed;
}

let server;
if (goed || alles) {
  const poort = await vrijePoort();
  const basis = `http://localhost:${poort}`;
  console.log(`\nserver op ${basis}`);
  server = spawn("npx", ["next", "start", "-p", String(poort)], { stdio: "ignore" });
  let op = false;
  for (let i = 0; i < 60 && !op; i++) {
    await wacht(250);
    try {
      op = (await fetch(basis + "/", { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      /* nog niet op */
    }
  }
  if (!op) {
    console.log("✗ de server kwam niet op");
    uitslagen.push({ naam: "server", code: 1, seconden: "—" });
    goed = false;
  } else {
    const metServer = [
      ["site — titels, beschrijvingen, JSON-LD, sitemap, robots", "qa/check-site.mjs"],
      ["herkomst — elke zin komt uit Els' tekst of uit copy-nieuw.md", "qa/herkomst.mjs"],
      ["kleuren — alleen de vijf merkkleuren", "qa/kleuren.mjs"],
      ["licentie — het licentieblok van de fonts staat er nog", "qa/licentie.mjs"],
      ["links — elke interne link geeft 200", "qa/links.mjs"],
      ["menu — kop, mobiel menu en focus", "qa/menu-test.mjs"],
      ["beweging — de acht eigen onderdelen doen wat ze beloven", "qa/features-test.mjs"],
      ["gewicht — paginagewicht, hero en de letters van de kantlijn", "qa/gewicht-test.mjs"],
      ["contrast — axe-core plus eigen meting op tekst over beeld", "qa/contrast-axe.mjs"],
      ["knoppen — elke knoptekst ligt volledig op de kwaststreep", "qa/knop-test.mjs"],
      ["kinetic — de breedte-as van de slotzin werkt echt", "qa/kinetic-test.mjs"],
      ["beta — de bevindingen van de beta-tester blijven gerepareerd", "qa/beta-reparaties.mjs"],
      ["doorloop — als bezoeker scrollen, overlap en lege schermen", "qa/doorloop.mjs"],
    ];
    for (const [naam, script] of metServer) {
      goed = draai(naam, "node", [script], { BASIS: basis }) && goed;
      if (!goed && !alles) break;
    }
    if (goed || alles) {
      goed = draai("contract — een nieuw contentbestand geeft een nieuwe pagina", "node", ["qa/contract-test.mjs"], { BASIS: basis }) && goed;
    }
    if (goed || alles) {
      goed = draai("cookies — de banner in beide standen", "node", ["qa/cookie-test.mjs"], { BASIS: basis }) && goed;
    }
  }
}

server?.kill("SIGTERM");
await wacht(300);

/* ── Uitslag ─────────────────────────────────────────────────────────────────────────────── */
console.log(`\n${streep}\nUITSLAG\n${streep}`);
for (const u of uitslagen) console.log(`${u.code === 0 ? "✓" : "✗"} ${u.naam.padEnd(62, " ")} ${String(u.seconden).padStart(6, " ")}s`);
const rood = uitslagen.filter((u) => u.code !== 0).length;
console.log(`\n${rood ? `${rood} van de ${uitslagen.length} stappen is rood` : `alle ${uitslagen.length} stappen groen`}`);
process.exit(rood ? 1 : 0);
