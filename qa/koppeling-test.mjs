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
const opgeruimd = [];

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
        fotoOk = Math.max(meta.width, meta.height) <= 2400 && !gps;
        fotoGoed = `${meta.width}×${meta.height}, ${Math.round(ruw.length / 1024)} kB, EXIF ${meta.exif ? `${meta.exif.length} bytes` : "weg"}, GPS ${gps ? "AANWEZIG" : "weg"}`;
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
    client.roep("voeg_foto_toe", { pagina: "manifest", alt: "Proef", bestand: { download_url: "http://localhost:1/x.svg", name: "x.svg", mime_type: "image/svg+xml" } }, { verwachtFout: true }),
  );
  await weigering(8, "een poging op package.json wordt geweigerd", () =>
    client.roep("stel_wijziging_voor", { pagina: "../../package.json", wijzigingen: [{ zoek: "name", vervang: "gekaapt" }] }, { verwachtFout: true }),
  );
  await weigering(9, "een voorstel dat het schema breekt wordt geweigerd, met de reden", () =>
    client.roep("nieuwe_pagina", { slug: "proef-kapot", titel: "", kop: "", bouwstenen: [{ type: "onbekend", tekst: "x" }] }, { verwachtFout: true }),
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

/* ── 13. main is nergens geraakt (AC-V1) ─────────────────────────────────────────────────── */
{
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
