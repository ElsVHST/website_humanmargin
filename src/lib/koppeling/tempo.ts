import "server-only";
import { createHash } from "node:crypto";

/*
 * Een eenvoudige snelheidsbegrenzing (AC-V6, tweede helft).
 *
 * Hoogstens 30 aanroepen per minuut per gebruiker. Meer dan dat is geen mens die zijn site
 * aanpast; het is een vergissing in een lus of iemand die aan het proberen is.
 *
 * De telling zit in het geheugen van dit proces. Op Vercel draaien er soms meerdere naast elkaar,
 * dus dit is een rem, geen slot: bij een echte aanval helpt alleen de toegangslijst. Voor waar het
 * voor bedoeld is — een lus die op hol slaat — is het genoeg, en het kost geen database.
 */

const PER_MINUUT = Number(process.env.KOPPELING_MAX_PER_MINUUT ?? 30);
const VENSTER_MS = 60_000;

const tellers = new Map<string, number[]>();

export type Tempo = { mag: true } | { mag: false; wachtSeconden: number };

export function tempoControle(sleutelRuw: string): Tempo {
  // Nooit het token zelf als sleutel bewaren; een hash is genoeg om te tellen.
  const sleutel = createHash("sha256").update(sleutelRuw).digest("hex").slice(0, 16);
  const nu = Date.now();
  const tijden = (tellers.get(sleutel) ?? []).filter((t) => nu - t < VENSTER_MS);

  if (tijden.length >= PER_MINUUT) {
    tellers.set(sleutel, tijden);
    return { mag: false, wachtSeconden: Math.max(1, Math.ceil((VENSTER_MS - (nu - tijden[0])) / 1000)) };
  }
  tijden.push(nu);
  tellers.set(sleutel, tijden);

  // Oude sleutels opruimen, zodat deze kaart niet ongemerkt volloopt.
  if (tellers.size > 500) {
    for (const [k, v] of tellers) if (v.every((t) => nu - t >= VENSTER_MS)) tellers.delete(k);
  }
  return { mag: true };
}
