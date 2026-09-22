/* eslint-disable @next/next/no-img-element -- aangeleverde logo-SVG's, byte-gelijk (AC-M4) */
import Link from "next/link";
import { leesNavigatie, leesSite } from "@/lib/content";
import { Knop } from "./Knop";
import { MobielMenu } from "./MobielMenu";

/**
 * De kopbalk (dia 9: "volledig logo in begin, erna over naar verkorte favicon"). Zwart, vast bovenin.
 * features/header-state zet `is-past-hero` zodra de bezoeker voorbij de opening is (AC-M5, AC-B1).
 * Geen backdrop-filter, transform of filter op deze balk: dat breekt het vaste menu (PRD §4.2).
 */
export function Kop({ huidig }: { huidig: string }) {
  const site = leesSite();
  const nav = leesNavigatie();
  return (
    <header className="kop op-donker" data-kop>
      <div className="wrap kop__binnen">
        <Link href="/" className="kop__logo" aria-label={site.labels.home}>
          <img className="kop__volledig" src="/merk/logo-omgekeerd.svg" alt="" width={120} height={58} />
          <img className="kop__merkteken" src="/merk/getekend/merkteken.svg" alt="" width={52} height={58} />
        </Link>
        <nav className="kop__nav" aria-label={site.labels.hoofdmenu}>
          {nav.map((n) => (
            <Link key={n.pad} href={n.pad} className="kop__link" aria-current={huidig === n.pad ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
          <Knop tekst={site.kennismakingLabel} doel="kennismaking" sectie="kop" />
        </nav>
        <MobielMenu
          nav={nav}
          huidig={huidig}
          teksten={{ menu: site.voet.menu, sluit: site.voet.sluitMenu, hoofdmenu: site.labels.hoofdmenu }}
          kennismaking={{ tekst: site.kennismakingLabel, href: site.contact.calendly }}
        />
        {/* Zonder JavaScript: hetzelfde menu als uitklapper (PRD §5.6). */}
        <details className="menu-zonder-js">
          <summary>{site.voet.menu}</summary>
          <ul className="menu__lijst">
            {nav.map((n) => (
              <li key={n.pad}>
                <Link href={n.pad} aria-current={huidig === n.pad ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="menu__cta">
              <a className="knop" href={site.contact.calendly}>
                {site.kennismakingLabel}
              </a>
            </li>
          </ul>
        </details>
      </div>
    </header>
  );
}
