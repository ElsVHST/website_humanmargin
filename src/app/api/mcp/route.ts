import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { mcpAdres, publiekeBasis } from "@/lib/koppeling/basis";
import { serverinstructies } from "@/lib/koppeling/instructies";
import { siteOverzicht, paginaOverzicht } from "@/lib/koppeling/lezen";
import { isTesttoken, leesToken } from "@/lib/koppeling/toegang";
import { tempoControle } from "@/lib/koppeling/tempo";
import { nieuwePagina, openVoorstellen, trekIn, wijzigTekst } from "@/lib/koppeling/voorstellen";
import { voorbeeldlink } from "@/lib/koppeling/github";
import { voegFotoToe } from "@/lib/koppeling/fotos";
import { draaiTerug, geschiedenis, publiceer } from "@/lib/koppeling/publiceren";

/*
 * De MCP-route: de enige dynamische route van deze site (PRD-001 AC-T13, PRD-002 §3.1).
 * ChatGPT praat hier met de site. Alles wat een tool teruggeeft is gewone taal voor Els.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const tekst = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

/** Wat Els hoort na een voorstel: wat er verandert, waar ze het kan bekijken, en wat nu kan. */
function meldVoorstel(v: { tak: string; samenvatting: string; link: string | null }) {
  const naam = v.tak.replace("voorstel/", "");
  return tekst(
    v.link
      ? `Klaar. Bekijk het hier: ${v.link}\n\n${v.samenvatting}\n\nZeg "publiceer" als het goed is, of "trek in" als het toch niet moet. (${naam})`
      : `Het voorstel staat klaar. De voorbeeldlink komt eraan, dat duurt meestal 1 à 2 minuten — vraag zo "open voorstellen".\n\n${v.samenvatting}\n\n(${naam})`,
  );
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "bekijk_site",
      {
        description: "Geeft een overzicht van de site: welke pagina's er zijn, wat erop staat en wat je kunt wijzigen.",
        inputSchema: {},
        annotations: { readOnlyHint: true, title: "Bekijk de site" },
      },
      async () => tekst(siteOverzicht()),
    );

    server.registerTool(
      "bekijk_pagina",
      {
        description: "Geeft de inhoud van één pagina als leesbare tekst. Gebruik de naam uit bekijk_site, bijvoorbeeld 'aanbod'.",
        inputSchema: { slug: z.string().describe("de naam van de pagina, bijvoorbeeld 'aanbod' of 'home'") },
        annotations: { readOnlyHint: true, title: "Bekijk een pagina" },
      },
      async ({ slug }: { slug: string }) => tekst(paginaOverzicht(String(slug).trim().toLowerCase())),
    );

    server.registerTool(
      "stel_wijziging_voor",
      {
        description:
          "Wijzigt tekst op een bestaande pagina en zet er een voorbeeldlink bij. Publiceert nog niets. Geef per wijziging de tekst die er nu staat en de tekst die er moet komen.",
        inputSchema: {
          pagina: z.string().describe("de naam van de pagina, bijvoorbeeld 'aanbod'"),
          wijzigingen: z
            .array(z.object({ zoek: z.string().describe("de tekst die er nu staat"), vervang: z.string().describe("de tekst die er moet komen") }))
            .min(1),
          toelichting: z.string().optional().describe("in één zin waarom, voor in de geschiedenis"),
        },
        annotations: { title: "Stel een wijziging voor", destructiveHint: false },
      },
      async (a: { pagina: string; wijzigingen: { zoek: string; vervang: string }[]; toelichting?: string }) =>
        meldVoorstel(await wijzigTekst(a.pagina, a.wijzigingen, a.toelichting)),
    );

    server.registerTool(
      "nieuwe_pagina",
      {
        description: "Maakt een voorstel voor een nieuwe pagina op de site, met een voorbeeldlink. Publiceert nog niets.",
        inputSchema: {
          slug: z.string().describe("het adres van de pagina, kleine letters en streepjes, bijvoorbeeld 'workshop-12-november'"),
          titel: z.string().describe("de titel in de browsertab"),
          kop: z.string().describe("de kop boven aan de pagina"),
          beschrijving: z.string().optional().describe("één zin voor Google en voor het delen"),
          bouwstenen: z.array(z.record(z.string(), z.unknown())).describe("de onderdelen: kop, alinea, citaat, foto, lijst of knop"),
        },
        annotations: { title: "Maak een nieuwe pagina" },
      },
      async (a: { slug: string; titel: string; kop: string; beschrijving?: string; bouwstenen: unknown[] }) => meldVoorstel(await nieuwePagina(a)),
    );

    server.registerTool(
      "open_voorstellen",
      {
        description: "Laat zien welke voorstellen er nog openstaan, met hun voorbeeldlink.",
        inputSchema: {},
        annotations: { readOnlyHint: true, title: "Open voorstellen" },
      },
      async () => {
        const open = await openVoorstellen();
        if (open.length === 0) return tekst("Er staan geen voorstellen open.");
        const regels = await Promise.all(
          open.map(async (t) => {
            const link = await voorbeeldlink(t);
            return `- ${t.replace("voorstel/", "")}${link ? ` — ${link}` : " — de voorbeeldlink komt eraan"}`;
          }),
        );
        return tekst([`Er ${open.length === 1 ? "staat 1 voorstel" : `staan ${open.length} voorstellen`} open:`, ...regels].join("\n"));
      },
    );

    server.registerTool(
      "voeg_foto_toe",
      {
        description:
          "Voegt een foto toe aan de site. Alleen JPEG, PNG of WebP, hoogstens 15 MB. De foto wordt verkleind en de cameragegevens gaan eruit. Beschrijf altijd wat er te zien is.",
        inputSchema: {
          alt: z.string().describe("wat er op de foto te zien is, voor wie de site niet kan zien"),
          bestand: z
            .object({ download_url: z.string().optional(), name: z.string().optional(), mime_type: z.string().optional() })
            .describe("het bestand zoals ChatGPT het meegeeft"),
          naam: z.string().optional().describe("hoe de foto moet heten op de site"),
          pagina: z.string().optional().describe("bij welke pagina de foto hoort (alleen voor de melding)"),
          tak: z.string().optional().describe("het voorstel waar de foto bij hoort"),
        },
        annotations: { title: "Voeg een foto toe" },
      },
      async (a: { alt: string; bestand: { download_url?: string; name?: string; mime_type?: string }; naam?: string; tak?: string }) => {
        const tak = a.tak ? (a.tak.startsWith("voorstel/") ? a.tak : `voorstel/${a.tak}`) : undefined;
        const r = await voegFotoToe({ alt: a.alt, bestand: a.bestand, naam: a.naam, tak });
        return tekst(`De foto staat klaar als "${r.id}" (${r.breedte} bij ${r.hoogte} pixels, ${r.kilobytes} kB, zonder cameragegevens). Je kunt hem nu op een pagina zetten.`);
      },
    );

    server.registerTool(
      "publiceer",
      {
        description: "Zet een voorstel op de site. Doe dit pas als de voorbeeldlink goed is.",
        inputSchema: { tak: z.string().optional().describe("welk voorstel; laat leeg als er maar één openstaat") },
        annotations: { title: "Publiceer", destructiveHint: false, openWorldHint: true },
      },
      async ({ tak }: { tak?: string }) => {
        const r = await publiceer(tak);
        return tekst(`Gepubliceerd. Het staat nu op ${r.adres || "de site"}; het kan een paar minuten duren voor je het ziet.`);
      },
    );

    server.registerTool(
      "draai_terug",
      {
        description: "Draait de laatste publicatie terug, of een eerdere die je uit de geschiedenis kiest.",
        inputSchema: { publicatie: z.string().optional().describe("de code van de publicatie uit geschiedenis; laat leeg voor de laatste") },
        annotations: { title: "Draai terug", destructiveHint: true },
      },
      async ({ publicatie }: { publicatie?: string }) => {
        const r = await draaiTerug(publicatie);
        return tekst(`Teruggedraaid: ${r.teruggedraaid}. Het staat weer zoals het was op ${r.adres || "de site"}.`);
      },
    );

    server.registerTool(
      "geschiedenis",
      {
        description: "Toont de laatste publicaties met datum, zodat je er een kunt terugdraaien.",
        inputSchema: { hoeveel: z.number().optional().describe("hoeveel er getoond worden, standaard 20") },
        annotations: { readOnlyHint: true, title: "Geschiedenis" },
      },
      async ({ hoeveel }: { hoeveel?: number }) => {
        const lijst = await geschiedenis(Math.min(Math.max(Number(hoeveel ?? 20), 1), 50));
        if (lijst.length === 0) return tekst("Er is nog niets gepubliceerd.");
        return tekst(lijst.map((c) => `- ${c.datum.slice(0, 10)} · ${c.boodschap.split("\n")[0]} (${c.sha.slice(0, 7)})`).join("\n"));
      },
    );

    server.registerTool(
      "trek_voorstel_in",
      {
        description: "Sluit een voorstel en gooit het weg. De site verandert er niet door.",
        inputSchema: { tak: z.string().describe("de naam van het voorstel, zoals open_voorstellen die toont") },
        annotations: { title: "Trek een voorstel in", destructiveHint: true },
      },
      async ({ tak }: { tak: string }) => {
        const naam = String(tak).startsWith("voorstel/") ? String(tak) : `voorstel/${tak}`;
        await trekIn(naam);
        return tekst("Het voorstel is ingetrokken. Aan de site is niets veranderd.");
      },
    );
  },
  {
    serverInfo: { name: "human-margin-sitebeheer", version: "1.0.0" },
    // De regels komen uit AGENTS.md; er staat geen tweede kopie in deze code (AC-S0).
    instructions: serverinstructies(),
    capabilities: { tools: { listChanged: true } },
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

/*
 * Toegang. Twee wegen naar binnen, en geen derde:
 * 1. een token dat wij hebben uitgegeven na een GitHub-login (AC-T2);
 * 2. het testtoken, dat alleen buiten productie bestaat (AC-T5).
 */
const controleer = async (request: Request, token?: string) => {
  // De reden van een 401 hoort te kloppen: "geen token" is iets anders dan "verlopen".
  const bron = mcpAdres(publiekeBasis(request));
  if (isTesttoken(token)) {
    return { token: token as string, scopes: ["site:lezen", "site:voorstellen", "site:publiceren"], clientId: "controlereeks", extra: { gebruiker: "controlereeks" } };
  }
  const oordeel = leesToken(token, bron);
  if (!oordeel.geldig) return undefined;
  return {
    token: token as string,
    scopes: ["site:lezen", "site:voorstellen", "site:publiceren"],
    clientId: oordeel.inhoud.gebruiker,
    extra: { gebruiker: oordeel.inhoud.gebruiker },
  };
};

const beveiligd = withMcpAuth(handler, controleer, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

/**
 * Vóór de toegangscontrole: niet te snel achter elkaar (AC-V6). Dertig aanroepen per minuut per
 * token is ruim voor iemand die zijn site aanpast; daarboven is het een lus of een poging.
 */
async function metRem(request: Request): Promise<Response> {
  const token = request.headers.get("authorization") ?? "anoniem";
  const oordeel = tempoControle(token);
  if (!oordeel.mag) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32029, message: `Even rustig aan: probeer het over ${oordeel.wachtSeconden} seconden opnieuw.` }, id: null },
      { status: 429, headers: { "retry-after": String(oordeel.wachtSeconden) } },
    );
  }
  /*
   * Een 401 hoort te zeggen wat er aan de hand is. De standaardtekst is altijd "No authorization
   * provided", ook bij een verlopen token — en dan zoekt Els in de verkeerde hoek.
   */
  const kop = request.headers.get("authorization");
  if (kop && !isTesttoken(kop.replace(/^Bearer /i, ""))) {
    const oordeel = leesToken(kop.replace(/^Bearer /i, ""), mcpAdres(publiekeBasis(request)));
    if (!oordeel.geldig) {
      const uitleg =
        oordeel.reden === "token is verlopen"
          ? "Je aanmelding is verlopen. Log opnieuw in vanuit ChatGPT."
          : oordeel.reden === "deze gebruiker staat niet meer op de lijst"
            ? "Dit account mag deze site niet meer beheren."
            : "Deze aanmelding klopt niet. Log opnieuw in vanuit ChatGPT.";
      return Response.json(
        { error: "invalid_token", error_description: uitleg },
        {
          status: 401,
          headers: {
            "www-authenticate": `Bearer error="invalid_token", error_description="${uitleg}", resource_metadata="${publiekeBasis(request)}/.well-known/oauth-protected-resource"`,
          },
        },
      );
    }
  }

  return beveiligd(request);
}

export { metRem as GET, metRem as POST, metRem as DELETE };
