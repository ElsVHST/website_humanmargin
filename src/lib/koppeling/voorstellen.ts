import "server-only";
import { pagina as paginaSchema, beschrijfFout } from "@/lib/schema";
import * as gh from "@/lib/koppeling/github";
// De grenzen staan in één los bestand, zodat de controlereeks precies deze regels test
// en niet een nagebouwde versie ervan (qa/koppeling-unit.mjs).
import { MAX_OPEN_VOORSTELLEN as MAX, veiligPad as padGrens, veiligeSlug as slugGrens } from "@/lib/koppeling/paden.mjs";

/*
 * Voorstellen (AC-S2, AC-S3, AC-V1 t/m AC-V4, AC-V6).
 *
 * Els zegt wat er moet veranderen; hier wordt daar een tak met een commit van gemaakt, en niets
 * meer dan dat. Publiceren is een aparte stap, met een aparte vraag.
 *
 * Alles wat binnenkomt is invoer, ook als het van ChatGPT komt: elk pad wordt gecontroleerd, elke
 * slug tegen een patroon gelegd, en elke wijziging langs het contentschema. Een voorstel dat het
 * schema breekt komt er niet in, en kan dus ook nooit gepubliceerd worden.
 */

export const MAX_OPEN_VOORSTELLEN = MAX;
const VOORSTEL = "voorstel/";

/** Alleen deze twee mappen mogen door de koppeling geraakt worden (AC-V2). */
export const veiligPad = (pad: string): string => padGrens(pad);
export const veiligeSlug = (slug: string): string => slugGrens(slug);

export async function openVoorstellen(): Promise<string[]> {
  return (await gh.takken()).filter((t) => t.startsWith(VOORSTEL));
}

async function controleerRuimte() {
  const open = await openVoorstellen();
  if (open.length >= MAX_OPEN_VOORSTELLEN) {
    throw new Error(
      `Er staan al ${open.length} voorstellen open. Publiceer er eerst een, of trek er een in.\n` + open.map((t) => `- ${t.slice(VOORSTEL.length)}`).join("\n"),
    );
  }
}

const vandaag = () => new Date().toISOString().slice(0, 10);

/** Vervangt tekst in elk tekstveld van een object, en telt hoe vaak dat lukte. */
function vervangDiep(waarde: unknown, zoek: string, vervang: string, teller: { n: number }): unknown {
  if (typeof waarde === "string") {
    if (waarde.includes(zoek)) {
      teller.n++;
      return waarde.split(zoek).join(vervang);
    }
    return waarde;
  }
  if (Array.isArray(waarde)) return waarde.map((w) => vervangDiep(w, zoek, vervang, teller));
  if (waarde && typeof waarde === "object") {
    const uit: Record<string, unknown> = {};
    for (const [k, w] of Object.entries(waarde as Record<string, unknown>)) uit[k] = vervangDiep(w, zoek, vervang, teller);
    return uit;
  }
  return waarde;
}

export type Voorstel = { tak: string; commit: string; samenvatting: string; link: string | null };

async function startTak(slug: string): Promise<string> {
  const basis = gh.publicatietak();
  const hash = await gh.hashVanTak(basis);
  if (!hash) throw new Error(`De tak ${basis} bestaat nog niet; er valt nog niets te wijzigen.`);
  let tak = `${VOORSTEL}${vandaag()}-${slug}`;
  const bestaande = new Set(await gh.takken());
  let n = 2;
  while (bestaande.has(tak)) tak = `${VOORSTEL}${vandaag()}-${slug}-${n++}`;
  await gh.maakTak(tak, hash);
  return tak;
}

