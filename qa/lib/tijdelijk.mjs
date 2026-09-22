/**
 * Een proefbouw draaien: dezelfde projectmap, maar naar een eigen uitvoermap (NEXT_DIST_DIR), met
 * tijdelijke wijzigingen in content/ die daarna weer worden teruggedraaid. Zo blijft de echte bouw
 * in .next onaangeroerd. (Een kopie met een gedeelde node_modules kan niet: Turbopack weigert een
 * symlink die buiten de projectmap wijst.)
 */
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, rmSync, unlinkSync } from "node:fs";
import { wacht } from "./browser.mjs";
import { vrijePoort } from "./vrij.mjs";

export async function proefBouw({ naam, env = {}, poort, wijzig = async () => {}, tijdelijkeBestanden = [] }) {
  poort ??= await vrijePoort();
  const dist = `.next-${naam}`;
  const bewaard = new Map();
  const bewaar = (pad) => {
    if (existsSync(pad)) {
      const kopie = `${pad}.bewaard`;
      copyFileSync(pad, kopie);
      bewaard.set(pad, kopie);
    }
  };
  const herstel = () => {
    for (const [pad, kopie] of bewaard) {
      copyFileSync(kopie, pad);
      unlinkSync(kopie);
    }
    for (const pad of tijdelijkeBestanden) rmSync(pad, { force: true });
    rmSync(dist, { recursive: true, force: true });
  };
  // Next schrijft bij elke bouw een `include`-regel voor zijn uitvoermap in tsconfig.json. Bij een
  // proefbouw is dat rommel die anders in de repo belandt, dus dat bestand gaat altijd mee terug.
  bewaar("tsconfig.json");
  await wijzig({ bewaar });
  const omgeving = { ...process.env, ...env, NEXT_DIST_DIR: dist };
  let server;
  try {
    execFileSync("npx", ["next", "build"], { env: omgeving, stdio: "pipe" });
    server = spawn("npx", ["next", "start", "-p", String(poort)], { env: omgeving, stdio: "ignore" });
    const basis = `http://localhost:${poort}`;
    for (let i = 0; i < 40; i++) {
      await wacht(250);
      try {
        if ((await fetch(basis + "/", { signal: AbortSignal.timeout(1000) })).ok) break;
      } catch {
        /* nog niet op */
      }
    }
    return {
      dist,
      basis,
      stop() {
        try {
          server.kill("SIGTERM");
        } catch {
          console.log(`let op: de proefserver op ${poort} stopte niet; hergebruik die poort niet`);
        }
        herstel();
      },
    };
  } catch (e) {
    server?.kill("SIGTERM");
    herstel();
    throw e;
  }
}
