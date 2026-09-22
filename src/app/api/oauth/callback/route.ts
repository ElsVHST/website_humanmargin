import { publiekeBasis } from "@/lib/koppeling/basis";
import { leesPakket, magBinnen, ondertekenPakket } from "@/lib/koppeling/toegang";

/*
 * Stap 2 van het inloggen (AC-T2, AC-T3): GitHub stuurt de gebruiker hier terug. Wij ruilen de code
 * bij GitHub in voor een kort token, vragen wie het is, en kijken of die naam op de toegangslijst
 * staat. Staat hij er niet op — of is de lijst leeg — dan krijgt hij geen code en dus geen token.
 *
 * Het GitHub-token wordt alleen gebruikt om de naam op te halen en daarna weggegooid.
 */
export const dynamic = "force-dynamic";

type State = { redirect: string; state: string; uitdaging: string; clientId: string; bron: string };

const pagina = (titel: string, uitleg: string, status: number) =>
  new Response(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${titel}</title>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">` +
      `<style>body{background:#111010;color:#f4f4f1;font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;padding:2rem}` +
      `main{max-width:32rem}h1{font-size:1.5rem;margin:0 0 .75rem}p{margin:0;color:#dddDd3}</style></head>` +
      `<body><main><h1>${titel}</h1><p>${uitleg}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

export async function GET(request: Request) {
  const basis = publiekeBasis(request);
  const v = new URL(request.url).searchParams;
  const state = leesPakket<State>("oauth-state", v.get("state"));
  if (!state) return pagina("Inloggen mislukt", "De aanvraag is verlopen of hoort niet bij deze site. Probeer het opnieuw vanuit ChatGPT.", 400);

  const code = v.get("code");
  if (!code) return pagina("Inloggen mislukt", "GitHub gaf geen code terug.", 400);

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const geheim = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!clientId || !geheim) return pagina("Nog niet gekoppeld", "Deze site is nog niet aan GitHub gekoppeld.", 503);

  let gebruiker: string | undefined;
  try {
    const ruil = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: geheim, code, redirect_uri: `${basis}/api/oauth/callback` }),
    });
    const uitslag = (await ruil.json()) as { access_token?: string };
    if (!uitslag.access_token) return pagina("Inloggen mislukt", "GitHub wilde de aanmelding niet afronden.", 400);
    const wie = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${uitslag.access_token}`, accept: "application/vnd.github+json" },
    });
    gebruiker = ((await wie.json()) as { login?: string }).login;
  } catch {
    return pagina("Inloggen mislukt", "GitHub was even niet bereikbaar. Probeer het zo nog eens.", 502);
  }

  if (!magBinnen(gebruiker)) {
    // Geen code, geen token. De naam noemen we wel, zodat Lars weet wie hij moet toevoegen.
    return pagina("Geen toegang tot deze site", `Het account ${gebruiker ?? "onbekend"} staat niet op de lijst van mensen die deze site mogen beheren.`, 403);
  }

  const onzeCode = ondertekenPakket("oauth-code", { gebruiker, uitdaging: state.uitdaging, redirect: state.redirect, clientId: state.clientId, bron: state.bron }, 300);
  const terug = new URL(state.redirect);
  terug.searchParams.set("code", onzeCode);
  if (state.state) terug.searchParams.set("state", state.state);
  terug.searchParams.set("iss", basis);
  return Response.redirect(terug.toString(), 302);
}
