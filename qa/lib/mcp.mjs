/**
 * Een kleine MCP-client over Streamable HTTP, met de hand geschreven.
 *
 * Waarom met de hand: het testprogramma moet de draad over de lijn controleren, niet dezelfde
 * bibliotheek als de server. Draait de test op de officiële client, dan toetst hij vooral of die
 * client met zichzelf overweg kan.
 *
 * Een antwoord komt binnen als `application/json` of als een SSE-stroom (`text/event-stream`);
 * beide worden hier tot één JSON-RPC-antwoord teruggebracht.
 */

let teller = 0;

function leesSse(tekst) {
  // Elke gebeurtenis is een blok regels; wij willen de laatste `data:` met een JSON-RPC-antwoord.
  const antwoorden = [];
  for (const blok of tekst.split(/\n\n/)) {
    const data = blok
      .split("\n")
      .filter((r) => r.startsWith("data:"))
      .map((r) => r.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      antwoorden.push(JSON.parse(data));
    } catch {
      /* geen JSON: overslaan */
    }
  }
  return antwoorden;
}

export class McpClient {
  constructor(url, { token, naam = "koppeling-test" } = {}) {
    this.url = url;
    this.token = token;
    this.naam = naam;
    this.sessie = null;
    this.laatsteAntwoord = null;
  }

  async stuur(methode, params, { verwachtFout = false } = {}) {
    const id = ++teller;
    const koppen = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (this.token) koppen.authorization = `Bearer ${this.token}`;
    if (this.sessie) koppen["mcp-session-id"] = this.sessie;

    const r = await fetch(this.url, {
      method: "POST",
      headers: koppen,
      body: JSON.stringify({ jsonrpc: "2.0", id, method: methode, params }),
    });
    this.laatsteAntwoord = r;
    const sessie = r.headers.get("mcp-session-id");
    if (sessie) this.sessie = sessie;

    if (r.status === 401) {
      const fout = new Error("401");
      fout.status = 401;
      fout.wwwAuthenticate = r.headers.get("www-authenticate");
      throw fout;
    }
    const type = r.headers.get("content-type") ?? "";
    const tekst = await r.text();
    const antwoorden = type.includes("text/event-stream") ? leesSse(tekst) : [JSON.parse(tekst || "{}")];
    const antwoord = antwoorden.find((a) => a.id === id) ?? antwoorden[antwoorden.length - 1];
    if (antwoord?.error && !verwachtFout) {
      const fout = new Error(antwoord.error.message ?? "fout van de server");
      fout.rpc = antwoord.error;
      throw fout;
    }
    return antwoord;
  }

  async verbind() {
    const a = await this.stuur("initialize", {
      protocolVersion: "2026-07-28",
      capabilities: {},
      clientInfo: { name: this.naam, version: "1.0.0" },
    });
    // De melding dat de client klaar is hoort erbij; zonder die melding weigeren sommige servers.
    await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(this.sessie ? { "mcp-session-id": this.sessie } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => undefined);
    return a.result;
  }

  async tools() {
    const a = await this.stuur("tools/list", {});
    return a.result?.tools ?? [];
  }

  async roep(naam, argumenten = {}, opties = {}) {
    const a = await this.stuur("tools/call", { name: naam, arguments: argumenten }, opties);
    return a.result ?? a.error;
  }
}

/** De tekst uit een tool-antwoord, of "" als er geen tekst in zit. */
export function tekstUit(resultaat) {
  if (!resultaat) return "";
  if (typeof resultaat === "string") return resultaat;
  const delen = resultaat.content ?? [];
  return delen
    .filter((d) => d.type === "text")
    .map((d) => d.text)
    .join("\n");
}
