import type { Sectie } from "@/lib/schema";
import { markeringenVoor, notitiesVoor } from "@/lib/content";
import { kopStijl } from "@/lib/tekst";
import { Knop } from "../Knop";
import { Notitie } from "../Notitie";
import { Opgemaakt } from "../Opgemaakt";

const nr = (i: number) => String(i + 1).padStart(2, "0");

function Kader({ sectie, kopId, children }: { sectie: Sectie; kopId?: string; children: React.ReactNode }) {
  const achtergrond = sectie.achtergrond ?? "licht";
  return (
    <section id={sectie.id} className={`sectie${achtergrond === "zwart" ? " op-donker" : ""}`} data-achtergrond={achtergrond} aria-labelledby={kopId}>
      <div className="wrap">{children}</div>
    </section>
  );
}

/** "01 De situatie — Zeven vragen": grote genummerde vragen, vraag 07 met markeerstift. */
export function Vragenlijst({ sectie, pagina }: { sectie: Extract<Sectie, { type: "vragenlijst" }>; pagina: string }) {
  const markeringen = markeringenVoor(pagina, sectie.id);
  return (
    <Kader sectie={sectie} kopId={`${sectie.id}-kop`}>
      <div className="vragenlijst__raster">
        <header className="sectiekop" data-reveal>
          {sectie.label && <span className="label">{sectie.label}</span>}
          <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
            {sectie.kop}
          </h2>
          {sectie.subkop && (
            <p className="kop-3" style={{ marginTop: "2rem" }}>
              {sectie.subkop}
            </p>
          )}
          {sectie.intro && <p style={{ marginTop: "0.75rem", maxWidth: "28rem" }}>{sectie.intro}</p>}
        </header>
        <div>
          <ol className="vragen" data-reveal>
            {sectie.vragen.map((v, i) => (
              <li key={v}>
                <span className="vragen__nr">{nr(i)}</span>
                <span>
                  <Opgemaakt tekst={v} markeringen={markeringen} />
                </span>
              </li>
            ))}
          </ol>
          {sectie.slot && <p className="vragenlijst__slot">{sectie.slot}</p>}
        </div>
      </div>
    </Kader>
  );
}

/** Opsomming met een vetgedrukt begin ("Voor wie", "Waarom ik en niet een ander?"). */
export function Punten({ sectie, pagina }: { sectie: Extract<Sectie, { type: "punten" }>; pagina: string }) {
  const markeringen = markeringenVoor(pagina, sectie.id);
  return (
    <Kader sectie={sectie} kopId={`${sectie.id}-kop`}>
      <div className="punten-raster">
        <header className="sectiekop" data-reveal>
          <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
            {sectie.kop}
          </h2>
        </header>
        <ul className="punten" data-reveal>
          {sectie.items.map((p) => (
            <li key={p.nadruk}>
              <strong>{p.nadruk}</strong>
              {p.tekst && (
                <span>
                  <Opgemaakt tekst={p.tekst} markeringen={markeringen} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Kader>
  );
}

/** De Human Margin-methode, M-A-R-G-I-N (V5). */
export function Methode({ sectie }: { sectie: Extract<Sectie, { type: "methode" }> }) {
  return (
    <Kader sectie={sectie} kopId={`${sectie.id}-kop`}>
      <header className="sectiekop" data-reveal>
        <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
          {sectie.kop}
        </h2>
      </header>
      <ol className="methode" data-reveal>
        {sectie.letters.map((l) => (
          <li key={l.letter}>
            <span className="methode__letter">{l.letter}</span>
            <span className="methode__woord">{l.woord}</span>
            <span>{l.tekst}</span>
          </li>
        ))}
      </ol>
    </Kader>
  );
}

/** "Voordat we beginnen": uitklapbare vragen. Alle antwoorden staan in de HTML, ook zonder JS (AC-P5). */
export function Faq({ sectie, pagina }: { sectie: Extract<Sectie, { type: "faq" }>; pagina: string }) {
  const notities = notitiesVoor(pagina, sectie.id);
  return (
    <Kader sectie={sectie} kopId={`${sectie.id}-kop`}>
      <div className="faq-raster">
        <header className="sectiekop">
          <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
            {sectie.kop}
          </h2>
          {notities.length > 0 && (
            <div className="kantlijn" data-notitie-anker="" style={{ marginTop: "1.5rem" }}>
              {notities.map((n) => (
                <Notitie key={n.tekst} notitie={n} />
              ))}
            </div>
          )}
          {sectie.knop && (
            <div className="knoppen">
              <Knop tekst={sectie.knop.tekst} doel={sectie.knop.doel} sectie={sectie.id} />
            </div>
          )}
        </header>
        <div className="faq">
          {sectie.vragen.map((v, i) => (
            <details key={v.vraag}>
              <summary>
                <span className="faq__nr">{nr(i)}</span>
                <span>{v.vraag}</span>
              </summary>
              <div className="faq__antwoord">
                {v.antwoord.map((a) => (
                  <p key={a}>{a}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </Kader>
  );
}
