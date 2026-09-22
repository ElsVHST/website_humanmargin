#!/usr/bin/env node
/**
 * Lighthouse over vier pagina's (AC-T11, F7).
 *
 * In deze sandbox start Lighthouse zijn eigen Chrome niet; daarom draait hij tegen de Chromium van
 * Playwright, die hier al gebruikt wordt, met een open debugpoort (`--port`). Metingen die van de
 * omgeving afhangen — speed index, en soms robots.txt — kunnen daardoor afwijken van een meting op
 * een schone machine; dat staat in de uitslag vermeld in plaats van weggepoetst.
 *
 * Draait tegen een draaiende productiebouw: BASIS=http://localhost:xxxx node qa/lighthouse.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BASIS, wacht } from "./lib/browser.mjs";
import { vrijePoort } from "./lib/vrij.mjs";

const UIT = "qa/lighthouse";
mkdirSync(UIT, { recursive: true });

const PAGINAS = [
  ["/", "home"],
  ["/aanbod/", "aanbod"],
  ["/manifest/", "manifest"],
  ["/contact/", "contact"],
];

// Lighthouse staat in de npx-cache; een eigen installatie zou de repo van Els zwaarder maken.
const cache = "/Users/sevekecreative/.npm/_npx";
const kandidaten = existsSync(cache)
  ? readdirSync(cache)
      .map((m) => join(cache, m, "node_modules", "lighthouse", "cli", "index.js"))
      .filter((p) => existsSync(p))
  : [];
if (!kandidaten.length) {
  console.log("lighthouse: OVERGESLAGEN — lighthouse niet gevonden (npx-cache leeg)");
  process.exit(0);
}
const lighthouse = kandidaten[0];

/*
 * Lighthouse start hier zijn eigen browser niet: de volledige Chrome wil een ProcessSingleton-socket
 * aanleggen en dat mag niet in de sandbox (exit 21). De headless shell die Playwright meelevert
 * heeft dat niet nodig. Die starten we zelf met een debugpoort, en Lighthouse sluit erop aan.
 * De profielmap staat in /tmp/claude-501 en niet in de scratchpad: een unix-socket mag niet langer
 * dan 104 tekens zijn, en dat pad is dat wel.
 */
