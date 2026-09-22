/* eslint-disable @next/next/no-img-element -- getekende merk-SVG's */
import type { Sectie } from "@/lib/schema";
import { leesSite } from "@/lib/content";
import { kopStijl, prijsTekst } from "@/lib/tekst";
import { Beeld } from "../Beeld";

/**
 * Het cyclusschema (AC-P4): 01 Nulmeting → 02 Regietraject → 03 Academie → terug naar 01.
 * De volgorde staat als geordende lijst in de HTML; de pijlen zijn decoratie.
 */
export function Cyclus({ sectie }: { sectie: Extract<Sectie, { type: "cyclus" }> }) {
  const achtergrond = sectie.achtergrond ?? "grijs";
  return (
    <section id={sectie.id} className="sectie" data-achtergrond={achtergrond} aria-label={leesSite().labels.cyclus}>
      <div className="wrap">
        <ol className="cyclus" data-reveal>
          {sectie.stappen.map((s, i) => (
            <li key={s.nummer} className="cyclus__stap">
              <span className="cyclus__nr">{s.nummer}</span>
              <span className="cyclus__naam">{s.naam}</span>
              <span className="cyclus__vraag">{s.vraag}</span>
              {i < sectie.stappen.length - 1 && <img className="cyclus__pijl" src="/merk/getekend/pijl-recht.svg" alt="" width={58} height={13} loading="lazy" decoding="async" />}
            </li>
          ))}
        </ol>
        <p className="cyclus__terug">
          <img src="/merk/getekend/pijl-gebogen.svg" alt="" width={74} height={29} />
          <span>{sectie.terug}</span>
        </p>
        {sectie.tekst.length > 0 && (
          <div className="cyclus__tekst">
            {sectie.tekst.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Eén deel van het aanbod, met blokken en prijzen. Het btw-label komt uit site.json (V12). */
export function AanbodDeel({ sectie }: { sectie: Extract<Sectie, { type: "aanbod-deel" }> }) {
  const { btwLabel } = leesSite();
  const achtergrond = sectie.achtergrond ?? "licht";
  return (
    <section
      id={sectie.id}
      className={`sectie${achtergrond === "zwart" ? " op-donker" : ""}`}
      data-achtergrond={achtergrond}
      aria-labelledby={`${sectie.id}-kop`}
    >
      <div className="wrap">
        <header className="deel__kop" data-reveal>
          <span className="deel__nr" aria-hidden="true">
            {sectie.nummer}
          </span>
          <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.titel)}>
            <span className="sr-only">{sectie.nummer} </span>
            {sectie.titel}
          </h2>
        </header>
        {sectie.intro.length > 0 && (
          <div className="deel__intro" data-reveal style={{ maxWidth: "46rem" }}>
            {sectie.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
        {sectie.blokken.length > 0 && (
          <div className="deel__raster">
            {sectie.blokken.map((b) => (
              <div key={b.kop} className="deel__blok tekst" data-reveal>
                <h3 className="kop-3">{b.kop}</h3>
                {b.tekst.map((t) => (
                  <p key={t}>{t}</p>
                ))}
                {b.lijst.length > 0 && (
                  <ul>
                    {b.lijst.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
                {b.naschrift.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="deel__prijs" data-reveal>
          <div>
            {sectie.prijsKop && (
              <h3 className="label" style={{ marginBottom: "0.9rem" }}>
                {sectie.prijsKop}
              </h3>
            )}
            {sectie.prijzen.map((p) => (
              <p key={`${p.voor ?? ""}${p.bedrag}`} className="prijs">
                {prijsTekst(p)}
                <span className="prijs__btw">{btwLabel}</span>
              </p>
            ))}
          </div>
          <div>
            {sectie.prijsToelichting.map((t) => (
              <p key={t} style={{ marginBottom: "0.6em" }}>
                {t}
              </p>
            ))}
            {sectie.inzet && (
              <figure className="inzet">
                <Beeld id={sectie.inzet} sizes="200px" vullen={false} />
              </figure>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
