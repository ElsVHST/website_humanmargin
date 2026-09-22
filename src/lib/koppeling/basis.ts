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
export function publiekeBasis(request: Request): string {
  const koppen = request.headers;
  const host = koppen.get("x-forwarded-host") ?? koppen.get("host");
  if (host) {
    const schema = koppen.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${schema}://${host}`.replace(/\/$/, "");
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return siteUrl();
  }
}

/** Het adres van de MCP-route zelf: waar een token voor geldig is (RFC 8707). */
export const mcpAdres = (basis: string) => `${basis}/api/mcp/`;
