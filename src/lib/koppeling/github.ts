import "server-only";
import { createSign } from "node:crypto";

/*
 * De gitkant van de koppeling: één dunne laag over de REST-API van GitHub.
 *
 * Tijdens het bouwen en testen wijst `GITHUB_API_BASIS` naar een nagebootste GitHub op deze
 * machine (qa/nagebootste-github.mjs) met een echte lokale repo erachter. Dezelfde code praat
 * daarmee als met de echte: zo test je de koppeling en niet een aparte testversie ervan.
 *
 * Schrijven gaat met een installatietoken van de GitHub App "Human Margin sitebeheer". Dat token
 * leeft een uur en wordt hier gemaakt uit de app-sleutel; de sleutel zelf staat alleen in de env.
 */

const API = () => (process.env.GITHUB_API_BASIS ?? "https://api.github.com").replace(/\/$/, "");
export const repoNaam = () => process.env.KOPPELING_REPO ?? "ElsVHST/website_humanmargin";
export const publicatietak = () => process.env.PUBLICATIETAK ?? "eerste-versie";

let tokenCache: { token: string; tot: number } | null = null;

function appJwt(): string {
  const id = process.env.GITHUB_APP_ID;
  const sleutel = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!id || !sleutel) throw new Error("De GitHub App is niet ingesteld (GITHUB_APP_ID of GITHUB_APP_PRIVATE_KEY ontbreekt).");
  const nu = Math.floor(Date.now() / 1000);
  const kop = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const inhoud = Buffer.from(JSON.stringify({ iat: nu - 60, exp: nu + 540, iss: id })).toString("base64url");
  const handtekening = createSign("RSA-SHA256").update(`${kop}.${inhoud}`).sign(sleutel).toString("base64url");
  return `${kop}.${inhoud}.${handtekening}`;
}

