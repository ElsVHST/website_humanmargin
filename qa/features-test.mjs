#!/usr/bin/env node
/**
 * De beweging op de site, gemeten terwijl hij beweegt (AC-B1 t/m B7, AC-B9, AC-M5, AC-P6, AC-T10).
 *   node qa/features-test.mjs
 * Eén browser per meting (in de sandbox draait Chromium met --single-process; meerdere pagina's
 * in één browser lopen dan vast).
 */
import { startBrowser, BASIS, ROUTES, wacht } from "./lib/browser.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push({ naam, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

async function metPagina(opties, route, fn) {
  const browser = await startBrowser();
  const page = await browser.newPage(opties);
  await page.goto(BASIS + route, { waitUntil: "load" });
  await wacht(1200);
  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/* ── AC-B1 + AC-M5: de kop wisselt van volledig logo naar merkteken ──────────────────────── */
await metPagina({ viewport: { width: 1440, height: 900 } }, "/", async (page) => {
  const lees = () =>
    page.evaluate(() => {
      const vol = document.querySelector(".kop__volledig");
      const merk = document.querySelector(".kop__merkteken");
      return { vol: Number(getComputedStyle(vol).opacity), merk: Number(getComputedStyle(merk).opacity), y: scrollY };
    });
  const boven = await lees();
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 120);
    await wacht(30);
  }
  await wacht(900);
  const na = await lees();
  meld("AC-B1/M5 kop wisselt na de hero", boven.vol === 1 && boven.merk === 0 && na.vol === 0 && na.merk === 1, `boven: logo ${boven.vol}/merkteken ${boven.merk} · na ${na.y}px: ${na.vol}/${na.merk}`);
});

/* ── AC-B2: de kop rijst letter voor letter op, binnen 1,5 s ─────────────────────────────── */
for (const route of ["/", "/manifest/"]) {
  await metPagina({ viewport: { width: 1440, height: 900 } }, route, async (page) => {
    await page.reload({ waitUntil: "load" });
    await wacht(1500);
    const staat = await page.evaluate(() => {
      const letters = [...document.querySelectorAll("[data-hero-ch]")];
      return {
        aantal: letters.length,
        onzichtbaar: letters.filter((l) => Number(getComputedStyle(l).opacity) < 1).length,
        verschoven: letters.filter((l) => !["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(l).transform)).length,
        label: document.querySelector("[data-hero-heading]")?.getAttribute("aria-label"),
      };
    });
    meld(`AC-B2 hero-kop stil na 1,5 s (${route})`, staat.aantal > 0 && staat.onzichtbaar === 0 && staat.verschoven === 0, `${staat.aantal} letters · onzichtbaar ${staat.onzichtbaar} · verschoven ${staat.verschoven} · aria-label "${staat.label}"`);
  });
}

/* ── AC-B3: de manifest-alinea licht woord voor woord op, en gaat nooit terug ────────────── */
await metPagina({ viewport: { width: 1440, height: 900 } }, "/manifest/", async (page) => {
  const blok = await page.evaluate(() => {
    const el = document.querySelector("[data-story-block]");
    return { top: el.getBoundingClientRect().top + scrollY, hoogte: el.offsetHeight };
  });
  const metingen = [];
  const stappen = 10;
  for (let i = 0; i <= stappen; i++) {
    const doel = Math.round(blok.top + ((blok.hoogte - 900) * i) / stappen);
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, doel));
    await wacht(320);
    metingen.push(await page.evaluate(() => {
      const woorden = [...document.querySelectorAll("[data-story-word]")];
      return { totaal: woorden.length, verlicht: woorden.filter((w) => w.classList.contains("is-lit")).length };
    }));
  }
  const totaal = metingen[0].totaal;
  const reeks = metingen.map((m) => m.verlicht);
  const stijgend = reeks.every((v, i) => i === 0 || v >= reeks[i - 1]);
  meld("AC-B3 storyline licht op (44 woorden)", totaal === 44 && reeks[0] === 0 && reeks.at(-1) === totaal && stijgend, `${totaal} woorden · reeks ${reeks.join("→")}`);
});

