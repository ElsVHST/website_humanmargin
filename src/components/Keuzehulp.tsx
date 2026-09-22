"use client";

import { useEffect, useRef, useState } from "react";

type Teksten = {
  vraag: string;
  onderwerpen: { id: string; label: string; onderwerp: string }[];
  tweedeVraag: string;
  kennismaking: string;
  mail: string;
  bellen: string;
  terug: string;
  sluiten: string;
};
type Contact = { email: string; telefoon: string; telefoonWeergave: string; calendly: string };

/**
 * De keuzehulp (V18): afgeleid van features/link-dialog-funnel — een native <dialog> die links met
 * `data-keuzehulp` onderschept, in stappen — maar zonder formulier. Stap 1: waar gaat het over?
 * Stap 2: Calendly, mail met ingevuld onderwerp, of bellen. Er gaat niets naar een server (AC-P6).
 * Zonder JavaScript volgt de bezoeker gewoon de link naar /contact/.
 */
export function Keuzehulp({ teksten, contact }: { teksten: Teksten; contact: Contact }) {
  const dialoog = useRef<HTMLDialogElement>(null);
  const titel = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [keuze, setKeuze] = useState<Teksten["onderwerpen"][number] | null>(null);

  useEffect(() => {
    const onderschep = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-keuzehulp]");
      if (!link || !dialoog.current) return;
      e.preventDefault();
      opener.current = link;
      setKeuze(null);
      dialoog.current.showModal();
      window.dispatchEvent(new CustomEvent("hm:event", { detail: { naam: "keuzehulp_stap", velden: { stap: 1 } } }));
    };
    document.addEventListener("click", onderschep, true);
    return () => document.removeEventListener("click", onderschep, true);
  }, []);

  // Na elke stap de focus op de titel van de stap, zodat een schermlezer de nieuwe vraag voorleest.
  useEffect(() => {
    if (dialoog.current?.open) titel.current?.focus();
  }, [keuze]);

  const kies = (o: Teksten["onderwerpen"][number]) => {
    setKeuze(o);
    window.dispatchEvent(new CustomEvent("hm:event", { detail: { naam: "keuzehulp_stap", velden: { onderwerp: o.id } } }));
  };

  return (
    <dialog
      ref={dialoog}
      className="keuzehulp"
      aria-labelledby="keuzehulp-titel"
      onClose={() => opener.current?.focus()}
      onClick={(e) => e.target === dialoog.current && dialoog.current?.close()}
    >
      <div className="keuzehulp__binnen">
        <button type="button" className="keuzehulp__sluit" onClick={() => dialoog.current?.close()}>
          {teksten.sluiten}
        </button>
        {!keuze ? (
          <>
            <h2 id="keuzehulp-titel" ref={titel} tabIndex={-1} className="kop-3" style={{ paddingRight: "5rem" }}>
              {teksten.vraag}
            </h2>
            <ul className="keuzehulp__opties">
              {teksten.onderwerpen.map((o) => (
                <li key={o.id}>
                  <button type="button" className="keuzehulp__optie" onClick={() => kies(o)} data-onderwerp={o.id}>
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="label">{keuze.label}</p>
            <h2 id="keuzehulp-titel" ref={titel} tabIndex={-1} className="kop-3" style={{ paddingRight: "5rem", marginTop: "0.4rem" }}>
              {teksten.tweedeVraag}
            </h2>
            <ul className="keuzehulp__wegen">
              <li>
                <a className="keuzehulp__weg" href={contact.calendly} data-event="kennismaking_klik" data-sectie="keuzehulp" data-onderwerp={keuze.id}>
                  <strong>{teksten.kennismaking}</strong>
                </a>
              </li>
              <li>
                <a
                  className="keuzehulp__weg"
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(keuze.onderwerp)}`}
                  data-event="mail_klik"
                  data-sectie="keuzehulp"
                  data-onderwerp={keuze.id}
                >
                  <strong>{teksten.mail}</strong>
                  <span>{contact.email}</span>
                </a>
              </li>
              <li>
                <a className="keuzehulp__weg" href={`tel:${contact.telefoon}`} data-event="bel_klik" data-sectie="keuzehulp" data-onderwerp={keuze.id}>
                  <strong>{teksten.bellen}</strong>
                  <span>{contact.telefoonWeergave}</span>
                </a>
              </li>
            </ul>
            <button type="button" className="knop-tekst keuzehulp__terug" onClick={() => setKeuze(null)}>
              {teksten.terug}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