/** Wacht kort op de voorbeeldlink; duurt het langer, dan zegt de tool dat (AC-S2). */
async function wachtOpLink(tak: string, maxMs = 90000): Promise<string | null> {
  const eind = Date.now() + maxMs;
  while (Date.now() < eind) {
    const link = await gh.voorbeeldlink(tak);
    if (link) return link;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

export async function wijzigTekst(slugRuw: string, wijzigingen: { zoek: string; vervang: string }[], toelichting?: string): Promise<Voorstel> {
  const slug = veiligeSlug(slugRuw);
  if (!Array.isArray(wijzigingen) || wijzigingen.length === 0) throw new Error("Ik heb niet begrepen wat er moet veranderen.");
  await controleerRuimte();

  const pad = veiligPad(`content/paginas/${slug}.json`);
  const huidig = await gh.leesBestand(pad, gh.publicatietak());
  if (!huidig) throw new Error(`De pagina "${slug}" bestaat niet.`);

  let inhoud: unknown = JSON.parse(huidig.tekst);
  const regels: string[] = [];
  for (const w of wijzigingen) {
    const zoek = String(w?.zoek ?? "");
    const vervang = String(w?.vervang ?? "");
    if (!zoek) throw new Error("Ik weet niet welke tekst ik moet vervangen.");
    const teller = { n: 0 };
    inhoud = vervangDiep(inhoud, zoek, vervang, teller);
    if (teller.n === 0) throw new Error(`Deze tekst staat niet op de pagina "${slug}": "${zoek.slice(0, 60)}".`);
    regels.push(`was: ${zoek.slice(0, 120)}\nwordt: ${vervang.slice(0, 120)}`);
  }

  const gekeurd = paginaSchema.safeParse(inhoud);
  if (!gekeurd.success) throw new Error(`Dit kan niet: ${beschrijfFout(`${slug}.json`, gekeurd.error)}`);

  const tak = await startTak(slug);
  const commit = await gh.schrijfBestand(pad, `${JSON.stringify(gekeurd.data, null, 2)}\n`, tak, `${slug}: tekst gewijzigd${toelichting ? ` (${toelichting})` : ""}`);
  const link = await wachtOpLink(tak);
  return { tak, commit, samenvatting: regels.join("\n\n"), link };
}

export async function nieuwePagina(velden: { slug: string; titel: string; kop: string; beschrijving?: string; bouwstenen: unknown[] }): Promise<Voorstel> {
  const slug = veiligeSlug(velden.slug);
  await controleerRuimte();

  const bestaat = await gh.leesBestand(veiligPad(`content/paginas/${slug}.json`), gh.publicatietak());
  if (bestaat) throw new Error(`Er is al een pagina "${slug}".`);

  const nieuw = {
    slug,
    titel: velden.titel,
    beschrijving: velden.beschrijving ?? velden.kop,
    kop: velden.kop,
    secties: [{ id: "inhoud", type: "tekst", achtergrond: "licht", bouwstenen: velden.bouwstenen ?? [] }],
  };
  const gekeurd = paginaSchema.safeParse(nieuw);
  if (!gekeurd.success) throw new Error(`Dit kan niet: ${beschrijfFout(`${slug}.json`, gekeurd.error)}`);

  const tak = await startTak(slug);
  const pad = veiligPad(`content/paginas/${slug}.json`);
  const commit = await gh.schrijfBestand(pad, `${JSON.stringify(gekeurd.data, null, 2)}\n`, tak, `nieuwe pagina: ${slug}`);
  const link = await wachtOpLink(tak);
  const aantal = (gekeurd.data.secties[0] as { bouwstenen?: unknown[] }).bouwstenen?.length ?? 0;
  return { tak, commit, samenvatting: `Nieuwe pagina "${velden.titel}" op /${slug}/ met ${aantal} onderdelen.`, link };
}

export async function trekIn(tak: string): Promise<void> {
  const naam = String(tak ?? "").trim();
  if (!naam.startsWith(VOORSTEL)) throw new Error("Dat is geen voorstel dat ik kan intrekken.");
  if (!/^voorstel\/[a-z0-9-]{4,80}$/.test(naam)) throw new Error("Die naam ken ik niet.");
  await gh.verwijderTak(naam);
}