/* ── AC-B4: "Hoe ik werk" blijft staan en schuift zijwaarts (desktop), veegt (mobiel) ────── */
await metPagina({ viewport: { width: 1440, height: 900 } }, "/", async (page) => {
  const pin = await page.evaluate(() => {
    const el = document.querySelector("[data-scroll-pin]");
    return { gepind: el.hasAttribute("data-scroll-pin-pinned"), top: el.getBoundingClientRect().top + scrollY, hoogte: el.offsetHeight };
  });
  const indexen = [];
  const stickyPosities = [];
  for (let i = 0; i <= 6; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(pin.top + ((pin.hoogte - 900) * i) / 6));
    await wacht(400);
    indexen.push(await page.evaluate(() => [...document.querySelectorAll("[data-scroll-pin-word]")].findIndex((w) => w.classList.contains("is-active"))));
    stickyPosities.push(await page.evaluate(() => Math.round(document.querySelector("[data-scroll-pin-sticky]").getBoundingClientRect().top)));
  }
  // Tijdens het pinnen staat de sticky-wrapper op 0; de eerste en laatste stop vallen er net buiten.
  const gepindeStops = stickyPosities.filter((t) => Math.abs(t) < 5).length;
  const blijftStaan = gepindeStops >= 4;
  meld("AC-B4 pin blijft staan, index loopt 0→2", pin.gepind && indexen[0] === 0 && indexen.at(-1) === 2 && blijftStaan, `gepind ${pin.gepind} · index ${indexen.join("→")} · ${gepindeStops}/7 stops vastgezet (top ${stickyPosities.join(",")})`);
});
await metPagina({ viewport: { width: 390, height: 844 } }, "/", async (page) => {
  const m = await page.evaluate(() => {
    const el = document.querySelector("[data-scroll-pin]");
    const track = document.querySelector("[data-scroll-pin-track]");
    return {
      gepind: el.hasAttribute("data-scroll-pin-pinned"),
      docGelijk: document.documentElement.scrollWidth === document.documentElement.clientWidth,
      trackScrollt: track.scrollWidth > track.clientWidth,
    };
  });
  meld("AC-B4 mobiel: veegcarrousel, pagina scrolt niet zijwaarts", !m.gepind && m.docGelijk && m.trackScrollt, `gepind ${m.gepind} · document gelijk ${m.docGelijk} · track scrollt ${m.trackScrollt}`);
});

/* ── AC-B5: zonder JavaScript staat alles er gewoon ──────────────────────────────────────── */
{
  const browser = await startBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let stil = 0;
  for (const route of ROUTES) {
    await page.goto(BASIS + route, { waitUntil: "load" });
    // De infade is pure CSS en duurt tot ±1,6 s; daarna hoort alles op dekking 1 te staan.
    await wacht(2200);
    stil += await page.evaluate(() => {
      const zichtbaar = [...document.querySelectorAll("main *")].filter((el) => {
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().height > 0;
      });
      const dof = zichtbaar.filter((el) => Number(getComputedStyle(el).opacity) < 1);
      if (dof.length) console.log("dof:", dof.map((el) => el.className || el.tagName).join(" | "));
      return dof.length;
    });
  }
  await browser.close();
  meld("AC-B5 zonder JS: 0 elementen met opacity < 1", stil === 0, `${stil} elementen`);
}

