import "server-only";
import { pagina as paginaSchema } from "@/lib/schema";
import * as gh from "@/lib/koppeling/github";
// De grenzen staan in één los bestand, zodat de controlereeks precies deze regels test
// en niet een nagebouwde versie ervan (qa/koppeling-unit.mjs).
import { MAX_OPEN_VOORSTELLEN as MAX, veiligPad as padGrens, veiligeSlug as slugGrens, vervangInTekst } from "@/lib/koppeling/paden.mjs";

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
export const VOORSTEL_VOORVOEGSEL = "voorstel/";
const VOORSTEL = VOORSTEL_VOORVOEGSEL;

/** Alleen deze twee mappen mogen door de koppeling geraakt worden (AC-V2). */
/**
 * Een schemafout omzetten naar iets wat Els snapt: geen bestandsnaam, geen veldpad, geen Engels.
 * AGENTS.md § "Voor de ChatGPT-koppeling" zegt: nooit een foutcode, nooit een pad.
 */
function inGewoneTaal(fout: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const woord: Record<string, string> = {
    titel: "de titel in de browser",
    beschrijving: "de beschrijving",
    kop: "de kop",
    tekst: "de tekst",
    alt: "de beschrijving van de foto",
    items: "de lijst",
    doel: "waar de knop naartoe gaat",
    beeld: "de foto",
    type: "het soort onderdeel",
    slug: "het adres van de pagina",
  };
  const regels = fout.issues.slice(0, 3).map((i) => {
    const veld = [...i.path].reverse().find((d) => typeof d === "string" && woord[d as string]);
    const naam = veld ? woord[veld as string] : "een van de velden";
    return `${naam}: ${i.message.replace(/^Ongeldige invoer$/, "dit soort onderdeel ken ik niet")}`;
  });
  return `Dit kan zo niet: ${regels.join(" · ")}`;
}

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

// Lokale datum, niet UTC: om half één 's nachts heette een voorstel anders nog gisteren.
const vandaag = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Elke verwijzing naar een beeld moet bestaan (gevonden door de beta-tester, 22-09).
 *
 * Het paginaschema kent alleen de vorm van een pagina, niet de rest van de site. Een pagina met
 * `beeld: "bestaat-niet"` komt daar dus doorheen — en `next build` valt er vervolgens over, want de
 * kruisverwijzingen worden pas bij de bouw gelegd. Gevolg voor Els: geen voorbeeldlink, en een tool
 * die blijft zeggen "de link komt eraan". Daarom kijken we hier zelf.
 */
function beeldenIn(waarde: unknown, uit: Set<string> = new Set()): Set<string> {
  if (Array.isArray(waarde)) for (const w of waarde) beeldenIn(w, uit);
  else if (waarde && typeof waarde === "object") {
    for (const [naam, w] of Object.entries(waarde as Record<string, unknown>)) {
      if ((naam === "beeld" || naam === "zijbeeld") && typeof w === "string") uit.add(w);
      else beeldenIn(w, uit);
    }
  }
  return uit;
}

async function controleerBeelden(pagina: unknown, tak: string, extra: string[] = []) {
  const gevraagd = [...beeldenIn(pagina)];
  if (gevraagd.length === 0) return;
  const manifest = await gh.leesBestand(veiligPad("content/media.json"), tak);
  const bekend = new Set(extra);
  if (manifest) for (const b of (JSON.parse(manifest.tekst) as { beelden?: { id: string }[] }).beelden ?? []) bekend.add(b.id);
  const onbekend = gevraagd.filter((id) => !bekend.has(id));
  if (onbekend.length > 0) {
    throw new Error(
      `Deze foto${onbekend.length > 1 ? "'s ken" : " ken"} ik niet: ${onbekend.join(", ")}. Voeg de foto eerst toe, of kies er een die er al is: ${[...bekend].slice(0, 8).join(", ")}.`,
    );
  }
}

export type Voorstel = { tak: string; commit: string; samenvatting: string; link: string | null };

/**
 * De tak voor een voorstel. Bestaat er al een voorstel van vandaag voor deze pagina met precies
 * dezelfde inhoud, dan is dat hetzelfde voorstel en krijg je die tak terug — ChatGPT herhaalt een
 * aanroep bij een tijdslimiet gewoon, en anders loopt de grens van vijf zo vol met dubbelen.
 */
