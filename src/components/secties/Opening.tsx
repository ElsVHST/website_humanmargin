/* eslint-disable @next/next/no-img-element -- merk-SVG's: vaste, aangeleverde bestanden */
import { Fragment, type CSSProperties } from "react";
import type { Sectie } from "@/lib/schema";
import { notitiesVoor } from "@/lib/content";
import { kopStijl, letters } from "@/lib/tekst";
import { Beeld } from "../Beeld";
import { Knop } from "../Knop";
import { Notitie } from "../Notitie";

type Opening = Extract<Sectie, { type: "opening" }>;

/**
 * De opening van elke pagina: zwart of licht vlak, kop links (editorial, 7/5), foto rechts tot aan de
 * rand (off-center, dia 9). De foto is het grootste beeld van de pagina en krijgt als enige
 * fetchpriority="high" (AC-T6). Op de home en het manifest rijst de kop letter voor letter op
 * (hero-motion, AC-B2); de letters staan al in de HTML, dus er is geen flits en het werkt zonder JS.
 */
export function Opening({ sectie, pagina, beweging }: { sectie: Opening; pagina: string; beweging: boolean }) {
  const donker = (sectie.achtergrond ?? "licht") === "zwart";
  const notities = notitiesVoor(pagina, sectie.id);
  const notitie = notities.find((n) => n.plek === "foto");
  const kantlijnNotities = notities.filter((n) => n.plek === "kantlijn");
  const fade = beweging ? "" : undefined;
  // Vaste vertragingen in de HTML: hero-motion overschrijft een bestaande --d niet, dus geen sprong na hydratie.
  const d = (s: number) => (beweging ? ({ "--d": `${s}s` } as CSSProperties) : undefined);

  return (
    <section
      id={sectie.id}
      className={`sectie opening${donker ? " op-donker" : ""}`}
      data-achtergrond={sectie.achtergrond ?? "licht"}
      aria-labelledby={`${sectie.id}-kop`}
    >
      <div className="wrap" {...(beweging ? { "data-hero-stage": "" } : {})}>
        <div className="opening__raster">
          <div className="opening__tekst" {...(beweging ? { "data-hero-copy": "" } : {})}>
            <div className="opening__koppen">
              {sectie.logo && (
                <img
                  className="opening__logo"
                  src={donker ? "/merk/logo-omgekeerd.svg" : "/merk/logo-volledig.svg"}
                  alt="Human Margin®"
                  width={272}
                  height={132}
                  data-hero-fade={fade}
                  style={d(0.05)}
                />
              )}
              {sectie.kicker && (
                <span className="label opening__kicker" data-hero-fade={fade} style={d(0.1)}>
                  {sectie.kicker}
                </span>
              )}
              {beweging ? <LetterKop id={`${sectie.id}-kop`} tekst={sectie.kop} /> : (
                <h1 id={`${sectie.id}-kop`} className="kop-1" style={kopStijl(sectie.kop)}>
                  {sectie.kop}
                </h1>
              )}
            </div>
            {sectie.lead.length > 0 && (
              <div className="opening__lead lead" data-hero-fade={fade} style={d(0.55)}>
                {sectie.lead.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            )}
            {kantlijnNotities.length > 0 && (
              <div className="kantlijn opening__kantlijn" data-notitie-anker="">
                {kantlijnNotities.map((n) => (
                  <Notitie key={n.tekst} notitie={n} />
                ))}
              </div>
            )}
            {sectie.knoppen.length > 0 && (
              <div className="knoppen opening__knoppen" data-hero-fade={fade} style={d(0.7)}>
                {sectie.knoppen.map((k, i) => (
                  <Knop key={k.tekst} tekst={k.tekst} doel={k.doel} stijl={i === 0 ? "knop" : "tekst"} pijlen={i === 0 && !donker} sectie={sectie.id} />
                ))}
              </div>
            )}
          </div>
          <div className="opening__foto" {...(beweging ? { "data-hero-figure": "" } : {})} data-notitie-anker={notitie ? "" : undefined}>
            <img className="opening__kwast" src="/merk/getekend/kwast-verticaal.svg" alt="" width={42} height={148} />
            <Beeld id={sectie.beeld} sizes="(min-width: 52rem) 42vw, 100vw" prioriteit focus={sectie.beeldFocus} />
            {notitie && (
              <div className="opening__notitie">
                <Notitie notitie={notitie} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** h1 met de letters al gesplitst (hero-motion markup-contract: data-hero-ch + aria-label). */
function LetterKop({ id, tekst }: { id: string; tekst: string }) {
  const { woorden } = letters(tekst);
  return (
    <h1 id={id} className="kop-1" style={kopStijl(tekst)} data-hero-heading aria-label={tekst}>
      <span className="hm-line" data-hero-line aria-hidden="true">
        {woorden.map((w, i) => (
          <Fragment key={i}>
            {/* Een gewone spatie tussen de woorden: aan het eind van een regel valt hij weg, dus geen inspringing. */}
            {i > 0 && " "}
            <span className="hm-word">
              {w.tekens.map((t, j) => (
                <span key={j} className="hm-ch" data-hero-ch style={{ "--d": `${t.vertraging}s` } as CSSProperties}>
                  {t.teken}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </h1>
  );
}