/* ── AC-B6 + AC-B7: de kantlijn en de markeerstift ───────────────────────────────────────── */
const NOTITIES = ["Wat wil je?", "HOE DAN??", "Lees!", "MEER WETEN", "Rebel by nature, not by nurture.", "Blijf vragen.", "Nieuwsgierigheid is verzet."];
for (const [breedte, hoogte] of [[1440, 900], [390, 844]]) {
  let fouten = [];
  let notities = 0;
  let markeringen = 0;
  for (const route of ROUTES) {
    await metPagina({ viewport: { width: breedte, height: hoogte } }, route, async (page) => {
      // Scroll de hele pagina door, zodat notities en markeringen hun moment krijgen.
      const hoog = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < hoog; y += hoogte * 0.6) {
        await page.mouse.wheel(0, hoogte * 0.6);
        await wacht(90);
      }
      await wacht(900);
      const m = await page.evaluate(
        ({ toegestaan, breed }) => {
          const uit = { notities: [], markeringen: 0, fouten: [] };
          const perSectie = {};
          for (const n of document.querySelectorAll("[data-notitie]")) {
            const tekst = n.textContent.trim();
            const sectie = n.closest("section")?.id ?? "?";
            perSectie[sectie] = (perSectie[sectie] ?? 0) + 1;
            if (perSectie[sectie] > 1) uit.fouten.push(`meer dan één notitie in ${sectie}`);
            if (!toegestaan.includes(tekst)) uit.fouten.push(`notitie "${tekst}" staat niet in de lijst`);
            const zichtbaar = Number(getComputedStyle(n).opacity) > 0.9;
            if (!zichtbaar) uit.fouten.push(`notitie "${tekst}" is niet verschenen`);
            uit.notities.push(tekst);
            // Overlap met tekstregels: per regel een Range-rechthoek, niet de doos van het blok.
            if (breed && !n.closest(".opening__notitie")) {
              const nr = n.getBoundingClientRect();
              for (const el of document.querySelectorAll("main p, main li, main h1, main h2, main h3, main summary")) {
                if (el.contains(n)) continue;
                const r = document.createRange();
                r.selectNodeContents(el);
                for (const q of r.getClientRects()) {
                  const x = Math.min(nr.right, q.right) - Math.max(nr.left, q.left);
                  const y = Math.min(nr.bottom, q.bottom) - Math.max(nr.top, q.top);
                  if (x > 2 && y > 2) uit.fouten.push(`notitie "${tekst}" overlapt "${el.textContent.trim().slice(0, 30)}"`);
                }
              }
            }
          }
          const perSectieM = {};
          for (const mk of document.querySelectorAll("[data-markeer]")) {
            const sectie = mk.closest("section")?.id ?? "?";
            perSectieM[sectie] = (perSectieM[sectie] ?? 0) + 1;
            if (perSectieM[sectie] > 2) uit.fouten.push(`meer dan twee markeringen in ${sectie}`);
            uit.markeringen++;
            const bg = getComputedStyle(mk).backgroundSize;
            if (!/100%/.test(bg)) uit.fouten.push(`markering "${mk.textContent.trim().slice(0, 25)}" is niet ingetekend (${bg})`);
          }
          return uit;
        },
        { toegestaan: NOTITIES, breed: breedte >= 1024 },
      );
      notities += m.notities.length;
      markeringen += m.markeringen;
      fouten = fouten.concat(m.fouten.map((f) => `${route}: ${f}`));
    });
  }
  meld(`AC-B6/B7 kantlijn op ${breedte}px`, fouten.length === 0, `${notities} notities · ${markeringen} markeringen${fouten.length ? ` · ${fouten.slice(0, 4).join(" | ")}` : ""}`);
}

/* ── AC-B9: met "minder beweging" geen transform-animaties ───────────────────────────────── */
{
  const browser = await startBrowser();
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const fouten = [];
  for (const route of ROUTES) {
    await page.goto(BASIS + route, { waitUntil: "load" });
    await wacht(900);
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 400);
      await wacht(120);
    }
    const m = await page.evaluate(() => {
      const uit = { transform: 0, traagOpacity: 0 };
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        const namen = cs.transitionProperty.split(",").map((s) => s.trim());
        const duren = cs.transitionDuration.split(",").map((s) => parseFloat(s) * (s.includes("ms") ? 1 : 1000));
        namen.forEach((naam, i) => {
          const duur = duren[i] ?? duren[0] ?? 0;
          if (duur > 1 && /transform|translate|scale|rotate|all/.test(naam)) uit.transform++;
          if (duur > 200 && /opacity/.test(naam)) uit.traagOpacity++;
        });
        if (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.05) uit.transform++;
      }
      return uit;
    });
    if (m.transform) fouten.push(`${route}: ${m.transform} transform-animaties`);
    if (m.traagOpacity) fouten.push(`${route}: ${m.traagOpacity} opacity-overgangen > 200 ms`);
  }
  await browser.close();
  meld("AC-B9 minder beweging: 0 transform-animaties", fouten.length === 0, fouten.slice(0, 3).join(" | ") || "0 op 6 pagina's");
}

