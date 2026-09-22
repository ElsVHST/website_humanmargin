import { mcpAdres, publiekeBasis } from "@/lib/koppeling/basis";
import { ondertekenPakket } from "@/lib/koppeling/toegang";

/*
 * Stap 1 van het inloggen (AC-T2): de client stuurt de gebruiker hierheen, wij sturen hem door naar
 * GitHub. Wat de client meegaf bewaren we niet in een database maar in een ondertekende `state` die
 * met GitHub meereist; de callback leest hem terug.
 *
 * PKCE is verplicht: zonder `code_challenge` met S256 komt er geen code. Zo kan een onderschepte
 * code niets uitrichten.
 */
export const dynamic = "force-dynamic";

const fout = (melding: string, status = 400) =>
  new Response(`${melding}\n`, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export function GET(request: Request) {
  const basis = publiekeBasis(request);
  const v = new URL(request.url).searchParams;
  const clientId = v.get("client_id") ?? "";
  const redirect = v.get("redirect_uri") ?? "";
  const uitdaging = v.get("code_challenge") ?? "";
  const methode = v.get("code_challenge_method") ?? "";

  if (v.get("response_type") !== "code") return fout("Alleen response_type=code wordt ondersteund.");
  if (!clientId) return fout("client_id ontbreekt.");
  if (!uitdaging || methode !== "S256") return fout("PKCE met code_challenge_method=S256 is verplicht.");

  let doel: URL;
  try {
    doel = new URL(redirect);
  } catch {
    return fout("redirect_uri ontbreekt of is geen geldig adres.");
  }
  // Alleen https, of localhost tijdens het bouwen. Een ander schema zou een omweg zijn om een code
  // ergens anders te laten landen.
  const lokaal = doel.hostname === "localhost" || doel.hostname === "127.0.0.1";
  if (doel.protocol !== "https:" && !lokaal) return fout("redirect_uri moet https zijn.");

  const github = process.env.GITHUB_APP_CLIENT_ID;
  if (!github) return fout("Deze site is nog niet aan GitHub gekoppeld.", 503);

  const state = ondertekenPakket(
    "oauth-state",
    { redirect: doel.toString(), state: v.get("state") ?? "", uitdaging, clientId, bron: v.get("resource") ?? mcpAdres(basis) },
    600,
  );

  const naarGithub = new URL("https://github.com/login/oauth/authorize");
  naarGithub.searchParams.set("client_id", github);
  naarGithub.searchParams.set("redirect_uri", `${basis}/api/oauth/callback`);
  naarGithub.searchParams.set("state", state);
  return Response.redirect(naarGithub.toString(), 302);
}
