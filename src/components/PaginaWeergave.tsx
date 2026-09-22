import type { Pagina } from "@/lib/schema";
import { Opening } from "./secties/Opening";
import { Tekst } from "./secties/Tekst";
import { Faq, Methode, Punten, Vragenlijst } from "./secties/Lijsten";
import { AanbodDeel, Cyclus } from "./secties/Aanbod";
import { Panelen, Slotzin, Verhaal } from "./secties/Beweging";
import { Contact, Klanten, Verwijzingen } from "./secties/Overig";
import { kopStijl } from "@/lib/tekst";
import { Kop } from "./Kop";
import { Voet } from "./Voet";
import { paginaPad } from "@/lib/content";

/** Pagina's waarvan de opening letter voor letter opkomt (hero-motion, PRD-001 §6.3). */
const MET_HERO_BEWEGING = new Set(["home", "manifest"]);

/**
 * Eén weergave voor elke pagina uit content/paginas/*.json (AC-P9): kop, secties in volgorde, voet.
 * Een pagina zonder opening krijgt een eenvoudige kop met de h1.
 */
export function PaginaWeergave({ pagina }: { pagina: Pagina }) {
  const heeftOpening = pagina.secties[0]?.type === "opening";
  return (
    <>
      <Kop huidig={paginaPad(pagina.slug)} />
      <main id="inhoud" tabIndex={-1}>
        {!heeftOpening && pagina.kop && (
          <section className="sectie opening" data-achtergrond="licht" style={{ minHeight: 0 }}>
            <div className="wrap">
              <h1 className="kop-1" style={kopStijl(pagina.kop)}>
                {pagina.kop}
              </h1>
            </div>
          </section>
        )}
        {pagina.secties.map((s) => {
          switch (s.type) {
            case "opening":
              return <Opening key={s.id} sectie={s} pagina={pagina.slug} beweging={MET_HERO_BEWEGING.has(pagina.slug)} />;
            case "tekst":
              return <Tekst key={s.id} sectie={s} pagina={pagina.slug} />;
            case "vragenlijst":
              return <Vragenlijst key={s.id} sectie={s} pagina={pagina.slug} />;
            case "panelen":
              return <Panelen key={s.id} sectie={s} pagina={pagina.slug} />;
            case "verwijzingen":
              return <Verwijzingen key={s.id} sectie={s} pagina={pagina.slug} />;
            case "klanten":
              return <Klanten key={s.id} sectie={s} />;
            case "faq":
              return <Faq key={s.id} sectie={s} pagina={pagina.slug} />;
            case "contact":
              return <Contact key={s.id} sectie={s} />;
            case "cyclus":
              return <Cyclus key={s.id} sectie={s} />;
            case "aanbod-deel":
              return <AanbodDeel key={s.id} sectie={s} />;
            case "methode":
              return <Methode key={s.id} sectie={s} />;
            case "punten":
              return <Punten key={s.id} sectie={s} pagina={pagina.slug} />;
            case "verhaal":
              return <Verhaal key={s.id} sectie={s} />;
            case "slotzin":
              return <Slotzin key={s.id} sectie={s} pagina={pagina.slug} />;
          }
        })}
      </main>
      <Voet />
    </>
  );
}
