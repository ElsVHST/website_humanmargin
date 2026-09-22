#!/usr/bin/env node
/**
 * Een nagebootste GitHub voor de controlereeks (PRD-002 §2.2).
 *
 * Dezelfde endpoints als de echte, met een echte git-repo erachter — maar op deze machine, zodat
 * K0 t/m K4 te bewijzen zijn zonder ook maar één commit naar GitHub te sturen. De koppeling praat
 * met dit ding via GITHUB_API_BASIS; er is geen aparte testversie van de koppelingscode.
 *
 * Wat hij naspeelt:
 *   refs lezen, maken en verwijderen · takken opsommen · een bestand lezen en schrijven (met een
 *   commit) · takken samenvoegen · de geschiedenis · en de deployments waaruit de koppeling haar
 *   voorbeeldlinks haalt.
 *
 * De voorbeeldlink is echt: bij het eerste bezoek bouwt hij die tak en zet er een server op. Dat
 * duurt een seconde of vijf, precies zoals een preview op Vercel even duurt.
 *
 *   node qa/nagebootste-github.mjs --poort 4800 [--repo <map>]
 */
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vrijePoort } from "./lib/vrij.mjs";

const args = process.argv.slice(2);
const vlag = (n, s) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : s;
};

const POORT = Number(vlag("--poort", process.env.NAGEBOOTSTE_GITHUB_POORT ?? "4800"));
const REPO = vlag("--repo", join(tmpdir(), "hm-nagebootst.git"));
const TAK = process.env.PUBLICATIETAK ?? "eerste-versie";
const PROJECT = process.cwd();
/** Wat de koppeling mag raken — en dus wat deze repo bijhoudt. */
const MAPPEN = ["content", join("public", "media")];

const git = (argumenten, opties = {}) =>
  execFileSync("git", ["--git-dir", REPO, ...argumenten], { encoding: "utf8", ...opties, env: { ...process.env, GIT_AUTHOR_NAME: "controlereeks", GIT_AUTHOR_EMAIL: "qa@humanmargin.eu", GIT_COMMITTER_NAME: "controlereeks", GIT_COMMITTER_EMAIL: "qa@humanmargin.eu", ...(opties.env ?? {}) } }).trim();

/* ── De repo klaarzetten ─────────────────────────────────────────────────────────────────── */
function zetKlaar() {
  rmSync(REPO, { recursive: true, force: true });
  execFileSync("git", ["init", "--bare", "--initial-branch", "main", REPO], { stdio: "pipe" });
  const werk = mkdtempSync(join(tmpdir(), "hm-zaai-"));
  for (const map of MAPPEN) {
    if (existsSync(join(PROJECT, map))) cpSync(join(PROJECT, map), join(werk, map), { recursive: true });
  }
  const index = join(werk, ".git-index");
  const omgeving = { GIT_INDEX_FILE: index, GIT_WORK_TREE: werk };
  git(["add", "-A", "."], { cwd: werk, env: omgeving });
  const boom = git(["write-tree"], { cwd: werk, env: omgeving });
  const commit = git(["commit-tree", boom, "-m", "de inhoud van de site, zoals hij nu is"], { cwd: werk, env: omgeving });
  git(["update-ref", `refs/heads/${TAK}`, commit]);
  git(["update-ref", "refs/heads/main", commit]);
  rmSync(werk, { recursive: true, force: true });
  return commit;
}

/* ── Git-handelingen ─────────────────────────────────────────────────────────────────────── */
const hashVan = (ref) => {
  try {
    return git(["rev-parse", `refs/heads/${ref}`]);
  } catch {
    return null;
  }
};

