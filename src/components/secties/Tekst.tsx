import type { Sectie } from "@/lib/schema";
import { markeringenVoor, notitiesVoor } from "@/lib/content";
import { kopStijl } from "@/lib/tekst";
import { Beeld } from "../Beeld";
import { Bouwstenen } from "../Bouwstenen";
import { Notitie } from "../Notitie";

type TekstSectie = Extract<Sectie, { type: "tekst" }>;

/** Een gewone sectie met bouwstenen, de kantlijn ernaast en eventueel een foto aan de rand. */
export function Tekst({ sectie, pagina }: { sectie: TekstSectie; pagina: string }) {
  const achtergrond = sectie.achtergrond ?? "licht";
  const notities = notitiesVoor(pagina, sectie.id).filter((n) => n.plek === "kantlijn");
  const markeringen = markeringenVoor(pagina, sectie.id);
  const heeftKop = Boolean(sectie.kop || sectie.label);
  // Een korte sectie zonder foto (één of twee alinea's) wordt een statement in grotere tekst.
  const alineas = sectie.bouwstenen.filter((b) => b.type === "alinea").length;
  const groot = !sectie.beeld && alineas > 0 && alineas <= 2 && sectie.bouwstenen.every((b) => b.type === "alinea" || b.type === "knop");
  return (
    <section
      id={sectie.id}
      className={`sectie${achtergrond === "zwart" ? " op-donker" : ""}`}
      data-achtergrond={achtergrond}
      aria-labelledby={sectie.kop ? `${sectie.id}-kop` : undefined}
    >
      <div className="wrap">
        {heeftKop && (
          <header className="sectiekop" data-reveal>
            {sectie.label && <span className="label">{sectie.label}</span>}
            {sectie.kop && (
              <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
                {sectie.kop}
              </h2>
            )}
          </header>
        )}
        <div className={`tekstvlak${sectie.beeldPositie === "links" ? " tekstvlak--links" : ""}${groot ? " tekstvlak--groot" : ""}`}>
          <div className={`tekst${groot ? " tekst--groot" : ""}`} data-reveal data-notitie-anker={notities.length ? "" : undefined}>
            <Bouwstenen stenen={sectie.bouwstenen} markeringen={markeringen} sectie={sectie.id} />
          </div>
          {notities.length > 0 && (
            <div className="kantlijn">
              {notities.map((n) => (
                <Notitie key={n.tekst} notitie={n} />
              ))}
            </div>
          )}
          {sectie.beeld && <Beeld id={sectie.beeld} sizes="(min-width: 64rem) 30vw, 100vw" focus={sectie.beeldFocus} className="zijbeeld" />}
        </div>
      </div>
    </section>
  );
}