async function schrijfToken(): Promise<string> {
  // Een vast token (de nagebootste GitHub, of een testopstelling) gaat voor.
  const vast = process.env.GITHUB_TOKEN_VAST;
  if (vast) return vast;
  if (tokenCache && tokenCache.tot > Date.now() + 60000) return tokenCache.token;

  const installatie = process.env.GITHUB_APP_INSTALLATIE_ID;
  if (!installatie) throw new Error("De GitHub App is nog niet op de repo geïnstalleerd (GITHUB_APP_INSTALLATIE_ID ontbreekt).");
  const r = await fetch(`${API()}/app/installations/${installatie}/access_tokens`, {
    method: "POST",
    headers: { authorization: `Bearer ${appJwt()}`, accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`GitHub gaf geen schrijfrecht (${r.status}).`);
  const uit = (await r.json()) as { token: string; expires_at: string };
  tokenCache = { token: uit.token, tot: new Date(uit.expires_at).getTime() };
  return uit.token;
}

async function vraag<T>(pad: string, opties: { methode?: string; lichaam?: unknown; mag404?: boolean } = {}): Promise<T | null> {
  const token = await schrijfToken();
  const r = await fetch(`${API()}${pad}`, {
    method: opties.methode ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "human-margin-sitebeheer",
    },
    body: opties.lichaam === undefined ? undefined : JSON.stringify(opties.lichaam),
  });
  if (r.status === 404 && opties.mag404) return null;
  if (!r.ok) {
    const tekst = await r.text();
    // Nooit het token in een melding; alleen wat GitHub zelf zegt.
    throw new Error(`GitHub antwoordde met ${r.status}: ${tekst.slice(0, 200)}`);
  }
  if (r.status === 204) return null;
  return (await r.json()) as T;
}

export type Bestand = { pad: string; inhoud: Buffer | string };

export async function hashVanTak(tak: string): Promise<string | null> {
  const r = await vraag<{ object: { sha: string } }>(`/repos/${repoNaam()}/git/ref/heads/${encodeURIComponent(tak)}`, { mag404: true });
  return r?.object?.sha ?? null;
}

export async function maakTak(tak: string, vanaf: string): Promise<void> {
  await vraag(`/repos/${repoNaam()}/git/refs`, { methode: "POST", lichaam: { ref: `refs/heads/${tak}`, sha: vanaf } });
}

export async function verwijderTak(tak: string): Promise<void> {
  await vraag(`/repos/${repoNaam()}/git/refs/heads/${encodeURIComponent(tak)}`, { methode: "DELETE", mag404: true });
}

export async function takken(): Promise<string[]> {
  const r = (await vraag<{ name: string }[]>(`/repos/${repoNaam()}/branches?per_page=100`)) ?? [];
  return r.map((b) => b.name);
}

export async function leesBestand(pad: string, tak: string): Promise<{ tekst: string; sha: string } | null> {
  const r = await vraag<{ content: string; encoding: string; sha: string }>(`/repos/${repoNaam()}/contents/${pad}?ref=${encodeURIComponent(tak)}`, { mag404: true });
  if (!r) return null;
  return { tekst: Buffer.from(r.content, (r.encoding as BufferEncoding) ?? "base64").toString("utf8"), sha: r.sha };
}

export async function schrijfBestand(pad: string, inhoud: Buffer | string, tak: string, boodschap: string, auteur = "Els via ChatGPT"): Promise<string> {
  const bestaand = await vraag<{ sha: string }>(`/repos/${repoNaam()}/contents/${pad}?ref=${encodeURIComponent(tak)}`, { mag404: true });
  const r = await vraag<{ commit: { sha: string } }>(`/repos/${repoNaam()}/contents/${pad}`, {
    methode: "PUT",
    lichaam: {
      message: boodschap,
      content: Buffer.isBuffer(inhoud) ? inhoud.toString("base64") : Buffer.from(inhoud, "utf8").toString("base64"),
      branch: tak,
      ...(bestaand ? { sha: bestaand.sha } : {}),
      committer: { name: auteur, email: "sitebeheer@humanmargin.eu" },
      author: { name: auteur, email: "sitebeheer@humanmargin.eu" },
    },
  });
  return r?.commit?.sha ?? "";
}

export async function voegSamen(van: string, naar: string, boodschap: string): Promise<string> {
  const r = await vraag<{ sha: string }>(`/repos/${repoNaam()}/merges`, { methode: "POST", lichaam: { base: naar, head: van, commit_message: boodschap } });
  return r?.sha ?? "";
}

export type Commit = { sha: string; datum: string; boodschap: string };

export async function commits(tak: string, hoeveel = 20): Promise<Commit[]> {
  const r = (await vraag<{ sha: string; commit: { message: string; committer: { date: string } } }[]>(`/repos/${repoNaam()}/commits?sha=${encodeURIComponent(tak)}&per_page=${hoeveel}`)) ?? [];
  return r.map((c) => ({ sha: c.sha, datum: c.commit.committer.date, boodschap: c.commit.message }));
}

/** De voorbeeldlink die Vercel bij een tak heeft gemeld, of null als hij er nog niet is. */
export async function voorbeeldlink(tak: string): Promise<string | null> {
  const deploys = (await vraag<{ id: number; ref: string; environment: string }[]>(`/repos/${repoNaam()}/deployments?ref=${encodeURIComponent(tak)}&per_page=5`)) ?? [];
  for (const d of deploys) {
    const standen = (await vraag<{ state: string; environment_url?: string; target_url?: string }[]>(`/repos/${repoNaam()}/deployments/${d.id}/statuses?per_page=10`)) ?? [];
    const klaar = standen.find((s) => s.state === "success" && (s.environment_url || s.target_url));
    if (klaar) return (klaar.environment_url ?? klaar.target_url ?? "").replace(/\/$/, "");
  }
  return null;
}

export type CommitDetails = { sha: string; ouders: string[]; bestanden: string[] };

/** Wat er in één commit veranderde, en waar hij vandaan kwam — nodig om terug te kunnen draaien. */
export async function commitDetails(sha: string): Promise<CommitDetails | null> {
  const r = await vraag<{ sha: string; parents: { sha: string }[]; files?: { filename: string }[] }>(`/repos/${repoNaam()}/commits/${encodeURIComponent(sha)}`, { mag404: true });
  if (!r) return null;
  return { sha: r.sha, ouders: (r.parents ?? []).map((p) => p.sha), bestanden: (r.files ?? []).map((f) => f.filename) };
}

export async function verwijderBestand(pad: string, tak: string, boodschap: string): Promise<string> {
  const bestaand = await vraag<{ sha: string }>(`/repos/${repoNaam()}/contents/${pad}?ref=${encodeURIComponent(tak)}`, { mag404: true });
  if (!bestaand) return "";
  const r = await vraag<{ commit: { sha: string } }>(`/repos/${repoNaam()}/contents/${pad}`, {
    methode: "DELETE",
    lichaam: { message: boodschap, branch: tak, sha: bestaand.sha },
  });
  return r?.commit?.sha ?? "";
}
