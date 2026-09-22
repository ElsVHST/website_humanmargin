#!/usr/bin/env node
/**
 * Interne links (AC-T9, eerste helft): elke interne link werkt. Externe links worden hier niet
 * gebeld — die controle staat apart in qa/externe-links.mjs, want daarvoor is internet nodig.
 *   node qa/links.mjs
 */
import { BASIS, ROUTES } from "./lib/browser.mjs";

const gezien = new Map();
const fouten = [];
for (const route of [...ROUTES, "/bestaat-niet/"]) {
  const html = await (await fetch(BASIS + route)).text();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(href)) continue;
    const pad = href.split("#")[0];
    if (!pad.startsWith("/")) continue;
    if (!gezien.has(pad)) {
      const r = await fetch(BASIS + pad, { redirect: "manual" });
      gezien.set(pad, r.status);
    }
    const status = gezien.get(pad);
    const verwacht = route === "/bestaat-niet/" ? [200, 404] : [200];
    if (!verwacht.includes(status)) fouten.push(`${route} → ${pad}: status ${status}`);
  }
}

console.log(fouten.length ? `links: FAIL\n  ${fouten.join("\n  ")}` : `links: PASS — ${gezien.size} interne adressen, 0 kapot`);
process.exit(fouten.length ? 1 : 0);
