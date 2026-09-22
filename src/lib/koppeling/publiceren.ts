import "server-only";
import * as gh from "@/lib/koppeling/github";
import { openVoorstellen, veiligPad } from "@/lib/koppeling/voorstellen";

/*
 * Publiceren en terugdraaien (AC-S4, AC-S5, AC-V3).
 *
 * Publiceren is het samenvoegen van een voorstel met de publicatietak — en verder niets. Er gaat
 * alleen iets naar de tak uit `PUBLICATIETAK`; `main` wordt nooit geschreven (AC-V1, V33).
 *
 * Terugdraaien laat de geschiedenis staan: het zet de bestanden terug zoals ze vóór die publicatie
 * waren, als nieuwe commit. Zo is ook het terugdraaien zelf terug te draaien.
 */

export function publicatieAdres(): string {
  return (process.env.PUBLICATIE_URL ?? "").replace(/\/$/, "");
}

/** Publiceer een voorstel. Zonder tak: het enige openstaande voorstel, of een vraag welke. */
export async function publiceer(takRuw?: string): Promise<{ tak: string; commit: string; adres: string }> {
  const open = await openVoorstellen();
  let tak = String(takRuw ?? "").trim();
  if (tak && !tak.startsWith("voorstel/")) tak = `voorstel/${tak}`;
  if (!tak) {
    if (open.length === 0) throw new Error("Er staan geen voorstellen open om te publiceren.");
    if (open.length > 1) throw new Error(`Er staan ${open.length} voorstellen open. Welke bedoel je?\n${open.map((t) => `- ${t.slice(10)}`).join("\n")}`);
    tak = open[0];
  }
  if (!open.includes(tak)) throw new Error(`Dat voorstel ken ik niet (meer). Open voorstellen: ${open.map((t) => t.slice(10)).join(", ") || "geen"}.`);

  // Pas samenvoegen als de voorbeeldversie echt gebouwd is (AC-V3): geen link = geen publicatie.
  const link = await gh.voorbeeldlink(tak);
  if (!link) throw new Error("De voorbeeldversie is nog niet klaar. Wacht even tot de voorbeeldlink er is, en zeg dan opnieuw publiceer.");

  const commit = await gh.voegSamen(tak, gh.publicatietak(), `publiceert ${tak.slice(10)}`);
  await gh.verwijderTak(tak);
  return { tak, commit, adres: publicatieAdres() };
}

export type Publicatie = { sha: string; datum: string; boodschap: string };

export async function geschiedenis(hoeveel = 20): Promise<Publicatie[]> {
  return gh.commits(gh.publicatietak(), hoeveel);
}

/** Draai de laatste publicatie terug, of een publicatie naar keuze. */
export async function draaiTerug(shaRuw?: string): Promise<{ commit: string; teruggedraaid: string; adres: string }> {
  const lijst = await geschiedenis(30);
  if (lijst.length < 2) throw new Error("Er valt nog niets terug te draaien.");
  const sha = String(shaRuw ?? "").trim() || lijst.find((c) => !c.boodschap.startsWith("terugdraaien"))?.sha || lijst[0].sha;
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error("Die publicatie ken ik niet.");

  const details = await gh.commitDetails(sha);
  if (!details) throw new Error("Die publicatie kan ik niet vinden.");
  const ouder = details.ouders[0];
  if (!ouder) throw new Error("Van die publicatie is geen eerdere versie bekend.");

  const tak = gh.publicatietak();
  let laatste = "";
  const namen: string[] = [];
  for (const bestand of details.bestanden) {
    const pad = veiligPad(bestand);
    const vorige = await gh.leesBestand(pad, ouder);
    namen.push(pad.replace(/^content\/paginas\//, "").replace(/\.json$/, ""));
    laatste = vorige
      ? await gh.schrijfBestand(pad, vorige.tekst, tak, `terugdraaien van ${sha.slice(0, 7)}: ${pad}`)
      : await gh.verwijderBestand(pad, tak, `terugdraaien van ${sha.slice(0, 7)}: ${pad} weg`);
  }
  return { commit: laatste, teruggedraaid: namen.join(", "), adres: publicatieAdres() };
}
