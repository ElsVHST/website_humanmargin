import type { Bouwsteen, Kantlijn } from "@/lib/schema";
import { beeld as vindBeeld } from "@/lib/content";
import { kopStijl } from "@/lib/tekst";
import { Knop } from "./Knop";
import { Opgemaakt } from "./Opgemaakt";
import { Beeld } from "./Beeld";

type Props = {
  stenen: Bouwsteen[];
  markeringen?: Kantlijn["markeringen"];
  sectie: string;
};

/**
 * De zes basisbouwstenen (AC-P9): kop, alinea, citaat, foto, lijst en knop. Een nieuwe pagina via
 * ChatGPT bestaat alleen hieruit, en krijgt zo vanzelf de merkopmaak.
 */
export function Bouwstenen({ stenen, markeringen = [], sectie }: Props) {
  const knoppen = stenen.filter((s) => s.type === "knop").length;
  return (
    <>
      {stenen.map((s, i) => {
        switch (s.type) {
          case "kop":
            return s.niveau === 3 ? (
              <h3 key={i} className="kop-3" style={{ marginTop: i ? "2rem" : 0, marginBottom: "0.75rem" }}>
                {s.tekst}
              </h3>
            ) : (
              <h2 key={i} className="kop-2" style={{ ...kopStijl(s.tekst), marginTop: i ? "3rem" : 0, marginBottom: "1.25rem" }}>
                {s.tekst}
              </h2>
            );
          case "alinea":
            return (
              <p key={i}>
                <Opgemaakt tekst={s.tekst} markeringen={markeringen} />
              </p>
            );
          case "citaat":
            return (
              <blockquote key={i} className="citaatblok">
                <p className="citaat">{s.tekst}</p>
                {s.bron && <footer className="label" style={{ marginTop: "1rem" }}>{s.bron}</footer>}
              </blockquote>
            );
          case "foto": {
            const b = vindBeeld(s.beeld);
            if (b.soort === "inzet") {
              return (
                <figure key={i} className="inzet">
                  <Beeld id={s.beeld} sizes="200px" vullen={false} />
                  {s.bijschrift && <figcaption className="zacht" style={{ fontSize: "0.85rem", padding: "0.4rem 0.2rem 0" }}>{s.bijschrift}</figcaption>}
                </figure>
              );
            }
            return (
              <figure key={i} style={{ marginBlock: "2rem" }}>
                <Beeld id={s.beeld} sizes="(min-width: 64rem) 38rem, 100vw" vullen={false} />
                {s.bijschrift && <figcaption className="zacht" style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>{s.bijschrift}</figcaption>}
              </figure>
            );
          }
          case "lijst": {
            const items = s.items.map((item, j) => (
              <li key={j}>
                <Opgemaakt tekst={item} markeringen={markeringen} />
              </li>
            ));
            return s.genummerd ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          case "knop":
            return (
              <div key={i} className="knoppen" style={{ marginTop: "1.75rem" }}>
                <Knop tekst={s.tekst} doel={s.doel} sectie={sectie} stijl={knoppen > 1 && i > 0 ? "tekst" : "knop"} />
              </div>
            );
        }
      })}
    </>
  );
}
