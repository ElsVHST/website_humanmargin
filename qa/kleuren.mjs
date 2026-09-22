#!/usr/bin/env node
/**
 * Alleen de vijf merkkleuren (AC-M1). Leest alle CSS die de browser krijgt (de stylesheets uit de
 * HTML én de handschrift-CSS), plus elk style-attribuut in de HTML, en telt elke kleurwaarde die
 * geen merkkleur, transparante variant, transparent of currentColor is.
 *   node qa/kleuren.mjs
 */
import { BASIS, ROUTES } from "./lib/browser.mjs";

const MERK = { "#f4f4f1": "wit", "#111010": "zwart", "#edff00": "geel", "#002cff": "blauw", "#ddddd3": "grijs" };
const TOEGESTAAN_WOORD = new Set(["transparent", "currentcolor", "inherit", "initial", "unset", "none", "revert", "revert-layer", "auto"]);
const NAMEN = /\b(red|blue|green|yellow|purple|orange|pink|gray|grey|white|black|silver|gold|navy|teal|olive|maroon|aqua|fuchsia|lime)\b/gi;

const hexNaarRgb = (h) => {
  const s = h.replace("#", "");
  const vol = s.length <= 4 ? s.split("").map((c) => c + c).join("") : s;
  return [parseInt(vol.slice(0, 2), 16), parseInt(vol.slice(2, 4), 16), parseInt(vol.slice(4, 6), 16)];
};
const merkRgb = Object.keys(MERK).map(hexNaarRgb);
const isMerkRgb = (r, g, b) => merkRgb.some((m) => m[0] === r && m[1] === g && m[2] === b);

const bronnen = new Map();
for (const route of ROUTES) {
  const html = await (await fetch(BASIS + route)).text();
  bronnen.set(`HTML ${route}`, [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).join(";"));
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    const url = m[1].startsWith("http") ? m[1] : BASIS + m[1];
    if (!bronnen.has(url)) bronnen.set(url, await (await fetch(url)).text());
  }
}
for (const extra of ["/fonts/atomic-marker/atomic-marker-regular.css", "/fonts/feisty/feisty.css"]) {
  bronnen.set(extra, await (await fetch(BASIS + extra)).text());
}

