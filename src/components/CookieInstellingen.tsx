"use client";

/** "Cookie-instellingen" in de voet: opent de cookiebanner opnieuw (AC-T8). */
export function CookieInstellingen({ tekst }: { tekst: string }) {
  return (
    <button type="button" className="voet__knopje" onClick={() => window.dispatchEvent(new Event("hm:cookie-instellingen"))}>
      {tekst}
    </button>
  );
}
