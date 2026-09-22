import type { CSSProperties } from "react";
import type { Sectie } from "@/lib/schema";
import { leesSite, notitiesVoor } from "@/lib/content";
import { kopStijl } from "@/lib/tekst";
import { Beeld } from "../Beeld";
import { Knop } from "../Knop";
import { Notitie } from "../Notitie";

/** "Waarom Human Margin": twee blokken met foto naar het manifest en naar Over mij. */
export function Verwijzingen({ sectie, pagina }: { sectie: Extract<Sectie, { type: "verwijzingen" }>; pagina: string }) {
  const notities = notitiesVoor(pagina, sectie.id);
  const achtergrond = sectie.achtergrond ?? "zwart";
  return (
    <section id={sectie.id} className={`sectie${achtergrond === "zwart" ? " op-donker" : ""}`} data-achtergrond={achtergrond} aria-labelledby={`${sectie.id}-kop`}>
      <div className="wrap">
        <header className="sectiekop verwijzingen__kopregel" data-reveal>
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
        </header>
        <div className="verwijzingen">
          {sectie.blokken.map((b) => (
            <article key={b.titel} className="verwijzing" data-reveal>
              <Beeld id={b.beeld} sizes="(min-width: 52rem) 40vw, 100vw" focus={b.beeldFocus} />
              <h3 className="kop-3">{b.titel}</h3>
              {b.tekst.map((t) => (
                <p key={t}>{t}</p>
              ))}
              <Knop tekst={b.knop.tekst} doel={b.knop.doel} stijl="tekst" sectie={sectie.id} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Klanten: naam mét logo, eenkleurig in de tekstkleur van de sectie (AC-P7). */
export function Klanten({ sectie }: { sectie: Extract<Sectie, { type: "klanten" }> }) {
  const { klanten } = leesSite();
  const achtergrond = sectie.achtergrond ?? "licht";
  return (
    <section id={sectie.id} className={`sectie${achtergrond === "zwart" ? " op-donker" : ""}`} data-achtergrond={achtergrond} aria-labelledby={`${sectie.id}-kop`}>
      <div className="wrap">
        <header className="sectiekop" data-reveal>
          <h2 id={`${sectie.id}-kop`} className="kop-2" style={kopStijl(sectie.kop)}>
            {sectie.kop}
          </h2>
        </header>
        <ul className="klanten" data-reveal>
          {klanten.map((k) => (
            <li key={k.naam} className={`klant${k.logo ? "" : " klant--zonder-logo"}`}>
              {k.logo ? (
                <span
                  className="klant__logo"
                  role="img"
                  aria-label={k.naam}
                  style={{ "--logo": `url("${k.logo}")`, "--verhouding": k.logoVerhouding ?? 3 } as CSSProperties}
                />
              ) : (
                <span className="klant__logo-vervanger" aria-hidden="true">
                  {k.naam}
                </span>
              )}
              <span className="klant__naam" aria-hidden={k.logo ? "true" : undefined}>
                {k.naam}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Contactblok: geen formulier, wel Calendly, e-mail, telefoon en LinkedIn (bron: "Geen contactform"). */
export function Contact({ sectie }: { sectie: Extract<Sectie, { type: "contact" }> }) {
  const { contact, bedrijf, labels } = leesSite();
  const achtergrond = sectie.achtergrond ?? "geel";
  return (
    <section id={sectie.id} className={`sectie${achtergrond === "zwart" ? " op-donker" : ""}`} data-achtergrond={achtergrond} aria-labelledby={`${sectie.id}-kop`}>
      <div className="wrap contactblok">
        <div className="contactblok__tekst" data-reveal>
          <h2 id={`${sectie.id}-kop`} className="kop-2" style={{ ...kopStijl(sectie.kop), marginBottom: "1.25rem" }}>
            {sectie.kop}
          </h2>
          {sectie.tekst.map((t) => (
            <p key={t} className="lead">
              {t}
            </p>
          ))}
          <div className="knoppen">
            <Knop tekst={sectie.knop.tekst} doel={sectie.knop.doel} sectie={sectie.id} />
          </div>
        </div>
        <div data-reveal>
          {sectie.subkop && <p className="kop-3" style={{ marginBottom: "1rem" }}>{sectie.subkop}</p>}
          <ul className="contactlijst">
            <li>
              <a href={`mailto:${contact.email}`} data-event="mail_klik" data-sectie={sectie.id}>
                {contact.email}
              </a>
            </li>
            <li>
              <a href={`tel:${contact.telefoon}`} data-event="bel_klik" data-sectie={sectie.id}>
                {contact.telefoonWeergave}
              </a>
            </li>
            <li>
              <a href={contact.linkedin} rel="noopener">
                {labels.linkedin}
              </a>
            </li>
          </ul>
          {sectie.toonBedrijfsgegevens && (
            <address className="bedrijfsgegevens">
              {bedrijf.handelsnaam}
              {bedrijf.rechtsvorm ? ` / ${bedrijf.rechtsvorm}` : ""}
              <br />
              {bedrijf.straat}
              <br />
              {bedrijf.postcode} {bedrijf.plaats}
              <br />
              {labels.kvk} {bedrijf.kvk}
              {bedrijf.btwId && (
                <>
                  <br />
                  {labels.btw} {bedrijf.btwId}
                </>
              )}
              <br />
              <a href={contact.linkedin} rel="noopener">
                {contact.linkedinWeergave}
              </a>
            </address>
          )}
        </div>
      </div>
    </section>
  );
}
