import "server-only";
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

/*
 * Toegang tot de koppeling (PRD-002 AC-T1 t/m AC-T5).
 *
 * Wie mag er binnen? Alleen een GitHub-gebruikersnaam die in TOEGESTANE_GITHUB_GEBRUIKERS staat.
 * Staat die lijst leeg, dan mag niemand — dat is de stand tot Els een account heeft (AC-T3). Er is
 * bewust geen "laat alles door"-waarde: een lege lijst betekent dicht, niet open.
 *
 * Tokens zijn ondertekende strings met een vervaldatum (AC-T4). Geen database: de handtekening is
 * het bewijs. Het geheim staat alleen in de env van Vercel (AC-V5).
 */

export const TOKEN_LEVENSDUUR_DAGEN = Number(process.env.KOPPELING_TOKEN_DAGEN ?? 30);

/** De toegangslijst, klein geschreven. Leeg = niemand. */
export function toegestaneGebruikers(): string[] {
  return (process.env.TOEGESTANE_GITHUB_GEBRUIKERS ?? "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
}

export function magBinnen(gebruikersnaam: string | undefined | null): boolean {
  if (!gebruikersnaam) return false;
  const lijst = toegestaneGebruikers();
  return lijst.length > 0 && lijst.includes(gebruikersnaam.toLowerCase());
}

function geheim(): Buffer {
  const s = process.env.KOPPELING_TOKEN_GEHEIM;
  if (!s || s.length < 24) {
    // Zonder geheim kan er niets ondertekend worden. Een willekeurig geheim per proces zou tokens
    // stilletjes ongeldig maken bij elke herstart; dan liever meteen een duidelijke fout. De naam
    // van de instelling staat in de log, niet in wat Els te zien krijgt.
    console.error("koppeling: KOPPELING_TOKEN_GEHEIM ontbreekt of is korter dan 24 tekens");
    throw new Error("Deze site is nog niet klaar om aangepast te worden. Laat Lars of Chris de koppeling afmaken.");
  }
  return Buffer.from(s, "utf8");
}

const b64 = (b: Buffer) => b.toString("base64url");
const vanB64 = (s: string) => Buffer.from(s, "base64url");

export type TokenInhoud = {
  /** GitHub-gebruikersnaam */
  gebruiker: string;
  /** seconden sinds 1970 */
  verlooptOp: number;
  /** waarvoor het token geldig is (de canonieke URL van de MCP-route) */
  bron: string;
  /** willekeurig, zodat twee tokens voor dezelfde gebruiker verschillen */
  nonce: string;
};

export function maakToken(gebruiker: string, bron: string, dagen = TOKEN_LEVENSDUUR_DAGEN): string {
  const inhoud: TokenInhoud = {
    gebruiker,
    bron,
    verlooptOp: Math.floor(Date.now() / 1000) + dagen * 24 * 3600,
    nonce: randomBytes(9).toString("base64url"),
  };
  const lichaam = b64(Buffer.from(JSON.stringify(inhoud), "utf8"));
  const handtekening = b64(createHmac("sha256", geheim()).update(lichaam).digest());
  return `${lichaam}.${handtekening}`;
}

export type Tokenoordeel = { geldig: true; inhoud: TokenInhoud } | { geldig: false; reden: string };

export function leesToken(token: string | undefined | null, bron: string): Tokenoordeel {
  if (!token) return { geldig: false, reden: "geen token" };
  const [lichaam, handtekening] = token.split(".");
  if (!lichaam || !handtekening) return { geldig: false, reden: "token heeft niet de juiste vorm" };
  let verwacht: Buffer;
  try {
    verwacht = createHmac("sha256", geheim()).update(lichaam).digest();
  } catch {
    return { geldig: false, reden: "de server kan tokens niet controleren" };
  }
  const gegeven = vanB64(handtekening);
  if (gegeven.length !== verwacht.length || !timingSafeEqual(gegeven, verwacht)) {
    return { geldig: false, reden: "handtekening klopt niet" };
  }
  let inhoud: TokenInhoud;
  try {
    inhoud = JSON.parse(vanB64(lichaam).toString("utf8")) as TokenInhoud;
  } catch {
    return { geldig: false, reden: "token is onleesbaar" };
  }
  if (inhoud.verlooptOp * 1000 < Date.now()) return { geldig: false, reden: "token is verlopen" };
  if (inhoud.bron !== bron) return { geldig: false, reden: "token is voor een andere site" };
  // De toegangslijst telt bij élke aanroep, niet alleen bij het inloggen: haalt Lars iemand van de
  // lijst, dan werkt een eerder uitgegeven token meteen niet meer (AC-T4, intrekken).
  if (!magBinnen(inhoud.gebruiker)) return { geldig: false, reden: "deze gebruiker staat niet meer op de lijst" };
  return { geldig: true, inhoud };
}

/**
 * De testmodus (AC-T5). Drie voorwaarden, en alle drie moeten kloppen:
 *   1. er staat een testtoken in de env;
 *   2. we draaien niet op Vercel (`VERCEL` is daar altijd gezet);
 *   3. dit is geen voorbeeldversie.
 *
 * AC-T5 schrijft `NODE_ENV !== "production"` voor. Dat is niet te meten: `next start` zet NODE_ENV
 * altijd op "production", ook op deze laptop, en de MCP-route werkt alleen in een productiebouw
 * (de dev-server geeft 404 op `/api/mcp/` door `trailingSlash`). `VERCEL` is de betrouwbare vraag:
 * draait dit als echte deployment? Op de demo staat die aan, dus daar geeft het testtoken 401 —
 * precies wat AC-T5 wil bewijzen. Zie BESLUITEN.md B15.
 */
export function testtokenActief(): string | null {
  if (process.env.VERCEL) return null;
  if (process.env.NEXT_PUBLIC_DEMO === "1") return null;
  const t = process.env.KOPPELING_TESTTOKEN;
  return t && t.length >= 8 ? t : null;
}

export function isTesttoken(token: string | undefined | null): boolean {
  const t = testtokenActief();
  if (!t || !token || token.length !== t.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(t));
}

/*
 * Kleine ondertekende pakketjes, voor de tussenstappen van het inloggen: de state die naar GitHub
 * meegaat en de autorisatiecode die we zelf uitgeven. Zo hoeft er niets bewaard te worden tussen
 * twee verzoeken — handig op een omgeving zonder eigen opslag, en er valt ook niets te lekken.
 */
export function ondertekenPakket(doel: string, data: unknown, seconden: number): string {
  const inhoud = { doel, data, verlooptOp: Math.floor(Date.now() / 1000) + seconden };
  const lichaam = b64(Buffer.from(JSON.stringify(inhoud), "utf8"));
  const handtekening = b64(createHmac("sha256", geheim()).update(`${doel}.${lichaam}`).digest());
  return `${lichaam}.${handtekening}`;
}

export function leesPakket<T>(doel: string, pakket: string | undefined | null): T | null {
  if (!pakket) return null;
  const [lichaam, handtekening] = pakket.split(".");
  if (!lichaam || !handtekening) return null;
  let verwacht: Buffer;
  try {
    verwacht = createHmac("sha256", geheim()).update(`${doel}.${lichaam}`).digest();
  } catch {
    return null;
  }
  const gegeven = vanB64(handtekening);
  if (gegeven.length !== verwacht.length || !timingSafeEqual(gegeven, verwacht)) return null;
  try {
    const inhoud = JSON.parse(vanB64(lichaam).toString("utf8")) as { doel: string; data: T; verlooptOp: number };
    if (inhoud.doel !== doel) return null;
    if (inhoud.verlooptOp * 1000 < Date.now()) return null;
    return inhoud.data;
  } catch {
    return null;
  }
}

/** PKCE: de code_challenge die bij een code_verifier hoort (S256). */
export function pkceUitdaging(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
