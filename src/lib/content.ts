import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  beschrijfFout,
  kantlijn as kantlijnSchema,
  media as mediaSchema,
  pagina as paginaSchema,
  site as siteSchema,
  type Kantlijn,
  type Media,
  type Pagina,
  type Site,
} from "./schema";
import type { z } from "zod";

/*
 * Leest de content bij de bouw. Elk bestand gaat door het schema; is het ongeldig, dan faalt
 * `next build` met het bestand en het veld in de melding (PRD-001 F1, AC-V3 van PRD-002).
 */
const CONTENT = join(process.cwd(), "content");

function lees<T>(relPad: string, schema: z.ZodType<T>): T {
  const pad = join(CONTENT, relPad);
  let ruw: unknown;
  try {
    ruw = JSON.parse(readFileSync(pad, "utf8"));
  } catch (e) {
    throw new Error(`content/${relPad} is geen geldige JSON: ${(e as Error).message}`);
  }
  const uitkomst = schema.safeParse(ruw);
  if (!uitkomst.success) throw new Error(`Ongeldige content:\n${beschrijfFout(`content/${relPad}`, uitkomst.error)}`);
  return uitkomst.data;
}

let cache: { site: Site; kantlijn: Kantlijn; media: Media; paginas: Pagina[] } | null = null;

function laad() {
  if (cache) return cache;
  const site = lees("site.json", siteSchema);
  const kantlijn = lees("kantlijn.json", kantlijnSchema);
  const media = lees("media.json", mediaSchema);
  const paginas = readdirSync(join(CONTENT, "paginas"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const p = lees(`paginas/${f}`, paginaSchema);
      if (`${p.slug}.json` !== f) throw new Error(`content/paginas/${f}: de slug "${p.slug}" moet gelijk zijn aan de bestandsnaam.`);
      return p;
    });

  // Verwijzingen controleren: elk beeld bestaat, elke notitie/markering wijst naar een bestaande sectie.
  const beeldIds = new Set(media.beelden.map((b) => b.id));
  const fouten: string[] = [];
  const beeldenIn = (p: Pagina): string[] => {
    const ids: string[] = [];
    if (p.ogBeeld) ids.push(p.ogBeeld);
    for (const s of p.secties) {
      if ("beeld" in s && s.beeld) ids.push(s.beeld);
      if (s.type === "aanbod-deel" && s.inzet) ids.push(s.inzet);
      if (s.type === "verwijzingen") s.blokken.forEach((b) => ids.push(b.beeld));
      const stenen = s.type === "tekst" ? s.bouwstenen : s.type === "panelen" ? s.naschrift : [];
      stenen.forEach((b) => b.type === "foto" && ids.push(b.beeld));
    }
    return ids;
  };
  for (const p of paginas) for (const id of beeldenIn(p)) if (!beeldIds.has(id)) fouten.push(`content/paginas/${p.slug}.json: beeld "${id}" staat niet in content/media.json`);
  if (!beeldIds.has(site.nietGevonden.beeld)) fouten.push(`content/site.json → nietGevonden.beeld: "${site.nietGevonden.beeld}" staat niet in content/media.json`);
  const secties = new Set(paginas.flatMap((p) => p.secties.map((s) => `${p.slug}/${s.id}`)));
  kantlijn.notities.forEach((n, i) => !secties.has(`${n.pagina}/${n.sectie}`) && fouten.push(`content/kantlijn.json → notities.${i}: sectie "${n.pagina}/${n.sectie}" bestaat niet`));
  kantlijn.markeringen.forEach((m, i) => !secties.has(`${m.pagina}/${m.sectie}`) && fouten.push(`content/kantlijn.json → markeringen.${i}: sectie "${m.pagina}/${m.sectie}" bestaat niet`));
  if (fouten.length) throw new Error(`Ongeldige content:\n${fouten.join("\n")}`);

  cache = { site, kantlijn, media, paginas };
  return cache;
}

export const leesSite = () => laad().site;
export const leesKantlijn = () => laad().kantlijn;
export const leesMedia = () => laad().media;

/** Pagina's die aan staan (een pagina met een schakelaar die uit staat, bestaat niet). */
export function leesPaginas(): Pagina[] {
  const { site, paginas } = laad();
  return paginas.filter((p) => !p.schakelaar || site.schakelaars[p.schakelaar as keyof Site["schakelaars"]] === true);
}

export function leesPagina(slug: string): Pagina | undefined {
  return leesPaginas().find((p) => p.slug === slug);
}

export function beeld(id: string) {
  const b = laad().media.beelden.find((x) => x.id === id);
  if (!b) throw new Error(`Beeld "${id}" niet gevonden`);
  return b;
}

/** De navigatie zonder items waarvan de schakelaar uit staat — zodat die tekst nergens in de HTML komt. */
export function leesNavigatie() {
  const site = leesSite();
  return site.navigatie.filter((n) => !n.schakelaar || site.schakelaars[n.schakelaar as keyof Site["schakelaars"]] === true).map(({ label, pad }) => ({ label, pad }));
}

export function notitiesVoor(pagina: string, sectie: string) {
  const { site, kantlijn } = laad();
  if (!site.schakelaars.kantlijn) return [];
  return kantlijn.notities.filter((n) => n.pagina === pagina && n.sectie === sectie);
}

export function markeringenVoor(pagina: string, sectie: string) {
  const { site, kantlijn } = laad();
  if (!site.schakelaars.kantlijn) return [];
  return kantlijn.markeringen.filter((m) => m.pagina === pagina && m.sectie === sectie);
}

export const paginaPad = (slug: string) => (slug === "home" ? "/" : `/${slug}/`);
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://humanmargin.eu";
export const isVoorbeeld = () => process.env.NEXT_PUBLIC_DEMO === "1";