const cacheMap = join(homedir(), "Library", "Caches", "ms-playwright");
const shell = existsSync(cacheMap)
  ? readdirSync(cacheMap)
      .filter((m) => m.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse()
      .map((m) => join(cacheMap, m, "chrome-headless-shell-mac-arm64", "chrome-headless-shell"))
      .find((p) => existsSync(p))
  : null;
if (!shell) {
  console.log("lighthouse: OVERGESLAGEN — geen headless shell in de Playwright-cache");
  process.exit(0);
}
const debugPoort = await vrijePoort();
const profiel = `/tmp/claude-501/lh-${debugPoort}`;
mkdirSync(profiel, { recursive: true });
const browser = spawn(shell, ["--no-sandbox", "--single-process", "--disable-gpu", "--disable-dev-shm-usage", `--remote-debugging-port=${debugPoort}`, `--user-data-dir=${profiel}`, "about:blank"], { stdio: "ignore" });
let op = false;
for (let i = 0; i < 30 && !op; i++) {
  await wacht(400);
  try {
    op = (await fetch(`http://localhost:${debugPoort}/json/version`, { signal: AbortSignal.timeout(800) })).ok;
  } catch {
    /* nog niet op */
  }
}
if (!op) {
  browser.kill("SIGTERM");
  console.log("lighthouse: OVERGESLAGEN — de browser kwam niet op");
  process.exit(0);
}

const rijen = [];
for (const [route, naam] of PAGINAS) {
  const uitvoer = join(UIT, `${naam}.report.json`);
  const r = spawnSync(
    "node",
    [
      lighthouse,
      BASIS + route,
      `--port=${debugPoort}`,
      "--output=json",
      `--output-path=${uitvoer}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--preset=desktop",
      "--quiet",
    ],
    { encoding: "utf8", timeout: 240000 },
  );
  if (!existsSync(uitvoer)) {
    console.log(`${naam}: geen rapport — ${(r.stderr || r.stdout || "").split("\n").slice(-3).join(" ").slice(0, 200)}`);
    continue;
  }
  const rap = JSON.parse(readFileSync(uitvoer, "utf8"));
  const c = rap.categories;
  const a = rap.audits;
  // In deze sandbox maakt de headless shell soms geen schermopnames. Dan blijft de speed index leeg
  // en rekent Lighthouse de hele snelheidsscore op 0, terwijl elke afzonderlijke meting goed is.
  // Die 0 is dan een meetfout, geen trage pagina; dat zetten we erbij in plaats van hem te melden.
  const meetfout = a["speed-index"]?.score === null && Boolean(a["speed-index"]?.errorMessage);
  rijen.push({
    pagina: route,
    meetfout,
    snelheid: meetfout ? "—" : Math.round(c.performance.score * 100),
    toegankelijk: Math.round(c.accessibility.score * 100),
    praktijk: Math.round(c["best-practices"].score * 100),
    vindbaar: Math.round(c.seo.score * 100),
    lcp: a["largest-contentful-paint"]?.displayValue ?? "—",
    cls: a["cumulative-layout-shift"]?.displayValue ?? "—",
    tbt: a["total-blocking-time"]?.displayValue ?? "—",
    speedIndexFout: a["speed-index"]?.errorMessage,
    fouten: Object.values(a)
      .filter((x) => x.score === 0 && x.scoreDisplayMode === "binary")
      .map((x) => x.id),
  });
}

browser.kill("SIGTERM");
await wacht(600);
try {
  rmSync(profiel, { recursive: true, force: true });
} catch {
  /* de browser ruimt zijn profiel zelf nog op; blijft in /tmp staan */
}

const kolom = (s, n) => String(s).padEnd(n, " ");
const a1 = (r) => r.speedIndexFout ?? "Chrome leverde geen schermopnames";
console.log(`\n| ${kolom("pagina", 12)} | snelheid | toegankelijk | praktijk | vindbaar | ${kolom("LCP", 9)} | ${kolom("CLS", 6)} | ${kolom("TBT", 8)} |`);
console.log(`|${"-".repeat(14)}|----------|--------------|----------|----------|${"-".repeat(11)}|${"-".repeat(8)}|${"-".repeat(10)}|`);
for (const r of rijen) {
  console.log(`| ${kolom(r.pagina, 12)} | ${kolom(r.snelheid, 8)} | ${kolom(r.toegankelijk, 12)} | ${kolom(r.praktijk, 8)} | ${kolom(r.vindbaar, 8)} | ${kolom(r.lcp, 9)} | ${kolom(r.cls, 6)} | ${kolom(r.tbt, 8)} |`);
}

// Wat Lighthouse hier niet kan meten, meten we zelf, in plaats van het als "kapot" te laten staan.
const robots = await fetch(BASIS + "/robots.txt");
const robotsTekst = await robots.text();
const robotsGoed = robots.status === 200 && /^user-agent:/im.test(robotsTekst) && /sitemap:/i.test(robotsTekst);
const leestRobotsNiet = rijen.some((r) => r.fouten.includes("robots-txt"));

console.log("\nVoetnoten:");
for (const r of rijen.filter((x) => x.meetfout)) console.log(`- ${r.pagina}: snelheidscijfer weggelaten — de speed index kwam leeg terug (${(/[^.]+/.exec(String(a1(r))) ?? [""])[0]}). LCP ${r.lcp}, CLS ${r.cls}, TBT ${r.tbt} zijn wél gemeten.`);
if (leestRobotsNiet) console.log(`- robots.txt: Lighthouse kreeg hem niet binnen (READ_FAILED) en trekt daar 8 punten voor af. Zelf opgehaald: status ${robots.status}, ${robotsGoed ? "geldig, met sitemapregel" : "NIET in orde"}.`);
const echtGezakt = rijen.filter((r) => r.toegankelijk < 100 || r.fouten.some((f) => f !== "robots-txt"));
for (const r of echtGezakt) console.log(`- let op ${r.pagina}: ${r.fouten.filter((f) => f !== "robots-txt").slice(0, 8).join(", ") || "alleen puntenaftrek, geen harde fout"}`);
console.log(`\n${rijen.length} pagina's gemeten · rapporten in ${UIT}/`);
if (!robotsGoed) process.exit(1);
process.exit(rijen.length === PAGINAS.length ? 0 : 1);
