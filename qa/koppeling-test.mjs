#!/usr/bin/env node
/**
 * Het testprogramma van de ChatGPT-koppeling (PRD-002 §5.1): twaalf scenario's, end-to-end.
 *
 * Het praat met de MCP-route zoals ChatGPT dat doet — JSON-RPC over Streamable HTTP — en meet het
 * gevolg aan de andere kant: staat de nieuwe tekst op de voorbeeldlink, en op de demo nog de oude?
 *
 *   node qa/koppeling-test.mjs                          tegen de lokale route in testmodus
 *   node qa/koppeling-test.mjs --mcp <url>              een andere route
 *   node qa/koppeling-test.mjs --mcp-prod <url>         extra: een route die als productie draait
 *   node qa/koppeling-test.mjs --demo <url>             extra: de echte demo, in plaats van de link
 *                                                       die de server zelf noemt
 *
 * Exit 0 = alle scenario's groen. Vóór K1 hoort dit programma 0 keer PASS te geven; die tegenproef
 * staat in qa/koppeling-tegenproef.txt.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { McpClient, tekstUit } from "./lib/mcp.mjs";

const args = process.argv.slice(2);
const vlag = (naam, standaard) => {
  const i = args.indexOf(naam);
  return i >= 0 ? args[i + 1] : standaard;
};

const MCP = vlag("--mcp", process.env.MCP_URL ?? "http://localhost:4791/api/mcp/");
const MCP_PROD = vlag("--mcp-prod", process.env.MCP_PROD_URL);
const TESTTOKEN = process.env.KOPPELING_TESTTOKEN ?? "test-token-voor-de-controlereeks";
const SCHRIJF_TEGENPROEF = args.includes("--tegenproef");

const uitslagen = [];
const meld = (nummer, naam, ok, detail) => {
  uitslagen.push({ nummer, naam, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${String(nummer).padStart(2, " ")}. ${naam}${detail ? ` — ${detail}` : ""}`);
};
const mislukt = (nummer, naam, e) => meld(nummer, naam, false, `${e?.message ?? e}`.slice(0, 200));

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const haal = async (url) => {
  try {
    const r = await fetch(url, { redirect: "follow" });
    return { status: r.status, tekst: await r.text() };
  } catch (e) {
    return { status: 0, tekst: "", fout: e.message };
  }
};

/*
 * De inhoud van een bestand op een tak, ontcijferd.
 *
 * De contents-route van GitHub geeft base64 terug. Wie het antwoord als platte tekst leest, krijgt
 * een blok letters waar zijn zoekwoord nooit in staat: de eis is dan altijd onwaar en de meting
 * zegt niets. Daarom staat het ontcijferen op één plek.
 */
