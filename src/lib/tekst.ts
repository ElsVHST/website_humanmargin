import type { CSSProperties } from "react";

/** Aantal tekens van het langste woord; de CSS houdt de kop daarmee binnen de schermbreedte. */
export function langsteWoord(tekst: string): number {
  return Math.max(4, ...tekst.split(/\s+/).map((w) => w.length));
}

export function kopStijl(tekst: string): CSSProperties {
  return { "--langste-woord": langsteWoord(tekst) } as CSSProperties;
}

const euro = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });

/** "Vanaf € 997", "€ 1.399 per maand", "Kaarten vanaf € 1.150 voor 10 sessies". */
export function prijsTekst(p: { vanaf: boolean; bedrag: number; eenheid?: string; voor?: string }): string {
  const delen: string[] = [];
  if (p.voor) delen.push(p.voor);
  if (p.vanaf) delen.push(p.voor ? "vanaf" : "Vanaf");
  delen.push(`€ ${euro.format(p.bedrag)}`);
  if (p.eenheid) delen.push(p.eenheid);
  return delen.join(" ");
}

/** Verdeelt een kop in letters voor hero-motion, op de server: dan speelt de intro zonder flits. */
export function letters(tekst: string): { woorden: { tekens: { teken: string; vertraging: number }[] }[]; spaties: number[] } {
  const woorden = tekst.trim().split(/\s+/);
  const aantal = woorden.join("").length;
  // Alle letters staan binnen 1,5 s stil (AC-B2): 0,9 s animatie + hoogstens 0,5 s spreiding.
  const stap = Math.min(0.028, 0.5 / Math.max(1, aantal));
  let n = 0;
  const spaties: number[] = [];
  const uit = woorden.map((w, i) => {
    if (i > 0) spaties.push(Number((n * stap).toFixed(3)));
    return {
      tekens: Array.from(w).map((teken) => {
        n += 1;
        return { teken, vertraging: Number((n * stap).toFixed(3)) };
      }),
    };
  });
  return { woorden: uit, spaties };
}
