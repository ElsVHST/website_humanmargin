import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * De regels die ChatGPT meekrijgt bij het verbinden (AC-S0, V25).
 *
 * Er is één bron: `AGENTS.md` in deze repo. Die tekst wordt hier uitgesneden, niet overgetypt —
 * een tweede kopie in de code zou binnen een maand iets anders zeggen dan de eerste. Wordt
 * AGENTS.md gewijzigd, dan heeft de volgende bouw de nieuwe regels.
 */

/*
 * Wat ChatGPT meekrijgt is niet hetzelfde als wat een bouwer meekrijgt. De beta-tester merkte op
 * 22-09 terecht op dat de oude selectie over git, gitleaks en .tsx-bestanden ging — instructies
 * voor iemand die code schrijft, terwijl dit de klant is die haar tekst aanpast. Daarom heeft de
 * koppeling een eigen sectie in AGENTS.md; de merkregels gaan mee omdat die over de inhoud gaan.
 */
const KOPPEN = ["## Voor de ChatGPT-koppeling", "## De merkregels (brandbook)"];

let gelezen: string | null = null;

export function serverinstructies(): string {
  if (gelezen !== null) return gelezen;
  let bron = "";
  for (const pad of [join(process.cwd(), "AGENTS.md"), join(process.cwd(), "..", "AGENTS.md")]) {
    try {
      bron = readFileSync(pad, "utf8");
      break;
    } catch {
      /* volgende pad */
    }
  }
  if (!bron) {
    gelezen = "";
    return gelezen;
  }

  const delen: string[] = [];
  for (const kop of KOPPEN) {
    const begin = bron.indexOf(kop);
    if (begin === -1) continue;
    const rest = bron.slice(begin + kop.length);
    const eind = rest.indexOf("\n## ");
    delen.push((kop + (eind === -1 ? rest : rest.slice(0, eind))).trim());
  }
  gelezen = delen.join("\n\n");
  return gelezen;
}
