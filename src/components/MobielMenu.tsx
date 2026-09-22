"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type Props = {
  nav: { label: string; pad: string }[];
  huidig: string;
  teksten: { menu: string; sluit: string; hoofdmenu: string };
  kennismaking: { tekst: string; href: string };
};

/**
 * Het mobiele menu als native modale <dialog> (AC-A6): opent over de volle hoogte, Escape sluit,
 * de focus blijft binnen de dialoog en de rest van de pagina is inert. Dat regelt showModal() zelf.
 */
export function MobielMenu({ nav, huidig, teksten, kennismaking }: Props) {
  const dialoog = useRef<HTMLDialogElement>(null);
  const knop = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Een klik op een link in het menu navigeert; sluit dan het menu.
    const d = dialoog.current;
    if (!d) return;
    const sluitBijLink = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) d.close();
    };
    const sluitBijBreed = () => window.matchMedia("(min-width: 64rem)").matches && d.open && d.close();
    // Een modale dialoog houdt de pagina eronder niet stil: zonder dit scrollt de bezoeker het
    // menu weg en staat hij na het sluiten twee secties verder dan waar hij begon.
    const zetVast = () => document.body.classList.add("menu-open");
    const laatLos = () => document.body.classList.remove("menu-open");
    d.addEventListener("click", sluitBijLink);
    d.addEventListener("close", laatLos);
    window.addEventListener("resize", sluitBijBreed);
    const waarnemer = new MutationObserver(() => (d.open ? zetVast() : laatLos()));
    waarnemer.observe(d, { attributes: true, attributeFilter: ["open"] });
    return () => {
      d.removeEventListener("click", sluitBijLink);
      d.removeEventListener("close", laatLos);
      window.removeEventListener("resize", sluitBijBreed);
      waarnemer.disconnect();
      laatLos();
    };
  }, []);

  return (
    <>
      <button
        ref={knop}
        type="button"
        className="kop__menuknop"
        aria-haspopup="dialog"
        aria-controls="hoofdmenu-mobiel"
        onClick={() => dialoog.current?.showModal()}
      >
        {teksten.menu}
      </button>
      <dialog ref={dialoog} id="hoofdmenu-mobiel" className="menu op-donker" aria-label={teksten.hoofdmenu} onClose={() => knop.current?.focus()}>
        <div className="wrap">
          <div className="menu__kop">
            <span className="label">{teksten.menu}</span>
            <button type="button" className="kop__menuknop" onClick={() => dialoog.current?.close()}>
              {teksten.sluit}
            </button>
          </div>
          <ul className="menu__lijst">
            {nav.map((n) => (
              <li key={n.pad}>
                <Link href={n.pad} aria-current={huidig === n.pad ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="menu__cta">
            <a className="knop" href={kennismaking.href} data-event="kennismaking_klik" data-sectie="menu">
              {kennismaking.tekst}
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
