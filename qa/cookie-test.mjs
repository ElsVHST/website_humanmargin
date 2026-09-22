#!/usr/bin/env node
/**
 * De cookiebanner, in twee standen (AC-T8, AC-T7).
 * A. Zonder meet-ID (de huidige stand, V22): geen banner, geen cookie, geen "Cookie-instellingen".
 * B. Met een test-meet-ID (aparte proefbouw): de banner verschijnt, "Accepteren" en "Weigeren" zijn
 *    even groot en staan allebei meteen in beeld, vóór een keuze is document.cookie leeg, na
 *    "Weigeren" staan er 0 _ga-cookies en gaat er niets naar Google, na "Accepteren" wél (het
 *    verkeer wordt onderschept, er gaat niets echt naar Google), en "Cookie-instellingen" in de
 *    voet opent de banner opnieuw.
 *   node qa/cookie-test.mjs
 */
import { startBrowser, BASIS, wacht } from "./lib/browser.mjs";
import { proefBouw } from "./lib/tijdelijk.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

/* ── A. Zonder meet-ID ───────────────────────────────────────────────────────────────────── */
// QA_ALLEEN_B: de tegenproef draait alleen deel B, want daar staat geen gewone bouw naast.
if (!process.env.QA_ALLEEN_B) {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASIS + "/", { waitUntil: "load" });
  await wacht(1200);
  const m = await page.evaluate(() => ({
    banner: Boolean(document.querySelector(".cookiebanner")),
    cookie: document.cookie,
    instellingen: document.body.textContent.includes("Cookie-instellingen"),
  }));
  meld("AC-T8 zonder meet-ID: geen banner, geen cookie, geen cookie-instellingen", !m.banner && m.cookie === "" && !m.instellingen, `banner ${m.banner} · cookie "${m.cookie}" · instellingen ${m.instellingen}`);
  await browser.close();
}

/* ── B. Met een test-meet-ID ─────────────────────────────────────────────────────────────── */
// Met QA_BASIS_GA meet dit script een server die de tegenproef al heeft klaargezet.
const proef = process.env.QA_BASIS_GA ? { basis: process.env.QA_BASIS_GA, stop() {} } : await proefBouw({ naam: "ga", env: { NEXT_PUBLIC_GA_ID: "G-TEST00000" } });
try {
  const browser = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const naarGoogle = [];
  await page.route("**://*.googletagmanager.com/**", (route) => {
    naarGoogle.push(route.request().url());
    route.abort();
  });
  await page.route("**://*.google-analytics.com/**", (route) => {
    naarGoogle.push(route.request().url());
    route.abort();
  });

  await page.goto(proef.basis + "/", { waitUntil: "load" });
  await wacht(1200);
  const start = await page.evaluate(() => {
    const b = document.querySelector(".cookiebanner");
    const ja = document.querySelector(".cookiebanner__ja")?.getBoundingClientRect();
    const nee = document.querySelector(".cookiebanner__nee")?.getBoundingClientRect();
    const cta = document.querySelector(".opening__knoppen .knop")?.getBoundingClientRect();
    return {
      zichtbaar: Boolean(b),
      cookie: document.cookie,
      ja: ja && { w: Math.round(ja.width), h: Math.round(ja.height), y: Math.round(ja.y) },
      nee: nee && { w: Math.round(nee.width), h: Math.round(nee.height), y: Math.round(nee.y) },
      bannerTop: b ? Math.round(b.getBoundingClientRect().top) : null,
      ctaBottom: cta ? Math.round(cta.bottom) : null,
      viewport: innerHeight,
    };
  });
  const evenGroot = start.ja && start.nee && Math.abs(start.ja.w - start.nee.w) <= 2 && Math.abs(start.ja.h - start.nee.h) <= 2;
  const beideInBeeld = start.ja && start.nee && start.ja.y < start.viewport && start.nee.y < start.viewport;
  meld("AC-T8 banner verschijnt, beide knoppen even groot en in beeld", start.zichtbaar && evenGroot && beideInBeeld, `ja ${JSON.stringify(start.ja)} · nee ${JSON.stringify(start.nee)}`);
  meld("AC-T8 vóór een keuze is document.cookie leeg en gaat er niets naar Google", start.cookie === "" && naarGoogle.length === 0, `cookie "${start.cookie}" · ${naarGoogle.length} verzoeken`);
  meld("AC-T8 de banner dekt de knop van de hero niet af", start.ctaBottom !== null && start.bannerTop !== null && start.ctaBottom < start.bannerTop, `knop tot ${start.ctaBottom}px, banner vanaf ${start.bannerTop}px`);

  // Weigeren
  const nee = await page.locator(".cookiebanner__nee").boundingBox();
  await page.mouse.click(nee.x + nee.width / 2, nee.y + nee.height / 2);
  await wacht(600);
  const naWeigeren = await page.evaluate(() => ({ banner: Boolean(document.querySelector(".cookiebanner")), ga: document.cookie.split(";").filter((c) => c.trim().startsWith("_ga")).length, keuze: localStorage.getItem("hm-statistiek") }));
  meld("AC-T8 na Weigeren: banner weg, 0 _ga-cookies, niets naar Google", !naWeigeren.banner && naWeigeren.ga === 0 && naarGoogle.length === 0 && naWeigeren.keuze === "nee", `_ga ${naWeigeren.ga} · keuze ${naWeigeren.keuze} · verzoeken ${naarGoogle.length}`);

  await page.reload({ waitUntil: "load" });
  await wacht(900);
  const naHerladen = await page.evaluate(() => Boolean(document.querySelector(".cookiebanner")));
  meld("AC-T8 de keuze is onthouden na herladen", !naHerladen);

  // Cookie-instellingen in de voet opent de banner opnieuw. De knop staat duizenden pixels onder de
  // vouw, dus scrollen én klikken via de locator; een eigen scrollIntoView + muisklik op de
  // paginacoördinaten landt buiten het venster en raakt niets.
  await page.locator(".voet__knopje").click();
  await wacht(500);
  const opnieuw = await page.evaluate(() => Boolean(document.querySelector(".cookiebanner")));
  meld("AC-T8 Cookie-instellingen opent de banner opnieuw", opnieuw);

  // Accepteren
  const ja = await page.locator(".cookiebanner__ja").boundingBox();
  await page.mouse.click(ja.x + ja.width / 2, ja.y + ja.height / 2);
  await wacht(1500);
  const naJa = await page.evaluate(() => ({
    keuze: localStorage.getItem("hm-statistiek"),
    lagen: (window.dataLayer ?? []).map((a) => Array.from(a).slice(0, 2).join(" ")),
  }));
  const standaardGeweigerd = naJa.lagen.some((r) => r.startsWith("consent default"));
  const daarnaToegestaan = naJa.lagen.some((r) => r.startsWith("consent update"));
  meld("AC-T8 na Accepteren: verzoek naar Google, consent eerst denied en dan granted", naarGoogle.length > 0 && standaardGeweigerd && daarnaToegestaan && naJa.keuze === "ja", `${naarGoogle.length} verzoeken · dataLayer ${naJa.lagen.join(" | ")}`);
  await browser.close();
} finally {
  proef.stop();
}

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`cookie-test: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