async function bestandOpTak(pad, tak) {
  const r = await haal(`${API}/repos/${REPO}/contents/${pad}?ref=${encodeURIComponent(tak)}`);
  try {
    return Buffer.from(JSON.parse(r.tekst).content, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/** Wacht tot een adres een tekst bevat, of geef op na `max` ms. */
async function wachtOpTekst(url, tekst, max = 300000) {
  const eind = Date.now() + max;
  while (Date.now() < eind) {
    const r = await haal(url);
    if (r.status === 200 && r.tekst.includes(tekst)) return true;
    await wacht(5000);
  }
  return false;
}

/** De taknaam uit een tool-antwoord. De tool noemt hem zonder voorvoegsel, tussen haakjes. */
const takUit = (antwoord) => {
  const heel = /voorstel\/[a-z0-9-]+/.exec(antwoord)?.[0];
  if (heel) return heel;
  const tussenHaakjes = /\(([0-9a-z][0-9a-z-]{3,})\)\s*$/m.exec(antwoord)?.[1];
  return tussenHaakjes ? `voorstel/${tussenHaakjes}` : undefined;
};

const NIEUWE_TEKST = `Proefzin van de controlereeks ${new Date().toISOString().slice(0, 16)}`;
let client;
let demo = vlag("--demo");
let voorstelTak;
let fotoTak;
const opgeruimd = [];

/** Alles wat openstaat intrekken, zodat het volgende scenario ruimte heeft. */
/*
 * De eerste lopende zin uit wat bekijk_pagina toont. Sommige secties tonen ze met een kastlijntje,
 * andere zonder; knopregels dragen "· doel:" en labels een woord met dubbele punt ervoor. Zonder dit onderscheid pakte de kiezer niets en
 * ging het scenario stuk op zijn eigen voorwerk in plaats van op de koppeling.
 */
function eersteZin(pagina) {
  return pagina
    .split("\n")
    .filter((r) => /^ {2}\S/.test(r) || /^ {2}– /.test(r))
    .map((r) => r.replace(/^ {2}(– )?/, "").trim())
    .filter((r) => r.length > 40 && !/^[a-z]+: /.test(r) && !r.includes("· doel:"))[0];
}

async function maakRuimte() {
  for (let ronde = 0; ronde < 3; ronde++) {
    const lijst = tekstUit(await client.roep("open_voorstellen"));
    const namen = [...lijst.matchAll(/^- ([0-9a-z-]+)/gm)].map((x) => x[1]);
    if (namen.length === 0) return;
    for (const naam of namen) await client.roep("trek_voorstel_in", { tak: naam }, { verwachtFout: true });
  }
}

/* ── 0. De hash van main, vóór alles (AC-V1) ─────────────────────────────────────────────── */
const API = process.env.GITHUB_API_BASIS ?? "https://api.github.com";
const REPO = process.env.KOPPELING_REPO ?? "ElsVHST/website_humanmargin";
const hashVanMain = async () => {
  const r = await haal(`${API}/repos/${REPO}/git/ref/heads/main`);
  try {
    return JSON.parse(r.tekst)?.object?.sha ?? null;
  } catch {
    return null;
  }
};
const mainVooraf = await hashVanMain();

/* ── 1. Zonder token ─────────────────────────────────────────────────────────────────────── */
try {
  const zonder = new McpClient(MCP);
  await zonder.verbind();
  meld(1, "aanroep zonder token geeft 401 met een geldige metadata-URL", false, "de route liet een verbinding zonder token toe");
} catch (e) {
  if (e.status !== 401) {
    mislukt(1, "aanroep zonder token geeft 401 met een geldige metadata-URL", e);
  } else {
    const kop = e.wwwAuthenticate ?? "";
    const adres = /resource_metadata="([^"]+)"/.exec(kop)?.[1];
    let geldig = false;
    let detail = `WWW-Authenticate: ${kop || "(ontbreekt)"}`;
    if (adres) {
      const r = await haal(adres);
      try {
        const j = JSON.parse(r.tekst);
        geldig = r.status === 200 && Boolean(j.resource) && Array.isArray(j.authorization_servers) && j.authorization_servers.length > 0;
        detail += ` · metadata ${r.status}, resource ${j.resource ?? "?"}`;
      } catch {
        detail += ` · metadata ${r.status}, geen geldige JSON`;
      }
    }
    meld(1, "aanroep zonder token geeft 401 met een geldige metadata-URL", geldig, detail);
  }
}

/* ── 2. Testtoken op een route die als productie draait ──────────────────────────────────── */
if (!MCP_PROD) {
  meld(2, "het testtoken werkt niet op een productieroute", false, "geen --mcp-prod opgegeven: niet gemeten");
} else {
  try {
    const prod = new McpClient(MCP_PROD, { token: TESTTOKEN });
    await prod.verbind();
    meld(2, "het testtoken werkt niet op een productieroute", false, "de productieroute accepteerde het testtoken");
  } catch (e) {
    meld(2, "het testtoken werkt niet op een productieroute", e.status === 401, `status ${e.status ?? e.message}`);
  }
}

/* ── Vanaf hier met het testtoken ────────────────────────────────────────────────────────── */
let verbonden = false;
try {
  client = new McpClient(MCP, { token: TESTTOKEN });
  const info = await client.verbind();
  verbonden = true;
  const instructies = info?.instructions ?? "";
  const agents = existsSync("AGENTS.md") ? readFileSync("AGENTS.md", "utf8") : "";
  // Elke regel moet letterlijk in AGENTS.md staan. Alleen de eerste regel controleren zou een
  // tweede kopie in de code niet opmerken.
  const regels = instructies.split("\n").map((r) => r.trim()).filter((r) => r.length > 3);
  const vreemd = regels.filter((r) => !agents.includes(r));
  meld(0, "AC-S0 de serverinstructies komen letterlijk uit AGENTS.md", instructies.length > 200 && vreemd.length === 0, `${regels.length} regels, ${vreemd.length} niet in AGENTS.md${vreemd.length ? `: "${vreemd[0].slice(0, 60)}"` : ""}`);
} catch (e) {
  mislukt(0, "AC-S0 de serverinstructies komen letterlijk uit AGENTS.md", e);
}

if (!verbonden) {
  console.log("\nde route antwoordt niet met het testtoken — de rest van de scenario's kan niet meten");
  for (const [n, naam] of [
    [3, "tekst wijzigen: de voorbeeldlink toont de nieuwe tekst, de demo nog de oude"],
    [4, "publiceren: de demo toont de nieuwe tekst"],
    [5, "terugdraaien: de demo toont weer de oude tekst"],
    [6, "nieuwe pagina met foto: verkleind en zonder GPS"],
    [7, "een SVG wordt geweigerd"],
    [8, "een poging op package.json wordt geweigerd"],
    [9, "een voorstel dat het schema breekt wordt geweigerd, met de reden"],
    [10, "<script> in een alinea staat als tekst op de voorbeeldlink"],
    [11, "het zesde open voorstel wordt geweigerd"],
    [12, "opruimen: 0 testtakken over en content ongewijzigd"],
  ]) {
    meld(n, naam, false, "niet gemeten: geen verbinding");
  }
} else {
  /* ── 3. Tekst wijzigen ─────────────────────────────────────────────────────────────────── */
  let voorbeeld;
  let oudeTekst;
  try {
    const site = await client.roep("bekijk_site");
    const siteTekst = tekstUit(site);
    demo ??= /https?:\/\/\S+/.exec(siteTekst)?.[0];

    const pagina = await client.roep("bekijk_pagina", { slug: "manifest" });
    // De eerste échte alinea, niet de kopregels erboven: bekijk_pagina laat inhoud met twee
    // spaties inspringen, en zet er geen blokhaak voor zoals bij een kop of een knop.
    oudeTekst = tekstUit(pagina)
      .split("\n")
      .filter((r) => r.startsWith("  ") && !r.trim().startsWith("[") && !r.trim().startsWith("–") && r.trim().length > 40 && !/^[a-z]+:/.test(r.trim()))
      .map((r) => r.trim())[0];
    if (!oudeTekst) throw new Error("geen alinea gevonden om te wijzigen");

    const voorstel = await client.roep("stel_wijziging_voor", {
      pagina: "manifest",
      wijzigingen: [{ zoek: oudeTekst, vervang: `${oudeTekst} ${NIEUWE_TEKST}` }],
      toelichting: "proef van de controlereeks",
    });
    const antwoord = tekstUit(voorstel);
    voorbeeld = /https?:\/\/\S+/.exec(antwoord)?.[0]?.replace(/[.,)]$/, "");
    voorstelTak = takUit(antwoord);
    if (voorstelTak) opgeruimd.push(voorstelTak);

    const opVoorbeeld = voorbeeld ? await wachtOpTekst(`${voorbeeld}/manifest/`, NIEUWE_TEKST) : false;
    const opDemo = demo ? (await haal(`${demo}/manifest/`)).tekst.includes(NIEUWE_TEKST) : true;
    meld(3, "tekst wijzigen: de voorbeeldlink toont de nieuwe tekst, de demo nog de oude", opVoorbeeld && !opDemo, `voorbeeld ${voorbeeld ?? "geen link"} · op de demo ${opDemo ? "WEL" : "niet"}`);
  } catch (e) {
    mislukt(3, "tekst wijzigen: de voorbeeldlink toont de nieuwe tekst, de demo nog de oude", e);
  }

  /* ── 4. Publiceren ─────────────────────────────────────────────────────────────────────── */
  try {
    const r = await client.roep("publiceer", { tak: voorstelTak });
    const live = demo ? await wachtOpTekst(`${demo}/manifest/`, NIEUWE_TEKST) : false;
    meld(4, "publiceren: de demo toont de nieuwe tekst", live, tekstUit(r).slice(0, 120));
  } catch (e) {
    mislukt(4, "publiceren: de demo toont de nieuwe tekst", e);
  }

  /* ── 5. Terugdraaien ───────────────────────────────────────────────────────────────────── */
  try {
    const r = await client.roep("draai_terug", {});
    const weg = demo
      ? await (async () => {
          const eind = Date.now() + 300000;
          while (Date.now() < eind) {
            const h = await haal(`${demo}/manifest/`);
            if (h.status === 200 && !h.tekst.includes(NIEUWE_TEKST)) return true;
            await wacht(5000);
          }
          return false;
        })()
      : false;
    meld(5, "terugdraaien: de demo toont weer de oude tekst", weg, tekstUit(r).slice(0, 120));
  } catch (e) {
    mislukt(5, "terugdraaien: de demo toont weer de oude tekst", e);
  }

  /* ── 6. Nieuwe pagina met foto ─────────────────────────────────────────────────────────── */
  try {
    const foto = process.env.KOPPELING_TESTFOTO ?? "";
    const r = await client.roep("nieuwe_pagina", {
      slug: "proef-controlereeks",
      titel: "Proefpagina controlereeks",
      kop: "Proefpagina van de controle",
      bouwstenen: [{ type: "alinea", tekst: "Een alinea van de controlereeks, met genoeg woorden om te meten." }],
    });
    const antwoord = tekstUit(r);
    const link = /https?:\/\/\S+/.exec(antwoord)?.[0]?.replace(/[.,)]$/, "");
    const tak = takUit(antwoord);
    if (tak) opgeruimd.push(tak);
    fotoTak = tak;
    let fotoGoed = "geen foto meegegeven (zet KOPPELING_TESTFOTO)";
    let fotoOk = true;
    if (foto) {
      const f = await client.roep("voeg_foto_toe", { pagina: "proef-controlereeks", naam: "proeffoto-controlereeks", alt: "Effen vlak, gemaakt door de controlereeks", bestand: { download_url: foto, name: "proef.jpg", mime_type: "image/jpeg" }, tak: tak ?? undefined });
      fotoGoed = tekstUit(f).slice(0, 160);
      // Niet op het antwoord afgaan: de foto zelf terughalen en nameten.
      const gecommit = await haal(`${process.env.GITHUB_API_BASIS ?? "https://api.github.com"}/repos/${process.env.KOPPELING_REPO ?? "ElsVHST/website_humanmargin"}/contents/public/media/proeffoto-controlereeks.jpg?ref=${encodeURIComponent(tak ?? "")}`);
      try {
        const { createRequire } = await import("node:module");
        const sharp = createRequire(import.meta.url)("sharp");
        const ruw = Buffer.from(JSON.parse(gecommit.tekst).content, "base64");
        const meta = await sharp(ruw).metadata();
        const gps = meta.exif ? /GPS/.test(ruw.subarray(0, 4096).toString("latin1")) : false;
        // Ook de lijst met beelden nameten: zonder regel daarin kan geen pagina naar de foto wijzen.
        const lijst = await haal(`${process.env.GITHUB_API_BASIS ?? "https://api.github.com"}/repos/${process.env.KOPPELING_REPO ?? "ElsVHST/website_humanmargin"}/contents/content/media.json?ref=${encodeURIComponent(tak ?? "")}`);
        const manifest = JSON.parse(Buffer.from(JSON.parse(lijst.tekst).content, "base64").toString("utf8"));
        const regel = (manifest.beelden ?? []).find((b) => b.id === "proeffoto-controlereeks");
        fotoOk = Math.max(meta.width, meta.height) <= 2400 && !gps && regel?.bestand === "/media/proeffoto-controlereeks.jpg";
        fotoGoed = `${meta.width}×${meta.height}, ${Math.round(ruw.length / 1024)} kB, EXIF ${meta.exif ? `${meta.exif.length} bytes` : "weg"}, GPS ${gps ? "AANWEZIG" : "weg"}, lijst ${regel ? regel.bestand : "GEEN REGEL"}`;
      } catch (e) {
        fotoOk = false;
        fotoGoed = `kon de foto niet nameten: ${e.message}`;
      }
    }
    const staatErop = link ? await wachtOpTekst(`${link}/proef-controlereeks/`, "Proefpagina van de controle") : false;
    meld(6, "nieuwe pagina met foto: verkleind en zonder GPS", staatErop && fotoOk, `${link ?? "geen link"} · ${fotoGoed}`);
  } catch (e) {
    mislukt(6, "nieuwe pagina met foto: verkleind en zonder GPS", e);
  }

  /* ── 7 t/m 11: wat geweigerd hoort te worden ───────────────────────────────────────────── */
  const weigering = async (nummer, naam, roep) => {
    try {
      const r = await roep();
      const tekst = tekstUit(r);
      const geweigerd = r?.isError === true || /kan ik niet|geweigerd|niet toegestaan|lukt niet|mag niet/i.test(tekst);
      meld(nummer, naam, geweigerd, tekst.slice(0, 140) || "geen melding");
    } catch (e) {
      // Een JSON-RPC-fout is ook een weigering, zolang er een leesbare reden in staat.
      const reden = e.rpc?.message ?? e.message;
      meld(nummer, naam, Boolean(reden), String(reden).slice(0, 140));
    }
  };

  await weigering(7, "een SVG wordt geweigerd", () =>
    client.roep("voeg_foto_toe", { pagina: "manifest", tak: fotoTak, alt: "Proef van de controlereeks", bestand: { download_url: "http://localhost:1/x.svg", name: "x.svg", mime_type: "image/svg+xml" } }, { verwachtFout: true }),
  );
  await weigering(8, "een poging op package.json wordt geweigerd", () =>
    client.roep("stel_wijziging_voor", { pagina: "../../package.json", wijzigingen: [{ zoek: "name", vervang: "gekaapt" }] }, { verwachtFout: true }),
  );
  await weigering(9, "een voorstel dat het schema breekt wordt geweigerd, met de reden", () =>
    client.roep("nieuwe_pagina", { slug: "proef-kapot", titel: "", kop: "", bouwstenen: [{ type: "onbekend", tekst: "x" }] }, { verwachtFout: true }),
  );

  await weigering(14, "een pagina met een foto die niet bestaat wordt geweigerd", () =>
    client.roep(
      "nieuwe_pagina",
      {
        slug: "proef-onbekende-foto",
        titel: "Proefpagina onbekende foto",
        kop: "Proef met een foto die niet bestaat",
        bouwstenen: [
          { type: "alinea", tekst: "Een alinea van de controlereeks, lang genoeg om te meten." },
          { type: "foto", beeld: "bestaat-niet" },
        ],
      },
      { verwachtFout: true },
    ),
  );

  /* ── 10. Script in een alinea ──────────────────────────────────────────────────────────── */
  try {
    const r = await client.roep("nieuwe_pagina", {
      slug: "proef-script",
      titel: "Proefpagina script",
      kop: "Proef met een script",
      bouwstenen: [{ type: "alinea", tekst: "<script>alert(1)</script> en verder gewone tekst om te meten." }],
    });
    const link = /https?:\/\/\S+/.exec(tekstUit(r))?.[0]?.replace(/[.,)]$/, "");
    const tak = takUit(tekstUit(r));
    if (tak) opgeruimd.push(tak);
    let alsTekst = false;
    if (link && (await wachtOpTekst(`${link}/proef-script/`, "gewone tekst om te meten"))) {
      const h = await haal(`${link}/proef-script/`);
      alsTekst = h.tekst.includes("&lt;script&gt;") && !/<script>alert\(1\)<\/script>/.test(h.tekst);
    }
    meld(10, "<script> in een alinea staat als tekst op de voorbeeldlink", alsTekst, link ?? "geen link");
  } catch (e) {
    mislukt(10, "<script> in een alinea staat als tekst op de voorbeeldlink", e);
  }

  /* ── 11. Het zesde open voorstel ───────────────────────────────────────────────────────── */
  await weigering(11, "het zesde open voorstel wordt geweigerd", async () => {
    let laatste;
    for (let i = 0; i < 6; i++) {
      laatste = await client.roep("nieuwe_pagina", { slug: `proef-limiet-${i}`, titel: `Proef ${i}`, kop: `Proef ${i}`, bouwstenen: [{ type: "alinea", tekst: `Alinea ${i} van de controlereeks, lang genoeg om te meten.` }] }, { verwachtFout: true });
      const tak = takUit(tekstUit(laatste));
      if (tak) opgeruimd.push(tak);
    }
    return laatste;
  });

  /* ── 15 t/m 22: wat de beta-tester vond, blijft gerepareerd ────────────────────────────── */
  // Eerst opruimen: met vijf openstaande voorstellen meet elk scenario hieronder alleen de grens.
  await maakRuimte();
  await weigering(15, "een foto zonder voorstel wordt geweigerd", () =>
    client.roep("voeg_foto_toe", { alt: "Proeffoto van de controlereeks", bestand: { download_url: process.env.KOPPELING_TESTFOTO ?? "http://localhost:1/x.jpg", name: "los.jpg", mime_type: "image/jpeg" } }, { verwachtFout: true }),
  );

  await weigering(16, "een voorstel intrekken dat niet bestaat wordt geweigerd", () =>
    client.roep("trek_voorstel_in", { tak: "2026-01-01-bestaat-niet" }, { verwachtFout: true }),
  );

  await weigering(17, "een wijziging waarbij oud en nieuw gelijk zijn wordt geweigerd", () =>
    client.roep("stel_wijziging_voor", { pagina: "manifest", wijzigingen: [{ zoek: "de", vervang: "de" }] }, { verwachtFout: true }),
  );

  try {
    const overzicht = tekstUit(await client.roep("bekijk_site"));
    meld(18, "het overzicht bevat nergens \"undefined\"", !/undefined/.test(overzicht), overzicht.split("\n").slice(2, 4).join(" · ").slice(0, 120));
  } catch (e) {
    mislukt(18, "het overzicht bevat nergens \"undefined\"", e);
  }

  try {
    // Een woord dat óók in een beeld-id voorkomt: dat id mag niet meeveranderen.
    const paginaAanbod = tekstUit(await client.roep("bekijk_pagina", { slug: "aanbod" }));
    const woord = /\[foto\] ([a-z0-9-]+)/.exec(paginaAanbod)?.[1]?.split("-").find((d) => d.length > 5);
    if (!woord) {
      meld(19, "een tekstwijziging laat beeld-ids met rust", true, "geen beeld met een lang woord in de naam; niets te verwarren");
    } else {
      const r = await client.roep("stel_wijziging_voor", { pagina: "aanbod", wijzigingen: [{ zoek: woord, vervang: `${woord}x` }] }, { verwachtFout: true });
      const tak = takUit(tekstUit(r));
      if (tak) opgeruimd.push(tak);
      let idsOngemoeid = true;
      if (tak) {
        const bestand = await haal(`${API}/repos/${REPO}/contents/content/paginas/aanbod.json?ref=${encodeURIComponent(tak)}`);
        const json = JSON.parse(Buffer.from(JSON.parse(bestand.tekst).content, "base64").toString("utf8"));
        idsOngemoeid = !JSON.stringify(json).includes(`"beeld": "${woord}x`) && !JSON.stringify(json).includes(`${woord}x-`);
      }
      meld(19, "een tekstwijziging laat beeld-ids met rust", idsOngemoeid, `gezocht op "${woord}" · beeld-ids ${idsOngemoeid ? "ongemoeid" : "MEEVERANDERD"}`);
    }
  } catch (e) {
    mislukt(19, "een tekstwijziging laat beeld-ids met rust", e);
  }

  try {
    const eerste = await client.roep("nieuwe_pagina", { slug: "proef-tweemaal", titel: "Proef tweemaal", kop: "Proef tweemaal", bouwstenen: [{ type: "alinea", tekst: "Dezelfde alinea, twee keer ingediend, om te zien of er één tak komt." }] }, { verwachtFout: true });
    const tweede = await client.roep("nieuwe_pagina", { slug: "proef-tweemaal", titel: "Proef tweemaal", kop: "Proef tweemaal", bouwstenen: [{ type: "alinea", tekst: "Dezelfde alinea, twee keer ingediend, om te zien of er één tak komt." }] }, { verwachtFout: true });
    const t1 = takUit(tekstUit(eerste));
    const t2 = takUit(tekstUit(tweede));
    if (t1) opgeruimd.push(t1);
    if (t2) opgeruimd.push(t2);
    meld(20, "twee keer hetzelfde voorstel geeft één tak", Boolean(t1) && t1 === t2, `${t1 ?? "?"} en ${t2 ?? "?"}`);
  } catch (e) {
    mislukt(20, "twee keer hetzelfde voorstel geeft één tak", e);
  }

  try {
    const metVreemdeHost = await fetch(`${new URL(MCP).origin}/.well-known/oauth-authorization-server`, { headers: { "x-forwarded-host": "aanvaller.example.com", "x-forwarded-proto": "https" } });
    const j = await metVreemdeHost.json();
    const schoon = !JSON.stringify(j).includes("aanvaller.example.com");
    meld(21, "een vreemde host-kop verandert de metadata niet", schoon, `issuer ${j.issuer}`);
  } catch (e) {
    mislukt(21, "een vreemde host-kop verandert de metadata niet", e);
  }

  try {
    const r = await fetch(`${new URL(MCP).origin}/api/oauth/authorize/?response_type=code&client_id=https%3A%2F%2Fchatgpt.com%2Fclient&redirect_uri=https%3A%2F%2Faanvaller.example.com%2Fpak&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256`, { redirect: "manual" });
    meld(22, "een redirect_uri die niet bij de client hoort wordt geweigerd", r.status === 403 || r.status === 400, `status ${r.status}`);
  } catch (e) {
    mislukt(22, "een redirect_uri die niet bij de client hoort wordt geweigerd", e);
  }

  /* ── 24 t/m 29: wat ronde 2 van de beta-tester vond ────────────────────────────────────── */
  await maakRuimte();

  try {
    // Publiceren, terugdraaien, en dan nóg eens terugdraaien: dat laatste moet de terugdraaiing
    // ongedaan maken, niet opnieuw dezelfde publicatie "terugdraaien" met een lege melding.
    const pagina = tekstUit(await client.roep("bekijk_pagina", { slug: "contact" }));
    const zin = eersteZin(pagina);
    const merk = `PROEF-TERUGDRAAIEN-${Date.now().toString().slice(-5)}`;
    const voorstel = await client.roep("stel_wijziging_voor", { pagina: "contact", wijzigingen: [{ zoek: zin, vervang: `${zin} ${merk}` }] }, { verwachtFout: true });
    const tak = takUit(tekstUit(voorstel));
    const gepubliceerd = tekstUit(await client.roep("publiceer", { tak }, { verwachtFout: true }));
    const naPublicatie = (await bestandOpTak("content/paginas/contact.json", "eerste-versie")).includes(merk);
    await client.roep("draai_terug", {});
    const naEerste = (await bestandOpTak("content/paginas/contact.json", "eerste-versie")).includes(merk);
    const tweede = tekstUit(await client.roep("draai_terug", {}, { verwachtFout: true }));
    const naTweede = (await bestandOpTak("content/paginas/contact.json", "eerste-versie")).includes(merk);
    meld(
      24,
      "twee keer terugdraaien draait ook de terugdraaiing terug",
      naPublicatie && !naEerste && naTweede,
      `tak ${tak ?? "geen"} · voorstel "${tekstUit(voorstel).split("\n")[0].slice(0, 50)}" · publiceren "${gepubliceerd.split("\n")[0].slice(0, 50)}" · na publiceren ${naPublicatie} · na 1× terug ${naEerste} · na 2× terug ${naTweede} · 2e melding "${tweede.slice(0, 50)}"`,
    );
    // De site weer netjes achterlaten.
    await client.roep("draai_terug", {}, { verwachtFout: true });
  } catch (e) {
    mislukt(24, "twee keer terugdraaien draait ook de terugdraaiing terug", e);
  }

  try {
    // Een zinswijziging mag het bestand niet laten zwellen met standaardwaarden die het schema
    // invult. Vroeger schreef het voorstel de schema-afdruk terug: twintig velden erbij die Els
    // nooit gevraagd had, en een onleesbaar verschil in de voorbeeldlink.
    const voor = JSON.parse(await bestandOpTak("content/paginas/manifest.json", "eerste-versie"));
    const p30 = tekstUit(await client.roep("bekijk_pagina", { slug: "manifest" }));
    const z30 = eersteZin(p30);
    const r30 = await client.roep("stel_wijziging_voor", { pagina: "manifest", wijzigingen: [{ zoek: z30, vervang: `${z30} (proef 30)` }] }, { verwachtFout: true });
    const t30 = takUit(tekstUit(r30));
    if (t30) opgeruimd.push(t30);
    const na = t30 ? JSON.parse(await bestandOpTak("content/paginas/manifest.json", t30)) : null;
    const sleutels = (o, voorvoegsel = "") =>
      o && typeof o === "object"
        ? Object.entries(o).flatMap(([k, v]) => [`${voorvoegsel}${k}`, ...sleutels(v, `${voorvoegsel}${k}.`)])
        : [];
    const erbij = na ? sleutels(na).filter((k) => !sleutels(voor).includes(k)) : ["geen tak"];
    meld(30, "een zinswijziging voegt geen velden toe", erbij.length === 0, `velden erbij: ${erbij.length}${erbij.length ? ` — ${erbij.slice(0, 5).join(", ")}` : ""}`);
  } catch (e) {
    mislukt(30, "een zinswijziging voegt geen velden toe", e);
  }

  try {
    // Lezen en schrijven moeten dezelfde bron zien: wat bekijk_pagina toont, moet te wijzigen zijn.
    const pagina = tekstUit(await client.roep("bekijk_pagina", { slug: "over-mij" }));
    const zin = eersteZin(pagina);
    const r = await client.roep("stel_wijziging_voor", { pagina: "over-mij", wijzigingen: [{ zoek: zin, vervang: `${zin} (proef)` }] }, { verwachtFout: true });
    const tak = takUit(tekstUit(r));
    if (tak) opgeruimd.push(tak);
    const gelukt = !/staat niet op de pagina/i.test(tekstUit(r));
    meld(25, "wat bekijk_pagina toont, is ook te wijzigen", gelukt, tekstUit(r).split("\n")[0].slice(0, 90));
  } catch (e) {
    mislukt(25, "wat bekijk_pagina toont, is ook te wijzigen", e);
  }

  try {
    const r = await fetch(`${new URL(MCP).origin}/.well-known/oauth-protected-resource/`, { headers: { "x-forwarded-host": `${new URL(MCP).host}@kwaadaardig.example.com`, "x-forwarded-proto": "https" } });
    const tekstje = await r.text();
    const varyKop = r.headers.get("vary") ?? "";
    meld(26, "een host-kop met een @ verandert de metadata niet", !tekstje.includes("kwaadaardig.example.com") && varyKop.split(",").map((t) => t.trim().toLowerCase()).includes("x-forwarded-host"), `${tekstje.slice(0, 70)}… · vary ${varyKop.slice(0, 40)}`);
  } catch (e) {
    mislukt(26, "een host-kop met een @ verandert de metadata niet", e);
  }

  try {
    const grens = Number(process.env.KOPPELING_MAX_PER_MINUUT ?? 30);
    const vuur = (schrijfwijze) =>
      fetch(MCP, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `${schrijfwijze} tempo-proef-token` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }).then((r) => r.status);
    await Promise.all(Array.from({ length: grens + 2 }, () => vuur("Bearer")));
    const anders = await Promise.all([vuur("bearer"), vuur("BEARER"), vuur("BeArEr")]);
    meld(27, "de rem telt per token, niet per schrijfwijze", anders.every((s) => s === 429), `andere schrijfwijzen: ${anders.join(", ")}`);
  } catch (e) {
    mislukt(27, "de rem telt per token, niet per schrijfwijze", e);
  }

  await weigering(28, "een foto op een voorstel dat niet bestaat wordt geweigerd", () =>
    client.roep("voeg_foto_toe", { tak: "voorstel/2026-01-01-bestaat-niet", alt: "Proef van de controlereeks", naam: "proef-onbekende-tak", bestand: { download_url: process.env.KOPPELING_TESTFOTO ?? "http://localhost:1/x.jpg", name: "x.jpg", mime_type: "image/jpeg" } }, { verwachtFout: true }),
  );

  try {
    const r = await client.roep("nieuwe_pagina", { slug: "proef-omleiding", titel: "Proef omleiding", kop: "Proef omleiding", bouwstenen: [{ type: "alinea", tekst: "Een alinea van de controlereeks, lang genoeg om te meten." }] }, { verwachtFout: true });
    const tak = takUit(tekstUit(r));
    if (tak) opgeruimd.push(tak);
    const omleiding = `${API}/omleiding?naar=${encodeURIComponent("https://example.com/plaatje.jpg")}`;
    const f = await client.roep("voeg_foto_toe", { tak, alt: "Proef van de controlereeks", naam: "proef-via-omleiding", bestand: { download_url: omleiding, name: "x.jpg", mime_type: "image/jpeg" } }, { verwachtFout: true });
    const geweigerd = /kan ik niet ophalen|niet ophalen/i.test(tekstUit(f)) || f?.isError === true;
    meld(29, "een omleiding naar een vreemde host wordt geweigerd", geweigerd, tekstUit(f).slice(0, 90));
  } catch (e) {
    meld(29, "een omleiding naar een vreemde host wordt geweigerd", true, String(e.message).slice(0, 90));
  }

  /* ── 12. Opruimen ──────────────────────────────────────────────────────────────────────── */
  try {
    // Alles opruimen wat er nog openstaat, ongeacht hoe het heette: de namen uit de antwoorden
    // plukken is te fragiel gebleken (de tool noemt ze zonder het voorvoegsel).
    for (let ronde = 0; ronde < 3; ronde++) {
      const lijst = tekstUit(await client.roep("open_voorstellen"));
      const namen = [...lijst.matchAll(/^- ([0-9a-z-]+)/gm)].map((x) => x[1]);
      if (namen.length === 0) break;
      for (const naam of namen) await client.roep("trek_voorstel_in", { tak: naam }, { verwachtFout: true });
    }
    const open = tekstUit(await client.roep("open_voorstellen"));
    const schoon = /geen voorstellen open/i.test(open);
    meld(12, "opruimen: 0 testtakken over en content ongewijzigd", schoon, open.slice(0, 160));
  } catch (e) {
    mislukt(12, "opruimen: 0 testtakken over en content ongewijzigd", e);
  }
}

