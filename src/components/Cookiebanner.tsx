"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/*
 * Google Analytics 4 met cookiebanner (V9, AC-T7, AC-T8).
 * - Het meet-ID komt uit NEXT_PUBLIC_GA_ID. Staat dat leeg (de standaard, V22), dan geeft dit
 *   component niets terug en snoeit de bouw alle GA-code weg: qa/check-bundel.mjs telt 0 keer
 *   "googletagmanager" en "gtag(" in .next/static.
 * - Vóór een keuze: geen verzoek naar Google, geen cookie. De keuze staat in localStorage.
 * - Accepteren laadt gtag.js met Consent Mode v2 (standaard "denied", daarna "granted").
 * - Weigeren wist eventuele _ga-cookies. "Cookie-instellingen" in de voet opent de banner opnieuw.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const SLEUTEL = "hm-statistiek";

type Teksten = { tekst: string; accepteren: string; weigeren: string; meerLezen: string };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function laadGa(id: string) {
  if (window.gtag) {
    window.gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function wisGaCookies() {
  const domeinen = ["", location.hostname, `.${location.hostname.split(".").slice(-2).join(".")}`];
  for (const c of document.cookie.split(";")) {
    const naam = c.split("=")[0]?.trim();
    if (!naam || !naam.startsWith("_ga")) continue;
    for (const d of domeinen) document.cookie = `${naam}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
  }
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
}

function leesKeuze(): string | null {
  try {
    return localStorage.getItem(SLEUTEL);
  } catch {
    return null;
  }
}

export function Cookiebanner({ teksten }: { teksten: Teksten }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;
    const keuze = leesKeuze();
    if (keuze === "ja") laadGa(GA_ID);
    // localStorage bestaat alleen in de browser: na de eerste paint tonen, zonder hydratieverschil.
    else if (keuze !== "nee") requestAnimationFrame(() => setOpen(true));
    const heropen = () => setOpen(true);
    const meet = (e: Event) => {
      const { naam, velden } = (e as CustomEvent).detail ?? {};
      if (leesKeuze() === "ja" && window.gtag && naam) window.gtag("event", naam, { pagina: location.pathname, ...velden });
    };
    const klik = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-event]");
      if (!el || leesKeuze() !== "ja" || !window.gtag) return;
      window.gtag("event", el.dataset.event, { pagina: location.pathname, sectie: el.dataset.sectie, onderwerp: el.dataset.onderwerp });
    };
    window.addEventListener("hm:cookie-instellingen", heropen);
    window.addEventListener("hm:event", meet);
    document.addEventListener("click", klik, true);
    return () => {
      window.removeEventListener("hm:cookie-instellingen", heropen);
      window.removeEventListener("hm:event", meet);
      document.removeEventListener("click", klik, true);
    };
  }, []);

  if (!GA_ID || !open) return null;

  const kies = (ja: boolean) => {
    try {
      localStorage.setItem(SLEUTEL, ja ? "ja" : "nee");
    } catch {
      /* privémodus: dan geldt de keuze alleen voor deze pagina */
    }
    setOpen(false);
    if (ja) laadGa(GA_ID);
    else wisGaCookies();
  };

  return (
    <div className="cookiebanner" role="region" aria-label={teksten.meerLezen}>
      <div className="cookiebanner__binnen">
        <p>
          {teksten.tekst}{" "}
          <Link href="/privacy/" style={{ textDecorationColor: "var(--geel)" }}>
            {teksten.meerLezen}
          </Link>
        </p>
        <div className="cookiebanner__knoppen">
          <button type="button" className="cookiebanner__ja" onClick={() => kies(true)}>
            {teksten.accepteren}
          </button>
          <button type="button" className="cookiebanner__nee" onClick={() => kies(false)}>
            {teksten.weigeren}
          </button>
        </div>
      </div>
    </div>
  );
}