const vreemd = [];
for (const [naam, css] of bronnen) {
  const zonderCommentaar = css
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // @supports-proeven testen of de browser een kleurnotatie kent; dat is geen kleur op de site.
    .replace(/@supports[^{]*\{/g, "{")
    // Volledig doorzichtig (#0000) is dezelfde uitzondering als `transparent`.
    .replace(/#0000\b/g, " ")
    // Tailwind schrijft zijn eigen --tw-*-standaarden altijd weg, ook als geen enkele regel ze
    // gebruikt (--tw-ring-offset-color: #fff). Die waarden schilderen niets; de tweede helft van
    // dit script meet in de browser of er tóch iets mee geschilderd wordt.
    .replace(/--tw-[\w-]*\s*:\s*[^;}]+/g, " ")
    .replace(/@property\s+--tw-[\w-]*\s*\{[^}]*\}/g, " ");
  for (const m of zonderCommentaar.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const hex = m[0].toLowerCase();
    const [r, g, b] = hexNaarRgb(hex);
    if (!isMerkRgb(r, g, b)) vreemd.push(`${naam}: ${m[0]}`);
  }
  for (const m of zonderCommentaar.matchAll(/rgba?\(([^)]*)\)/gi)) {
    const args = m[1].trim();
    if (args.includes("var(")) continue; // kleur uit een variabele: die variabele wordt apart gecontroleerd
    const getallen = args.split(/[\s,/]+/).filter(Boolean).map(Number);
    if (getallen.length >= 3 && !isMerkRgb(getallen[0], getallen[1], getallen[2])) vreemd.push(`${naam}: ${m[0]}`);
  }
  for (const m of zonderCommentaar.matchAll(/(hsla?|oklch|oklab|lab|lch)\(/gi)) vreemd.push(`${naam}: ${m[1]}() — alleen hex of rgb toegestaan`);
  for (const m of zonderCommentaar.matchAll(/(?:^|[\s:;,{])(--[\w-]*(?:rgb|kleur|color)[\w-]*)\s*:\s*([^;}]+)/gi)) {
    const waarde = m[2].trim().toLowerCase();
    const getallen = waarde.split(/[\s,/]+/).filter((x) => /^\d+$/.test(x)).map(Number);
    if (getallen.length === 3 && !isMerkRgb(...getallen)) vreemd.push(`${naam}: ${m[1]}: ${waarde}`);
  }
  for (const m of zonderCommentaar.matchAll(/(?:^|[\s:;{])(color|background|background-color|border-color|fill|stroke|outline-color|text-decoration-color|caret-color)\s*:\s*([^;}]+)/gi)) {
    const waarde = m[2].trim().toLowerCase();
    if (waarde.startsWith("var(") || waarde.includes("color-mix") || waarde.includes("url(") || waarde.includes("#") || waarde.includes("rgb")) continue;
    const woord = waarde.split(/\s+/)[0];
    if (!TOEGESTAAN_WOORD.has(woord) && NAMEN.test(woord)) vreemd.push(`${naam}: ${m[1]}: ${waarde}`);
  }
}

/*
 * De tweede helft: niet wat er in de CSS staat, maar wat de browser werkelijk schildert. Elk
 * element op elke pagina, in beide schermbreedtes, met zijn doorgerekende kleuren. Zo valt een
 * kleur die via een variabele of een standaardwaarde binnenkomt alsnog op.
 */
const { startBrowser, wacht } = await import("./lib/browser.mjs");
let gemeten = 0;
for (const breedte of [1440, 390]) {
  // Eén pagina per browser: in de sandbox draait Chromium in één proces en een tweede pagina in
  // dezelfde browser klapt eruit.
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: breedte, height: 900 } });
  for (const route of ROUTES) {
    await page.goto(BASIS + route, { waitUntil: "load" });
    await wacht(700);
    const gevonden = await page.evaluate(() => {
      const velden = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "textDecorationColor", "caretColor"];
      const uit = [];
      let aantal = 0;
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        aantal++;
        // fill en stroke erven van html en staan standaard op zwart; alleen binnen een SVG
        // schilderen ze werkelijk iets.
        const hier = el.ownerSVGElement || el.tagName.toLowerCase() === "svg" ? [...velden, "fill", "stroke"] : velden;
        for (const veld of hier) {
          const w = s[veld];
          if (!w || !w.startsWith("rgb")) continue;
          const g = w.match(/[\d.]+/g)?.map(Number) ?? [];
          if (g.length < 3) continue;
          if (g.length > 3 && g[3] === 0) continue; // doorzichtig
          uit.push(`${veld}:${g[0]},${g[1]},${g[2]}|${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`);
        }
      }
      return { uit: [...new Set(uit)], aantal };
    });
    gemeten += gevonden.aantal;
    for (const regel of gevonden.uit) {
      const [kop, waar] = regel.split("|");
      const [veld, getallen] = kop.split(":");
      const [r, g, b] = getallen.split(",").map(Number);
      if (!isMerkRgb(r, g, b)) vreemd.push(`geschilderd ${route} ${breedte}px — ${veld}: rgb(${r}, ${g}, ${b}) op ${waar}`);
    }
  }
  await browser.close();
}

console.log(vreemd.length ? `kleuren: FAIL — ${vreemd.length} vreemde kleurwaarden\n  ${[...new Set(vreemd)].slice(0, 25).join("\n  ")}` : `kleuren: PASS — 0 vreemde kleurwaarden in ${bronnen.size} bestanden en op ${gemeten} geschilderde elementen`);
process.exit(vreemd.length ? 1 : 0);