const leesBestand = (ref, pad) => {
  try {
    return execFileSync("git", ["--git-dir", REPO, "show", `${ref}:${pad}`], { maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
};

function schrijfBestand(tak, pad, inhoud, boodschap) {
  const ouder = hashVan(tak);
  if (!ouder) throw new Error(`tak ${tak} bestaat niet`);
  const index = join(tmpdir(), `hm-index-${process.pid}-${Date.now()}`);
  const omgeving = { GIT_INDEX_FILE: index };
  git(["read-tree", ouder], { env: omgeving });
  const blob = execFileSync("git", ["--git-dir", REPO, "hash-object", "-w", "--stdin"], { input: inhoud, encoding: "utf8" }).trim();
  git(["update-index", "--add", "--cacheinfo", `100644,${blob},${pad}`], { env: omgeving });
  const boom = git(["write-tree"], { env: omgeving });
  const commit = git(["commit-tree", boom, "-p", ouder, "-m", boodschap]);
  git(["update-ref", `refs/heads/${tak}`, commit, ouder]);
  rmSync(index, { force: true });
  return commit;
}

function verwijderBestand(tak, pad, boodschap) {
  const ouder = hashVan(tak);
  if (!ouder) throw new Error(`tak ${tak} bestaat niet`);
  const index = join(tmpdir(), `hm-index-${process.pid}-${Date.now()}`);
  const omgeving = { GIT_INDEX_FILE: index };
  git(["read-tree", ouder], { env: omgeving });
  git(["update-index", "--force-remove", pad], { env: omgeving });
  const boom = git(["write-tree"], { env: omgeving });
  const commit = git(["commit-tree", boom, "-p", ouder, "-m", boodschap]);
  git(["update-ref", `refs/heads/${tak}`, commit, ouder]);
  rmSync(index, { force: true });
  return commit;
}

function voegSamen(basis, hoofd, boodschap) {
  const basisHash = hashVan(basis);
  const hoofdHash = hashVan(hoofd);
  if (!basisHash || !hoofdHash) throw new Error("tak bestaat niet");
  // Staat de publicatietak nog waar het voorstel vandaan kwam, dan is samenvoegen alleen de wijzer
  // verzetten. Is hij ondertussen verder, dan laat git de bomen samengaan — en botst het, dan
  // hoort dat een nette melding te worden, geen halve commit.
  const vooruit = (() => {
    try {
      git(["merge-base", "--is-ancestor", basisHash, hoofdHash]);
      return true;
    } catch {
      return false;
    }
  })();
  if (vooruit) {
    git(["update-ref", `refs/heads/${basis}`, hoofdHash, basisHash]);
    return hoofdHash;
  }
  let boom;
  try {
    boom = git(["merge-tree", "--write-tree", basisHash, hoofdHash]).split("\n")[0];
  } catch {
    throw new Error("Deze wijziging botst met iets wat ondertussen gepubliceerd is.");
  }
  const commit = git(["commit-tree", boom, "-p", basisHash, "-p", hoofdHash, "-m", boodschap]);
  git(["update-ref", `refs/heads/${basis}`, commit, basisHash]);
  return commit;
}

/* ── De voorbeeldlinks: echt bouwen, per tak ─────────────────────────────────────────────── */
const voorbeelden = new Map(); // tak → { poort, proces, hash }

async function zorgVoorVoorbeeld(tak) {
  const hash = hashVan(tak);
  if (!hash) return null;
  const bestaand = voorbeelden.get(tak);
  if (bestaand && bestaand.hash === hash) return bestaand;
  if (bestaand) {
    bestaand.proces.kill("SIGTERM");
    voorbeelden.delete(tak);
  }

  // De inhoud van deze tak tijdelijk in het project zetten, bouwen, en meteen terugdraaien.
  const bewaard = mkdtempSync(join(tmpdir(), "hm-bewaar-"));
  for (const map of MAPPEN) if (existsSync(join(PROJECT, map))) cpSync(join(PROJECT, map), join(bewaard, map), { recursive: true });
  const dist = `.next-vb-${tak.replace(/[^a-z0-9]/gi, "-")}`;
  let poort;
  try {
    for (const map of MAPPEN) rmSync(join(PROJECT, map), { recursive: true, force: true });
    // Via een archief, niet via checkout: een bare repo heeft geen index om bij te werken.
    const tarball = execFileSync("git", ["--git-dir", REPO, "archive", tak, ...MAPPEN], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync("tar", ["-x", "-C", PROJECT], { input: tarball });
    execFileSync("npx", ["next", "build"], { cwd: PROJECT, stdio: "pipe", env: { ...process.env, NEXT_DIST_DIR: dist } });
  } finally {
    for (const map of MAPPEN) {
      rmSync(join(PROJECT, map), { recursive: true, force: true });
      if (existsSync(join(bewaard, map))) cpSync(join(bewaard, map), join(PROJECT, map), { recursive: true });
    }
    rmSync(bewaard, { recursive: true, force: true });
  }
  poort = await vrijePoort();
  const proces = spawn("npx", ["next", "start", "-p", String(poort)], { cwd: PROJECT, stdio: "ignore", env: { ...process.env, NEXT_DIST_DIR: dist } });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      if ((await fetch(`http://localhost:${poort}/`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {
      /* nog niet op */
    }
  }
  const nieuw = { poort, proces, hash, dist };
  voorbeelden.set(tak, nieuw);
  return nieuw;
}

/* ── De server ───────────────────────────────────────────────────────────────────────────── */
const json = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const lees = (req) =>
  new Promise((klaar) => {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", () => {
      try {
        klaar(b ? JSON.parse(b) : {});
      } catch {
        klaar({});
      }
    });
  });

zetKlaar();
console.log(`nagebootste GitHub op http://localhost:${POORT} · repo ${REPO} · tak ${TAK}`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${POORT}`);
  const pad = decodeURIComponent(url.pathname);
  try {
    /* De voorbeeldlink: alles doorgeven aan de gebouwde versie van die tak.
       Let op: hier tellen de ónvertaalde tekens. Een taknaam bevat een schuine streep, en die
       staat in de link als %2F; wie eerst decodeert, knipt de taknaam doormidden. */
    const vb = /^\/voorbeeld\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (vb) {
      const tak = decodeURIComponent(vb[1]);
      const draait = await zorgVoorVoorbeeld(tak);
      if (!draait) return json(res, 404, { message: "die tak bestaat niet" });
      const door = await fetch(`http://localhost:${draait.poort}${vb[2] ?? "/"}${url.search}`, { redirect: "follow" });
      const lichaam = Buffer.from(await door.arrayBuffer());
      res.writeHead(door.status, { "content-type": door.headers.get("content-type") ?? "text/html" });
      return res.end(lichaam);
    }

    /* Een testbestand serveren, zodat een fotoproef een echt adres heeft om van te halen. */
    const tb = /^\/testbestand\/([\w.-]+)$/.exec(pad);
    if (tb) {
      const bestand = join(PROJECT, "qa", "uitvoer", "testbestanden", tb[1]);
      if (!existsSync(bestand)) return json(res, 404, { message: "geen testbestand" });
      const inhoud = readFileSync(bestand);
      res.writeHead(200, { "content-type": tb[1].endsWith(".svg") ? "image/svg+xml" : "image/jpeg", "content-length": inhoud.length });
      return res.end(inhoud);
    }

    const m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(pad);
    if (!m) return json(res, 404, { message: "onbekend adres" });
    const rest = m[3] ?? "";
    const lichaam = req.method === "POST" || req.method === "PUT" ? await lees(req) : {};

    // refs
    let r = /^\/git\/ref\/heads\/(.+)$/.exec(rest);
    if (r && req.method === "GET") {
      const hash = hashVan(r[1]);
      return hash ? json(res, 200, { ref: `refs/heads/${r[1]}`, object: { sha: hash } }) : json(res, 404, { message: "Not Found" });
    }
    if (rest === "/git/refs" && req.method === "POST") {
      const tak = String(lichaam.ref ?? "").replace("refs/heads/", "");
      git(["update-ref", `refs/heads/${tak}`, lichaam.sha]);
      return json(res, 201, { ref: lichaam.ref, object: { sha: lichaam.sha } });
    }
    r = /^\/git\/refs\/heads\/(.+)$/.exec(rest);
    if (r && req.method === "DELETE") {
      try {
        git(["update-ref", "-d", `refs/heads/${r[1]}`]);
      } catch {
        /* bestond al niet */
      }
      const v = voorbeelden.get(r[1]);
      if (v) {
        v.proces.kill("SIGTERM");
        rmSync(join(PROJECT, v.dist), { recursive: true, force: true });
        voorbeelden.delete(r[1]);
      }
      return json(res, 204, {});
    }

    if (rest.startsWith("/branches") && req.method === "GET") {
      const namen = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]).split("\n").filter(Boolean);
      return json(res, 200, namen.map((name) => ({ name })));
    }

    r = /^\/contents\/(.+)$/.exec(rest);
    if (r) {
      const bestandspad = r[1];
      if (req.method === "GET") {
        const ref = url.searchParams.get("ref") ?? TAK;
        const inhoud = leesBestand(ref, bestandspad);
        if (!inhoud) return json(res, 404, { message: "Not Found" });
        const sha = execFileSync("git", ["--git-dir", REPO, "rev-parse", `${ref}:${bestandspad}`], { encoding: "utf8" }).trim();
        return json(res, 200, { path: bestandspad, sha, encoding: "base64", content: inhoud.toString("base64") });
      }
      if (req.method === "PUT") {
        const commit = schrijfBestand(lichaam.branch ?? TAK, bestandspad, Buffer.from(String(lichaam.content ?? ""), "base64"), lichaam.message ?? "wijziging");
        return json(res, 200, { content: { path: bestandspad }, commit: { sha: commit } });
      }
      if (req.method === "DELETE") {
        const commit = verwijderBestand(lichaam.branch ?? TAK, bestandspad, lichaam.message ?? "weggehaald");
        return json(res, 200, { commit: { sha: commit } });
      }
    }

    if (rest === "/merges" && req.method === "POST") {
      const commit = voegSamen(lichaam.base, lichaam.head, lichaam.commit_message ?? "samengevoegd");
      return json(res, 201, { sha: commit });
    }

    // Eén commit: wat veranderde er, en waar kwam hij vandaan (voor het terugdraaien).
    r = /^\/commits\/([0-9a-f]{7,40})$/.exec(rest);
    if (r && req.method === "GET") {
      const sha = r[1];
      let ouders = [];
      let bestanden = [];
      try {
        ouders = git(["rev-list", "--parents", "-n", "1", sha]).split(" ").slice(1);
        const tegen = ouders[0] ? `${ouders[0]} ${sha}` : sha;
        bestanden = git(["diff", "--name-only", ...tegen.split(" ")]).split("\n").filter(Boolean);
      } catch {
        return json(res, 404, { message: "Not Found" });
      }
      return json(res, 200, { sha, parents: ouders.map((p) => ({ sha: p })), files: bestanden.map((filename) => ({ filename })) });
    }

    if (rest.startsWith("/commits") && req.method === "GET") {
      const ref = url.searchParams.get("sha") ?? TAK;
      const hoeveel = Number(url.searchParams.get("per_page") ?? 20);
      const regels = git(["log", `-${hoeveel}`, "--format=%H%x1f%cI%x1f%s", ref]).split("\n").filter(Boolean);
      return json(
        res,
        200,
        regels.map((l) => {
          const [sha, datum, boodschap] = l.split("\u001f");
          return { sha, commit: { message: boodschap, committer: { date: datum } } };
        }),
      );
    }

    // Deployments: hier speelt deze server ook voor Vercel.
    if (rest.startsWith("/deployments/")) {
      const id = rest.split("/")[2];
      const tak = Buffer.from(id, "base64url").toString("utf8");
      return json(res, 200, [{ state: "success", environment_url: `http://localhost:${POORT}/voorbeeld/${encodeURIComponent(tak)}` }]);
    }
    if (rest.startsWith("/deployments")) {
      const ref = url.searchParams.get("ref");
      if (!ref || !hashVan(ref)) return json(res, 200, []);
      return json(res, 200, [{ id: Buffer.from(ref, "utf8").toString("base64url"), ref, environment: "preview" }]);
    }

    return json(res, 404, { message: `onbekend: ${req.method} ${rest}` });
  } catch (e) {
    return json(res, 422, { message: String(e.message ?? e).slice(0, 300) });
  }
});

server.listen(POORT);

for (const sein of ["SIGINT", "SIGTERM"]) {
  process.on(sein, () => {
    for (const v of voorbeelden.values()) {
      v.proces.kill("SIGTERM");
      rmSync(join(PROJECT, v.dist), { recursive: true, force: true });
    }
    server.close();
    process.exit(0);
  });
}

// Zodat een test kan zien dat hij klaarstaat.
writeFileSync(join(tmpdir(), "hm-nagebootste-github.poort"), String(POORT));
