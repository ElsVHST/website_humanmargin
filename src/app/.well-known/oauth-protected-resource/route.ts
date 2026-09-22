import { mcpAdres, publiekeBasis } from "@/lib/koppeling/basis";

/*
 * RFC 9728 — waar een client de inlogserver van deze MCP-route kan vinden (AC-T1).
 * De 401 van de MCP-route wijst met `WWW-Authenticate` naar dit adres.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const basis = publiekeBasis(request);
  return Response.json(
    {
      resource: mcpAdres(basis),
      authorization_servers: [basis],
      bearer_methods_supported: ["header"],
      resource_name: "Human Margin — sitebeheer",
      resource_documentation: `${basis}/`,
      scopes_supported: ["site:lezen", "site:voorstellen", "site:publiceren"],
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
      "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
    },
  });
}