async function startTak(slug: string, pad: string, inhoud: string): Promise<{ tak: string; bestond: boolean }> {
  const basis = gh.publicatietak();
  const hash = await gh.hashVanTak(basis);
  if (!hash) throw new Error(`Er valt nog niets te wijzigen: de site staat nog niet klaar.`);
  const bestaande = new Set(await gh.takken());

  let tak = `${VOORSTEL}${vandaag()}-${slug}`;
  let n = 2;
  while (bestaande.has(tak)) {
    const alDaar = await gh.leesBestand(pad, tak);
    if (alDaar && alDaar.tekst === inhoud) return { tak, bestond: true };
    tak = `${VOORSTEL}${vandaag()}-${slug}-${n++}`;
  }
  await gh.maakTak(tak, hash);
  return { tak, bestond: false };
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
    inhoud = vervangInTekst(inhoud, zoek, vervang, teller);
    if (zoek === vervang) throw new Error("De oude en de nieuwe tekst zijn hetzelfde; er valt zo niets te veranderen.");
    if (teller.n === 0) throw new Error(`Deze tekst staat niet op de pagina "${slug}": "${zoek.slice(0, 60)}".`);
    regels.push(`was: ${zoek.slice(0, 120)}\nwordt: ${vervang.slice(0, 120)}`);
  }

  const gekeurd = paginaSchema.safeParse(inhoud);
  if (!gekeurd.success) throw new Error(inGewoneTaal(gekeurd.error));
  await controleerBeelden(gekeurd.data, gh.publicatietak());

  // Keuren doen we op wat het schema ervan maakt, schrijven op wat er stond. Het schema vult
  // tientallen standaardwaarden in (`logo: false`, `lijst: []`); zou je díé terugschrijven, dan
  // zwelt een bestand na één zinswijziging met twintig regels die Els nooit heeft gevraagd, en
  // wordt het verschil in de voorbeeldlink onleesbaar.
  const nieuweInhoud = `${JSON.stringify(inhoud, null, 2)}\n`;
  const { tak, bestond } = await startTak(slug, pad, nieuweInhoud);
  const commit = bestond ? "" : await gh.schrijfBestand(pad, nieuweInhoud, tak, `${slug}: tekst gewijzigd${toelichting ? ` (${toelichting})` : ""}`);
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
  if (!gekeurd.success) throw new Error(inGewoneTaal(gekeurd.error));
  await controleerBeelden(gekeurd.data, gh.publicatietak());

  const pad = veiligPad(`content/paginas/${slug}.json`);
  // Om dezelfde reden: een nieuwe pagina komt er zo uit te zien als de pagina's die met de hand
  // geschreven zijn, niet als een schema-afdruk.
  const nieuweInhoud = `${JSON.stringify(nieuw, null, 2)}\n`;
  const { tak, bestond } = await startTak(slug, pad, nieuweInhoud);
  const commit = bestond ? "" : await gh.schrijfBestand(pad, nieuweInhoud, tak, `nieuwe pagina: ${slug}`);
  const link = await wachtOpLink(tak);
  const aantal = (gekeurd.data.secties[0] as { bouwstenen?: unknown[] }).bouwstenen?.length ?? 0;
  return { tak, commit, samenvatting: `Nieuwe pagina "${velden.titel}" op /${slug}/ met ${aantal} ${aantal === 1 ? "onderdeel" : "onderdelen"}.`, link };
}

export async function trekIn(tak: string): Promise<void> {
  const naam = String(tak ?? "").trim();
  if (!naam.startsWith(VOORSTEL)) throw new Error("Dat is geen voorstel dat ik kan intrekken.");
  if (!/^voorstel\/[a-z0-9-]{4,80}$/.test(naam)) throw new Error("Die naam ken ik niet.");
  // Eerst kijken of hij bestaat: anders meldt de tool opgewekt "ingetrokken" voor iets wat er
  // nooit was, en denkt Els dat ze klaar is.
  const open = await openVoorstellen();
  if (!open.includes(naam)) {
    throw new Error(`Dat voorstel ken ik niet. ${open.length ? `Open voorstellen: ${open.map((t) => t.slice(VOORSTEL.length)).join(", ")}.` : "Er staan geen voorstellen open."}`);
  }
  await gh.verwijderTak(naam);
}
