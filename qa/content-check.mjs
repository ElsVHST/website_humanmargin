#!/usr/bin/env node
/**
 * Controleert alle content tegen het schema (src/lib/schema.ts), zonder te bouwen.
 *   npm run content            — alle bestanden in content/
 *   node qa/content-check.mjs <map>   — een andere contentmap (gebruikt door de tegenproef)
 * Exit 0 = alles geldig. Anders: per fout het bestand en het veld.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { site, kantlijn, media, pagina, beschrijfFout } from "../src/lib/schema.ts";

const map = resolve(process.argv[2] ?? join(import.meta.dirname, "..", "content"));
const fouten = [];
const controleer = (rel, schema) => {
  let data;
  try {
    data = JSON.parse(readFileSync(join(map, rel), "utf8"));
  } catch (e) {
    fouten.push(`${rel}: geen geldige JSON (${e.message})`);
    return null;
  }
  const r = schema.safeParse(data);
  if (!r.success) fouten.push(beschrijfFout(rel, r.error));
  return r.success ? r.data : null;
};

controleer("site.json", site);
controleer("kantlijn.json", kantlijn);
controleer("media.json", media);
const paginas = readdirSync(join(map, "paginas")).filter((f) => f.endsWith(".json"));
for (const f of paginas) {
  const p = controleer(`paginas/${f}`, pagina);
  if (p && `${p.slug}.json` !== f) fouten.push(`paginas/${f}: slug "${p.slug}" ≠ bestandsnaam`);
}

if (fouten.length) {
  console.error(`content-check: FAIL (${fouten.length})\n${fouten.join("\n")}`);
  process.exit(1);
}
console.log(`content-check: PASS — ${3 + paginas.length} bestanden geldig (${paginas.length} pagina's)`);
