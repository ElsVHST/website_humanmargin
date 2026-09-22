import { publiekeBasis } from "@/lib/koppeling/basis";

/*
 * RFC 8414 — wat deze site als inlogserver aanbiedt (AC-T1, AC-T2).
 *
 * Deze site is haar eigen inlogserver, maar vraagt de identiteit op bij GitHub: wie daar inlogt en
 * op de toegangslijst staat, krijgt een token voor de MCP-route. Alleen Authorization Code met
 * PKCE (S256); er is geen andere manier om binnen te komen.
 *
 * Client ID Metadata Documents (CIMD) staat aan; Dynamic Client Registration bewust niet, want de
 * spec van 2026-07-28 noemt die "deprecated" (zie BESLUITEN.md B13).
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const basis = publiekeBasis(request);
  return Response.json(
    {
      issuer: basis,
      authorization_endpoint: `${basis}/api/oauth/authorize`,
      token_endpoint: `${basis}/api/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["site:lezen", "site:voorstellen", "site:publiceren"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${basis}/`,
    },
    { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}
