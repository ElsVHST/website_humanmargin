#!/usr/bin/env node
/**
 * Menu, keuzehulp en banner als dialoog (AC-A6): opent op ≥ 90 % van de schermhoogte, Escape sluit,
 * de focus blijft binnen, en de rest van de pagina is inert. Klikken met echte muiscoördinaten
 * (page.mouse.click), want element.click() ziet niet wat een muis ziet.
 *   node qa/menu-test.mjs
 */
import { startBrowser, BASIS, wacht } from "./lib/browser.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

/* ── Het mobiele menu ────────────────────────────────────────────────────────────────────── */
{
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASIS + "/", { waitUntil: "load" });
  await wacht(1000);
  const knop = await page.locator(".kop__menuknop").first().boundingBox();
  await page.mouse.click(knop.x + knop.width / 2, knop.y + knop.height / 2);
  await wacht(500);
  const open = await page.evaluate(() => {
    const d = document.querySelector("dialog.menu");
    const r = d?.getBoundingClientRect();
    return { open: d?.open === true, hoogte: r?.height ?? 0, viewport: innerHeight, links: d?.querySelectorAll("a").length ?? 0 };
  });
  meld("AC-A6 menu opent op ≥ 90 % van de schermhoogte", open.open && open.hoogte >= open.viewport * 0.9, `${Math.round(open.hoogte)} van ${open.viewport} px · ${open.links} links`);

  // Inert: een link buiten de dialoog kan geen focus krijgen zolang de dialoog open staat.
  const buiten = await page.evaluate(() => {
    const link = document.querySelector("main a");
    link?.focus();
    return document.activeElement === link;
  });
  meld("AC-A6 de pagina achter het menu is inert", !buiten);

  // Focus blijft binnen: tien keer Tab en nog steeds binnen de dialoog.
  await page.keyboard.press("Tab");
  const binnen = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    // Bij het rondlopen staat de focus één tik op het document zelf; dat telt niet als "buiten".
    binnen.push(await page.evaluate(() => {
      const el = document.activeElement;
      return !el || el === document.body || Boolean(el.closest("dialog.menu"));
    }));
  }
  meld("AC-A6 de focus blijft in het menu", binnen.every(Boolean), `${binnen.filter(Boolean).length}/10 tabstops binnen de dialoog`);

  await page.keyboard.press("Escape");
  await wacht(400);
  const dicht = await page.evaluate(() => ({ open: document.querySelector("dialog.menu")?.open === true, focus: document.activeElement?.className }));
  meld("AC-A6 Escape sluit het menu en de focus keert terug", !dicht.open && String(dicht.focus).includes("menuknop"), `focus terug op ${dicht.focus}`);
  await browser.close();
}

/* ── De keuzehulp, met de muis bediend ───────────────────────────────────────────────────── */
for (const [breedte, hoogte] of [[1440, 900], [390, 844]]) {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: breedte, height: hoogte } });
  await page.goto(BASIS + "/contact/", { waitUntil: "load" });
  await wacht(900);
  const knop = await page.locator("[data-keuzehulp]").first().boundingBox();
  await page.mouse.click(knop.x + knop.width / 2, knop.y + knop.height / 2);
  await wacht(500);
  const open = await page.evaluate(() => document.querySelector("dialog.keuzehulp")?.open === true);
  const buiten = await page.evaluate(() => {
    const link = document.querySelector("main a");
    link?.focus();
    return document.activeElement === link;
  });
  // Klik náást de dialoog: dat sluit hem (klik op de backdrop), en raakt niets eronder.
  await page.mouse.click(6, hoogte - 6);
  await wacht(400);
  const dicht = await page.evaluate(() => document.querySelector("dialog.keuzehulp")?.open === true);
  meld(`AC-A6 keuzehulp op ${breedte}px: opent, achtergrond inert, klik ernaast sluit`, open && !buiten && !dicht, `open ${open} · inert ${!buiten} · gesloten ${!dicht}`);
  await browser.close();
}

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`menu-test: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
