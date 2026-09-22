#!/usr/bin/env node
/**
 * Webfontlicentie (AC-M7). De CSS van Atomic Marker en Feisty moet byte-gelijk zijn aan de
 * aangeleverde bestanden — inclusief het licentieblok van YouWorkForThem, dat volgens die licentie
 * "unaltered and visible in your CSS" moet blijven. Ook de woff2-bestanden zijn byte-gelijk.
 *   node qa/licentie.mjs
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BASIS } from "./lib/browser.mjs";

const hashes = JSON.parse(readFileSync("qa/bron/hashes.json", "utf8"));
const CSS = ["/fonts/atomic-marker/atomic-marker-regular.css", "/fonts/feisty/feisty.css"];
const WOFF = ["/fonts/atomic-marker/atomic-marker-regular.woff2", "/fonts/feisty/feisty.woff2", "/fonts/atomic-marker/atomic-marker-regular.woff", "/fonts/feisty/feisty.woff"];
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

const fouten = [];
let licentieRegels = 0;
for (const pad of CSS) {
  const r = await fetch(BASIS + pad);
  const tekst = await r.text();
  if (r.status !== 200) fouten.push(`${pad}: status ${r.status}`);
  licentieRegels += (tekst.match(/youworkforthem\.com\/font-license/gi) ?? []).length;
  if (!/All details above must always remain unaltered and visible in your CSS/i.test(tekst)) fouten.push(`${pad}: licentieblok ontbreekt of is gewijzigd`);
  const verwacht = hashes[`public${pad}`];
  const gevonden = sha(Buffer.from(await (await fetch(BASIS + pad)).arrayBuffer()));
  if (verwacht && verwacht !== gevonden) fouten.push(`${pad}: niet byte-gelijk aan het aangeleverde bestand`);
}
for (const pad of WOFF) {
  const buf = Buffer.from(await (await fetch(BASIS + pad)).arrayBuffer());
  const verwacht = hashes[`public${pad}`];
  if (!verwacht) fouten.push(`${pad}: geen hash bekend`);
  else if (verwacht !== sha(buf)) fouten.push(`${pad}: niet byte-gelijk aan het aangeleverde bestand`);
}
if (licentieRegels < 2) fouten.push(`licentie-URL komt ${licentieRegels} keer voor in de CSS (minstens 2)`);

console.log(fouten.length ? `licentie: FAIL\n  ${fouten.join("\n  ")}` : `licentie: PASS — licentieblok ${licentieRegels}× aanwezig, ${CSS.length + WOFF.length} bestanden byte-gelijk`);
process.exit(fouten.length ? 1 : 0);
