import "server-only";
import { paginaPad, siteUrl } from "@/lib/content";
import { pagina as paginaSchema, site as siteSchema, type Pagina, type Sectie, type Bouwsteen } from "@/lib/schema";
import * as gh from "@/lib/koppeling/github";
import { veiligPad } from "@/lib/koppeling/voorstellen";

/*
 * Lezen (AC-S1). Els krijgt gewone tekst terug, geen JSON: ze moet kunnen zien wat er staat en
 * hoe ze ernaar kan verwijzen, zonder iets van de opbouw te snappen.
 *
 * Belangrijk: dit leest de **publicatietak**, niet de bestanden van de draaiende bouw. Die twee
 * lopen uiteen zodra er iets gepubliceerd is en de site nog niet herbouwd — en dan toont de tool
 * een zin die ze vervolgens "niet kan vinden" als je hem wilt wijzigen. Gevonden door de
 * beta-tester, ronde 2.
 */

async function leesPaginaVanTak(slug: string): Promise<Pagina | undefined> {
  const bestand = await gh.leesBestand(veiligPad(`content/paginas/${slug}.json`), gh.publicatietak());
  if (!bestand) return undefined;
  const gekeurd = paginaSchema.safeParse(JSON.parse(bestand.tekst));
  return gekeurd.success ? gekeurd.data : undefined;
}

async function slugsVanTak(): Promise<string[]> {
  const namen = await gh.lijstMap("content/paginas", gh.publicatietak());
  return namen.filter((n) => n.endsWith(".json")).map((n) => n.replace(/\.json$/, ""));
}

/** Het adres waar de gepubliceerde versie te zien is (de "demo" in PRD-002 §5.1). */
export function publicatieAdres(): string {
  return (process.env.PUBLICATIE_URL ?? siteUrl()).replace(/\/$/, "");
}

function tekstUitBouwsteen(b: Bouwsteen): string[] {
  switch (b.type) {
    case "kop":
      return [`  [kop] ${b.tekst}`];
    case "alinea":
      return [`  ${b.tekst}`];
    case "citaat":
      return [`  "${b.tekst}"`];
    case "lijst":
      return b.items.map((i) => `  – ${i}`);
    case "knop":
      return [`  [knop] ${b.tekst} → ${b.doel}`];
    case "foto":
      return [`  [foto] ${b.beeld}`];
    default:
      return [];
  }
}

function tekstUitSectie(s: Sectie): string[] {
  const regels: string[] = [`\n[${s.id}]`];
  const alles = s as unknown as Record<string, unknown>;
  for (const veld of ["label", "kop", "inleiding", "slot", "tekst"]) {
    const w = alles[veld];
    if (typeof w === "string" && w.trim()) regels.push(`  ${veld}: ${w}`);
  }
  if (Array.isArray(alles.bouwstenen)) for (const b of alles.bouwstenen as Bouwsteen[]) regels.push(...tekstUitBouwsteen(b));
  // De overige lijsten (vragen, panelen, delen, punten) hebben elk hun eigen velden; die laten we
  // zien zoals ze heten, zodat Els kan zeggen "verander de prijs van de nulmeting".
  for (const [naam, waarde] of Object.entries(alles)) {
    if (["id", "type", "achtergrond", "bouwstenen", "label", "kop", "inleiding", "slot", "tekst"].includes(naam)) continue;
    if (!Array.isArray(waarde)) continue;
    for (const item of waarde as unknown[]) {
      if (typeof item === "string") regels.push(`  – ${item}`);
      else if (item && typeof item === "object") {
        const velden = Object.entries(item as Record<string, unknown>)
          .filter(([, w]) => typeof w === "string" || typeof w === "number")
          .map(([k, w]) => `${k}: ${w}`);
        if (velden.length) regels.push(`  – ${velden.join(" · ")}`);
      }
    }
  }
  return regels;
}

/** De kop van een pagina: bovenaan, anders die van de eerste sectie, anders de titel. */
function kopVan(p: Pagina): string {
  const eigen = (p as unknown as { kop?: string }).kop;
  if (eigen) return eigen;
  for (const s of p.secties) {
    const k = (s as unknown as { kop?: string }).kop;
    if (k) return k;
  }
  return p.titel.split("|")[0].trim();
}

export async function siteOverzicht(): Promise<string> {
  const siteBestand = await gh.leesBestand(veiligPad("content/site.json"), gh.publicatietak());
  const site = siteBestand ? siteSchema.parse(JSON.parse(siteBestand.tekst)) : null;
  const slugs = await slugsVanTak();
  const paginas = (await Promise.all(slugs.map((s) => leesPaginaVanTak(s)))).filter((p): p is Pagina => Boolean(p));
  const regels = [
    `De site van ${site?.naam ?? "Human Margin"}. Gepubliceerd te zien op: ${publicatieAdres()}`,
    "",
    `${paginas.length} pagina's:`,
    ...paginas.map((p) => `- ${p.slug} (${paginaPad(p.slug)}) — ${kopVan(p)}; secties: ${p.secties.map((s) => s.id).join(", ")}`),
    "",
    "Wat je kunt wijzigen: alle tekst, prijzen en lijsten op deze pagina's, plus foto's.",
    "Wat niet: de opmaak, de kleuren en de opbouw van de site.",
    "",
    'Vraag "bekijk pagina <naam>" om te zien wat er op een pagina staat.',
  ];
  return regels.join("\n");
}

export async function paginaOverzicht(slug: string): Promise<string> {
  const p = await leesPaginaVanTak(slug);
  if (!p) {
    const namen = (await slugsVanTak()).join(", ");
    return `Die pagina ken ik niet. Dit zijn de pagina's: ${namen}.`;
  }
  return [`Pagina "${p.slug}" — ${kopVan(p)}`, `Adres: ${paginaPad(p.slug)}`, `Titel in de browser: ${p.titel}`, `Beschrijving: ${p.beschrijving}`, ...p.secties.flatMap(tekstUitSectie)].join("\n");
}