/* ── 23. Te snel achter elkaar geeft 429 (AC-V6) ─────────────────────────────────────────── */
if (verbonden) {
  try {
    const grens = Number(process.env.KOPPELING_MAX_PER_MINUUT ?? 30);
    const antwoorden = await Promise.all(
      Array.from({ length: grens + 5 }, () =>
        fetch(MCP, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: "Bearer overbelasting-proef" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        }).then((r) => r.status),
      ),
    );
    const teveel = antwoorden.filter((s) => s === 429).length;
    meld(23, "te snel achter elkaar geeft 429", teveel > 0, `${antwoorden.length} aanroepen · ${teveel} keer 429 · grens ${grens} per minuut`);
  } catch (e) {
    mislukt(23, "te snel achter elkaar geeft 429", e);
  }
}

/* ── 13. main is nergens geraakt (AC-V1) ─────────────────────────────────────────────────── */
if (!verbonden) {
  // Zonder verbinding is er niets gebeurd, dus zegt "main is niet geraakt" ook niets.
  meld(13, "main staat nog precies waar hij stond", false, "niet gemeten: geen verbinding");
} else {
  const mainAchteraf = await hashVanMain();
  meld(13, "main staat nog precies waar hij stond", Boolean(mainVooraf) && mainVooraf === mainAchteraf, `vooraf ${mainVooraf?.slice(0, 12) ?? "?"} · achteraf ${mainAchteraf?.slice(0, 12) ?? "?"}`);
}

/* ── Uitslag ─────────────────────────────────────────────────────────────────────────────── */
const goed = uitslagen.filter((u) => u.ok).length;
const regel = `koppeling-test: ${goed === uitslagen.length ? "PASS" : "FAIL"} (${goed}/${uitslagen.length})`;
console.log(`\n${regel}`);
if (SCHRIJF_TEGENPROEF) {
  writeFileSync(
    "qa/koppeling-tegenproef.txt",
    [
      "Tegenproef van het testprogramma van de koppeling.",
      "Vóór K1 bestaat de route nog niet; dan hoort dit programma 0 keer PASS te geven.",
      "",
      `Gedraaid op ${new Date().toISOString().slice(0, 16).replace("T", " ")} tegen ${MCP}`,
      "",
      ...uitslagen.map((u) => `${u.ok ? "PASS" : "FAIL"} ${String(u.nummer).padStart(2, " ")}. ${u.naam}`),
      "",
      regel,
    ].join("\n"),
  );
  console.log("tegenproef weggeschreven naar qa/koppeling-tegenproef.txt");
}
process.exit(goed === uitslagen.length ? 0 : 1);
