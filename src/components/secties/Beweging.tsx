import type { CSSProperties } from "react";
import type { Sectie } from "@/lib/schema";
import { leesSite, markeringenVoor, notitiesVoor } from "@/lib/content";
import { kopStijl, langsteWoord } from "@/lib/tekst";
import { Bouwstenen } from "../Bouwstenen";
import { Notitie } from "../Notitie";

/**
 * "Hoe ik werk" als horizontal-scroll-pin (AC-B4): op desktop blijft de sectie staan en schuiven de
 * drie panelen zijwaarts; op mobiel en zonder JS is het een veegcarrousel. Markup volgt het contract
 * van features/horizontal-scroll-pin.
 */
export function Panelen({ sectie, pagina }: { sectie: Extract<Sectie, { type: "panelen" }>; pagina: string }) {
  const { labels } = leesSite();
  const notities = notitiesVoor(pagina, sectie.id);
  const markeringen = markeringenVoor(pagina, sectie.id);
  const langste = Math.max(...sectie.panelen.map((p) => langsteWoord(p.woord)));
  return (
    <section id={sectie.id} className="sectie panelen op-donker" data-achtergrond={sectie.achtergrond ?? "zwart"} aria-labelledby={`${sectie.id}-kop`}>
      <div data-scroll-pin data-panelen>
        <div data-scroll-pin-sticky>
          <div className="panelen__kopregel wrap">
            <div style={{ display: "flex", alignItems: "flex-end", gap: "1.5rem", flexWrap: "wrap" }}>
              <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
                {sectie.kop}
              </h2>
              {notities.length > 0 && (
                <div className="kantlijn" data-notitie-anker="">
                  {notities.map((n) => (
                    <Notitie key={n.tekst} notitie={n} />
                  ))}
                </div>
              )}
            </div>
            <nav data-scroll-pin-nav aria-label={labels.kiesStap}>
              {sectie.panelen.map((p, i) => (
                <button key={p.woord} type="button" data-scroll-pin-word className={i === 0 ? "is-active" : undefined}>
                  {p.woord}
                </button>
              ))}
            </nav>
          </div>
          {/* tabIndex: op mobiel is dit een zijwaarts scrollbare rij; die moet met het toetsenbord
              te bedienen zijn (axe: scrollable-region-focusable). */}
          <ul data-scroll-pin-track aria-label={sectie.kop} tabIndex={0}>
            {sectie.panelen.map((p, i) => (
              <li key={p.woord} data-scroll-pin-panel className="paneel" aria-label={`${i + 1} ${labels.stapVan} ${sectie.panelen.length}`}>
                <span className="paneel__woord" style={{ "--langste-woord": langste } as CSSProperties} aria-hidden="true">
                  {p.woord}
                </span>
                <h3 className="paneel__titel">{p.titel}</h3>
                <p className="paneel__tekst">{p.tekst}</p>
              </li>
            ))}
          </ul>
          <div data-scroll-pin-seg aria-hidden="true">
            {sectie.panelen.map((p) => (
              <span key={p.woord}>
                <i />
              </span>
            ))}
          </div>
        </div>
      </div>
      {sectie.naschrift.length > 0 && (
        <div className="panelen__naschrift wrap">
          <div className="tekst" data-reveal>
            <Bouwstenen stenen={sectie.naschrift} markeringen={markeringen} sectie={sectie.id} />
          </div>
        </div>
      )}
    </section>
  );
}

/** De "elf keer akkoord"-alinea (AC-B3): woord voor woord verlicht tijdens het scrollen. */
export function Verhaal({ sectie }: { sectie: Extract<Sectie, { type: "verhaal" }> }) {
  const achtergrond = sectie.achtergrond ?? "zwart";
  return (
    <section
      id={sectie.id}
      className={`sectie verhaal swl${achtergrond === "zwart" ? " op-donker" : ""}`}
      data-achtergrond={achtergrond}
      data-story-block
      style={{ "--swl-length": 1.8 } as CSSProperties}
    >
      <div className="swl__sticky">
        <div className="wrap">
          <p data-story-text>{sectie.tekst}</p>
        </div>
      </div>
    </section>
  );
}

/** Een slotzin groot in beeld; op het manifest met kinetic-type (AC-B8), als de schakelaar aan staat. */
export function Slotzin({ sectie, pagina }: { sectie: Extract<Sectie, { type: "slotzin" }>; pagina: string }) {
  const { schakelaars } = leesSite();
  const kinetisch = sectie.kinetisch && schakelaars.kineticType;
  const notities = notitiesVoor(pagina, sectie.id);
  const achtergrond = sectie.achtergrond ?? "zwart";
  const langste = Math.max(...sectie.regels.map(langsteWoord));
  return (
    <section id={sectie.id} className={`sectie slotzin${achtergrond === "zwart" ? " op-donker" : ""}`} data-achtergrond={achtergrond}>
      <div className="wrap" style={{ "--langste-woord": langste } as CSSProperties}>
        <div data-reveal={kinetisch ? undefined : ""}>
          {sectie.regels.map((r) => (
            <p key={r} className="slotzin__regel" data-kinetic-type={kinetisch ? "y" : undefined}>
              {r}
            </p>
          ))}
        </div>
        {notities.length > 0 && (
          <div className="kantlijn slotzin__kantlijn" data-notitie-anker="">
            {notities.map((n) => (
              <Notitie key={n.tekst} notitie={n} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
