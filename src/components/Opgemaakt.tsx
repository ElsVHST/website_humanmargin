import { Fragment, type ReactNode } from "react";
import type { Kantlijn } from "@/lib/schema";

type Markering = Kantlijn["markeringen"][number];

/**
 * Toont tekst uit de content, met de markeringen uit kantlijn.json (markeerstift of doorhaling).
 * De tekst blijft data: React schrijft hem als tekst, nooit als HTML (PRD-002 AC-V4).
 */
export function Opgemaakt({ tekst, markeringen = [] }: { tekst: string; markeringen?: Markering[] }): ReactNode {
  const stukken: { van: number; tot: number; m: Markering }[] = [];
  for (const m of markeringen) {
    const i = tekst.indexOf(m.tekst);
    if (i >= 0 && !stukken.some((s) => i < s.tot && i + m.tekst.length > s.van)) stukken.push({ van: i, tot: i + m.tekst.length, m });
  }
  if (!stukken.length) return tekst;
  stukken.sort((a, b) => a.van - b.van);
  const uit: ReactNode[] = [];
  let plek = 0;
  stukken.forEach((s, n) => {
    if (s.van > plek) uit.push(<Fragment key={`t${n}`}>{tekst.slice(plek, s.van)}</Fragment>);
    const deel = tekst.slice(s.van, s.tot);
    if (s.m.stijl === "doorhaling") {
      uit.push(
        <s key={`m${n}`} className="doorhaling">
          {deel}
        </s>,
      );
    } else {
      const mark = (
        <mark className="markeer" data-markeer>
          {deel}
        </mark>
      );
      uit.push(
        s.m.omcirkeld ? (
          <span key={`m${n}`} className="omcirkeld">
            {mark}
          </span>
        ) : (
          <Fragment key={`m${n}`}>{mark}</Fragment>
        ),
      );
    }
    plek = s.tot;
  });
  if (plek < tekst.length) uit.push(<Fragment key="rest">{tekst.slice(plek)}</Fragment>);
  return uit;
}
