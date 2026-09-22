import "server-only";
import { siteUrl } from "@/lib/content";

/*
 * Op welk adres draait deze route op dít moment?
 *
 * `NEXT_PUBLIC_SITE_URL` wordt bij de bouw ingebakken en staat dus vast op wat de site straks
 * wordt. Voor de inlogstappen klopt dat niet: een voorbeeldlink van Vercel heeft elke keer een
 * ander adres, en lokaal is het localhost. De metadata en het token moeten over hetzelfde adres
 * gaan als waar de client binnenkomt, anders wijst de ene kant naar de andere en klopt het niet.
 *
 * Daarom: het adres uit het verzoek, met de koppen van de proxy erbij, en pas als laatste terugval
 * het ingebakken adres.
 */
/**
 * Welke hosts we van onszelf zijn. `x-forwarded-host` komt van buiten: wie dat blind overneemt,
 * laat een vreemde bepalen welk adres er in de metadata en in de `WWW-Authenticate`-kop staat, en
 * dus waar een client zijn token naartoe stuurt. Gevonden door de beta-tester, 22-09.
 */
function eigenHosts(): Set<string> {
  const uit = new Set<string>(["localhost", "127.0.0.1"]);
  for (const adres of [siteUrl(), process.env.PUBLICATIE_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (!adres) continue;
    try {
      uit.add(new URL(adres.startsWith("http") ? adres : `https://${adres}`).hostname);
    } catch {
      /* geen bruikbaar adres */
    }
  }
  for (const extra of (process.env.EIGEN_HOSTS ?? "").split(",")) {
    const h = extra.trim();
    if (h) uit.add(h);
  }
  return uit;
}

export function publiekeBasis(request: Request): string {
  const koppen = request.headers;
  const host = koppen.get("x-forwarded-host") ?? koppen.get("host");
  if (host) {
    const naam = host.split(":")[0];
    const bekend = eigenHosts();
    // Een onbekende host is geen fout van de client maar een poging tot omleiden: dan geldt het
    // adres dat bij de bouw is meegegeven.
    if (bekend.has(naam)) {
      const schema = koppen.get("x-forwarded-proto") ?? (naam === "localhost" || naam === "127.0.0.1" ? "http" : "https");
      return `${schema}://${host}`.replace(/\/$/, "");
    }
    return siteUrl();
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return siteUrl();
  }
}

/** Het adres van de MCP-route zelf: waar een token voor geldig is (RFC 8707). */
export const mcpAdres = (basis: string) => `${basis}/api/mcp/`;
