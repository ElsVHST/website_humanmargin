import { leesPakket, magBinnen, maakToken, pkceUitdaging, TOKEN_LEVENSDUUR_DAGEN } from "@/lib/koppeling/toegang";

/*
 * Stap 3 van het inloggen (AC-T2, AC-T4): de client ruilt zijn code in voor een token.
 * De code is alleen geldig met de `code_verifier` die bij de `code_challenge` hoort (PKCE), en de
 * gebruiker moet op dat moment nog steeds op de toegangslijst staan.
 */
export const dynamic = "force-dynamic";

type Code = { gebruiker: string; uitdaging: string; redirect: string; clientId: string; bron: string };

const fout = (code: string, uitleg: string, status = 400) =>
  Response.json({ error: code, error_description: uitleg }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  let velden: URLSearchParams;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    velden = new URLSearchParams(Object.entries((await request.json()) as Record<string, string>));
  } else {
    velden = new URLSearchParams(await request.text());
  }

  if (velden.get("grant_type") !== "authorization_code") return fout("unsupported_grant_type", "Alleen authorization_code wordt ondersteund.");
  const code = leesPakket<Code>("oauth-code", velden.get("code"));
  if (!code) return fout("invalid_grant", "De code is verlopen of niet geldig.");

  const verifier = velden.get("code_verifier");
  if (!verifier || pkceUitdaging(verifier) !== code.uitdaging) return fout("invalid_grant", "De code_verifier hoort niet bij deze code.");

  const redirect = velden.get("redirect_uri");
  if (redirect && redirect !== code.redirect) return fout("invalid_grant", "De redirect_uri komt niet overeen.");
  if (!magBinnen(code.gebruiker)) return fout("access_denied", "Dit account staat niet (meer) op de lijst.", 403);

  return Response.json(
    {
      access_token: maakToken(code.gebruiker, code.bron),
      token_type: "Bearer",
      expires_in: TOKEN_LEVENSDUUR_DAGEN * 24 * 3600,
      scope: "site:lezen site:voorstellen site:publiceren",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