/* ── AC-P6: de keuzehulp, zonder formulier en zonder verkeer ─────────────────────────────── */
await metPagina({ viewport: { width: 1440, height: 900 } }, "/", async (page) => {
  const posts = [];
  page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
  await page.locator("[data-keuzehulp]").first().scrollIntoViewIfNeeded();
  const doos = await page.locator("[data-keuzehulp]").first().boundingBox();
  await page.mouse.click(doos.x + doos.width / 2, doos.y + doos.height / 2);
  await wacht(500);
  const stap1 = await page.evaluate(() => {
    const d = document.querySelector("dialog.keuzehulp");
    return { open: d?.open === true, opties: [...d.querySelectorAll(".keuzehulp__optie")].map((b) => b.textContent.trim()) };
  });
  await page.locator('.keuzehulp__optie[data-onderwerp="regietraject"]').click();
  await wacht(400);
  const stap2 = await page.evaluate(() => {
    const links = [...document.querySelectorAll(".keuzehulp__weg")].map((a) => a.getAttribute("href"));
    return { links, titel: document.querySelector("#keuzehulp-titel")?.textContent.trim() };
  });
  const mail = stap2.links.find((h) => h.startsWith("mailto:"));
  const goed = stap1.open && stap1.opties.length === 5 && stap2.links.length === 3 && mail?.includes("subject=Vraag%20over%20het%20regietraject") && posts.length === 0;
  meld("AC-P6 keuzehulp: 2 stappen, mailto met onderwerp, 0 POST", goed, `opties ${stap1.opties.length} · wegen ${stap2.links.length} · ${mail} · POSTs ${posts.length}`);
  await page.keyboard.press("Escape");
  await wacht(300);
  const dicht = await page.evaluate(() => document.querySelector("dialog.keuzehulp").open === false);
  meld("AC-P6 Escape sluit de keuzehulp", dicht);
});
{
  // Zonder JavaScript leidt dezelfde knop gewoon naar /contact/.
  const browser = await startBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASIS + "/", { waitUntil: "load" });
  const href = await page.locator("[data-keuzehulp]").first().getAttribute("href");
  await browser.close();
  meld("AC-P6 zonder JS: de knop gaat naar /contact/", href === "/contact/", `href ${href}`);
}

/* ── AC-T10: geen zijwaartse schuifbalk op zes breedtes ──────────────────────────────────── */
{
  const fouten = [];
  for (const breedte of [320, 390, 768, 1024, 1440, 1920]) {
    const browser = await startBrowser();
    const page = await browser.newPage({ viewport: { width: breedte, height: 900 } });
    for (const route of ROUTES) {
      await page.goto(BASIS + route, { waitUntil: "load" });
      await wacht(500);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) fouten.push(`${route} @${breedte}: ${over}px te breed`);
    }
    await browser.close();
  }
  meld("AC-T10 geen zijwaartse schuifbalk (6 breedtes × 6 pagina's)", fouten.length === 0, fouten.slice(0, 4).join(" | ") || "0 te brede pagina's");
}

const mislukt = uitslagen.filter((u) => !u.ok);
console.log(`features-test: ${mislukt.length ? "FAIL" : "PASS"} (${uitslagen.length - mislukt.length}/${uitslagen.length})`);
process.exit(mislukt.length ? 1 : 0);
