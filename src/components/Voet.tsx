/* eslint-disable @next/next/no-img-element -- aangeleverde logo-SVG (AC-M4) */
import Link from "next/link";
import { leesNavigatie, leesSite } from "@/lib/content";
import { CookieInstellingen } from "./CookieInstellingen";

/**
 * De voet (AC-P8): naam met ®, adres en KVK, contact, privacy, cookie-instellingen (alleen met een
 * GA-ID) en de credit voor Co-Creatie.ai (V8). Geen btw-id zolang dat leeg is (V15).
 */
export function Voet() {
  const { bedrijf, contact, credit, voet, cookiebanner, labels } = leesSite();
  const nav = leesNavigatie();
  const heeftGa = process.env.NEXT_PUBLIC_GA_ID !== "";
  return (
    <footer className="voet op-donker">
      <div className="wrap">
        <div className="voet__raster">
          <div>
            {/* De naam staat er als tekst direct onder, dus het logo is hier decoratie (AC-I7: ® hoogstens 2× per pagina). */}
            <img className="voet__logo" src="/merk/logo-omgekeerd.svg" alt="" width={176} height={85} />
            <p style={{ marginTop: "1.25rem" }}>
              {bedrijf.handelsnaam}®, {bedrijf.straat}, {bedrijf.postcode} {bedrijf.plaats}, {labels.kvk} {bedrijf.kvk}
              {bedrijf.btwId ? `, ${labels.btw} ${bedrijf.btwId}` : ""}
            </p>
          </div>
          <ul>
            <li>
              <a href={`mailto:${contact.email}`} data-event="mail_klik" data-sectie="voet">
                {contact.email}
              </a>
            </li>
            <li>
              <a href={`tel:${contact.telefoon}`} data-event="bel_klik" data-sectie="voet">
                {contact.telefoonWeergave}
              </a>
            </li>
            <li>
              <a href={contact.linkedin} rel="noopener">
                {labels.linkedin}
              </a>
            </li>
          </ul>
          <ul>
            {nav.map((n) => (
              <li key={n.pad}>
                <Link href={n.pad}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="voet__onder">
          <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem" }}>
            <li>
              <Link href="/privacy/">{voet.privacyLabel}</Link>
            </li>
            {heeftGa && (
              <li>
                <CookieInstellingen tekst={cookiebanner.instellingen} />
              </li>
            )}
          </ul>
          <a href={credit.url} rel="noopener">
            {credit.tekst}
          </a>
        </div>
      </div>
    </footer>
  );
}
