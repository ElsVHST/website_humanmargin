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

/**
 * Mag de code naar dit adres terug? (AC-T2, gevonden door de beta-tester 22-09.)
 *
 * Zonder deze vraag accepteert de inlogstap élk https-adres: iemand kan dan het client_id van
 * ChatGPT gebruiken en de code bij zichzelf laten landen.
 *
 * Is het client_id een https-adres (Client ID Metadata Document), dan halen we dat document op en
 * moet de redirect erin staan. Lukt ophalen niet, dan geldt de regel dat de redirect op dezelfde
 * host moet staan als het client_id zelf — dat is wat CIMD sowieso vereist. Is het client_id geen
 * adres (vaste inloggegevens), dan telt de lijst uit `OAUTH_TOEGESTANE_REDIRECTS`.
 */
async function magHierheen(clientId: string, doel: URL): Promise<boolean> {
  if (doel.hostname === "localhost" || doel.hostname === "127.0.0.1") return true;

  let client: URL | null = null;
  try {
    const u = new URL(clientId);
    if (u.protocol === "https:") client = u;
  } catch {
    /* geen adres: vaste inloggegevens */
  }

  if (client) {
    try {
      const r = await fetch(client.toString(), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const doc = (await r.json()) as { redirect_uris?: string[] };
        if (Array.isArray(doc.redirect_uris)) return doc.redirect_uris.includes(doel.toString());
      }
    } catch {
      /* niet op te halen: dan de hostregel hieronder */
    }
    return doel.hostname === client.hostname;
  }

  const toegestaan = (process.env.OAUTH_TOEGESTANE_REDIRECTS ?? "https://chatgpt.com/,https://chat.openai.com/")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return toegestaan.some((voorvoegsel) => doel.toString().startsWith(voorvoegsel));
}

export async function GET(request: Request) {
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
  if (!(await magHierheen(clientId, doel))) {
    return fout("Deze redirect_uri hoort niet bij deze client.", 403);
  }

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
