#!/usr/bin/env node
/**
 * Toegankelijkheid en contrast (AC-M3, AC-A1, AC-A2).
 * - axe-core op elke pagina: 0 overtredingen van niveau serious of critical, ook met de keuzehulp open.
 * - Eigen contrastmeting: elke tekstknoop tegen zijn werkelijke achtergrond. Tekst op een foto
 *   (de handgeschreven notities) meten we door de foto eronder uit een schermafbeelding te lezen —
 *   niet door de sectiekleur aan te nemen.
 * - Geel op licht en blauw op zwart mogen nooit tekst zijn (1,01 : 1 en 2,54 : 1).
 *   node qa/contrast-axe.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { startBrowser, BASIS, ROUTES, wacht } from "./lib/browser.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const axeBron = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

const lum = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const verhouding = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

for (const route of ROUTES) {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(BASIS + route, { waitUntil: "load" });

  /*
   * Eerst de verse stand, vóór er gescrold is. Dat is wat een bezoeker als eerste ziet, en het is
   * de stand waarin de woorden van het verhaal nog niet zijn opgelicht. Scrol je eerst de pagina
   * door, dan blijven die woorden opgelicht staan en meet je die dimstand nooit — Lighthouse vond
   * daar 1,53 : 1 terwijl deze controle groen stond.
   */
  await wacht(600);
  await page.addScriptTag({ content: axeBron });
  const axeVers = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}×): ${v.nodes[0]?.target?.join(" ")}`);
  });
  meld(`AC-A1 axe-core ${route} — verse stand, vóór scrollen`, axeVers.length === 0, axeVers.slice(0, 3).join(" | ") || "0 serious/critical");

  // Even door de pagina scrollen zodat notities en markeringen in hun eindstand staan.
  const hoogte = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hoogte; y += 700) {
    await page.mouse.wheel(0, 700);
    await wacht(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await wacht(900);

  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}×): ${v.nodes[0]?.target?.join(" ")}`);
  });
  meld(`AC-A1 axe-core ${route} — na scrollen`, axe.length === 0, axe.slice(0, 3).join(" | ") || "0 serious/critical");

  // Eigen contrastmeting.
  const tekstKnopen = await page.evaluate(() => {
    const uit = [];
    let teller = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest("script,style,noscript,.sr-only,dialog:not([open])")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.15) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // Achtergrond: de eerste voorouder met een ondoorzichtige achtergrondkleur. Zit er onderweg
      // een afbeelding (een foto of de gele kwaststreek), dan zegt die kleur niets: dan meten we
      // de pixels onder de tekst uit een schermafbeelding.
      let achtergrond = null;
      let opFoto = false;
      for (let p = el; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.backgroundImage !== "none" && ps.backgroundImage.includes("url(")) opFoto = true;
        if (p.closest(".foto, .opening__foto")) opFoto = true;
        const bg = ps.backgroundColor;
        const m = bg.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const d = m[1].split(",").map(Number);
          if ((d[3] ?? 1) > 0.9) {
            achtergrond = [d[0], d[1], d[2]];
            break;
          }
        }
      }
      const kleurMatch = cs.color.match(/rgba?\(([^)]+)\)/);
      if (!kleurMatch) continue;
      const kleur = kleurMatch[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      const groot = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      // Merk het element, zodat de meting later zijn echte plek op het scherm kan opzoeken.
      const id = String(teller++);
      el.setAttribute("data-meet-id", id);
      uit.push({
        id,
        tekst: n.textContent.trim().slice(0, 30),
        kleur: kleur.slice(0, 3),
        achtergrond,
        opFoto,
        groot,
        rect: { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height },
        selector: el.className?.toString().slice(0, 40) || el.tagName,
      });
    }
    return uit;
  });

  const fouten = [];
  for (const k of tekstKnopen) {
    let achtergrond = k.achtergrond;
    if (k.opFoto) {
      // Wat zit er écht onder de letters? De inkt even doorzichtig maken en de pixels lezen —
      // alleen de band waar de letters staan, want een kwaststreek is dunner dan zijn knop.
      await page.addStyleTag({ content: "[data-meet-doorzichtig]{color:transparent!important;text-decoration-color:transparent!important}" });
      const doos = await page.evaluate((id) => {
        const el = document.querySelector(`[data-meet-id="${id}"]`);
        if (!el) return null;
        el.scrollIntoView({ block: "center", behavior: "instant" });
        el.setAttribute("data-meet-doorzichtig", "");
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, Math.round(r.x + r.width * 0.05)),
          y: Math.max(0, Math.round(r.y + r.height * 0.3)),
          width: Math.max(4, Math.round(r.width * 0.9)),
          height: Math.max(4, Math.round(r.height * 0.4)),
        };
      }, k.id);
      await wacht(160);
      if (doos) {
        const beeld = await page.screenshot({ clip: doos });
        const stats = await sharp(beeld).stats();
        achtergrond = [Math.round(stats.channels[0].mean), Math.round(stats.channels[1].mean), Math.round(stats.channels[2].mean)];
      }
      await page.evaluate(() => {
        document.querySelectorAll("[data-meet-doorzichtig]").forEach((e) => e.removeAttribute("data-meet-doorzichtig"));
        document.querySelectorAll("style").forEach((s) => s.textContent.includes("data-meet-doorzichtig") && s.remove());
      });
    }
    if (!achtergrond) {
      fouten.push(`${k.tekst}: geen achtergrond gevonden`);
      continue;
    }
    const v = verhouding(k.kleur, achtergrond);
    const eis = k.groot ? 3 : 4.5;
    if (v < eis) fouten.push(`"${k.tekst}" (${k.selector}) ${v.toFixed(2)} : 1 < ${eis} — kleur rgb(${k.kleur}) op rgb(${achtergrond})`);
  }
  meld(`AC-M3 contrast ${route}`, fouten.length === 0, `${tekstKnopen.length} tekstknopen${fouten.length ? ` · ${fouten.slice(0, 3).join(" | ")}` : ""}`);

  if (route === "/") {
    // Met de keuzehulp open (AC-A1) en de focusring (AC-A2).
    await page.evaluate(() => document.querySelector("[data-keuzehulp]")?.click());
    await wacht(500);
    const axeDialoog = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ["violations"] });
      return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id);
    });
    meld("AC-A1 axe-core met de keuzehulp open", axeDialoog.length === 0, axeDialoog.join(", ") || "0 serious/critical");
    await page.keyboard.press("Escape");
    await wacht(200);
    const focus = await page.evaluate(() => {
      document.querySelector(".skiplink")?.focus();
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { eerste: el?.className, outline: cs.outlineWidth, kleur: cs.outlineColor };
    });
    meld("AC-A2 skiplink is de eerste focus, met zichtbare ring", focus.eerste?.includes("skiplink") && parseFloat(focus.outline) >= 2, `${focus.eerste} · ring ${focus.outline} ${focus.kleur}`);
  }
  await browser.close();
}

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`contrast-axe: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
