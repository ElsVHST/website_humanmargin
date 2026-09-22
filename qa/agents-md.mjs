#!/usr/bin/env node
/**
 * AGENTS.md is de enige instructiebron voor AI-agents (V25, AC-T14).
 * (a) 0 skill-mappen en geen Copilot-bestanden uit de template;
 * (b) CLAUDE.md en GEMINI.md bevatten alleen de verwijzing naar AGENTS.md;
 * (c) geen resten van de template in AGENTS.md ("clone-website", "Reverse-Engineer", "Fares");
 * (d) elk bestand in content/ wordt in AGENTS.md bij naam genoemd — de driftcontrole.
 *   node qa/agents-md.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const fouten = [];
const agents = existsSync("AGENTS.md") ? readFileSync("AGENTS.md", "utf8") : "";
if (!agents) fouten.push("AGENTS.md ontbreekt");
const regels = agents.split("\n").length;
if (regels > 200) fouten.push(`AGENTS.md heeft ${regels} regels (max 200)`);

for (const map of [".claude/skills", ".codex/skills", ".github/skills"]) if (existsSync(map)) fouten.push(`${map} bestaat nog`);
for (const bestand of [".github/copilot-instructions.md", ".github/copilot-setup-steps.yml", ".clinerules", ".windsurfrules", ".aider.conf.yml"]) if (existsSync(bestand)) fouten.push(`${bestand} bestaat nog`);

for (const bestand of ["CLAUDE.md", "GEMINI.md"]) {
  if (!existsSync(bestand)) {
    fouten.push(`${bestand} ontbreekt`);
    continue;
  }
  const inhoud = readFileSync(bestand, "utf8").trim();
  if (inhoud !== "@AGENTS.md") fouten.push(`${bestand} bevat meer dan "@AGENTS.md": "${inhoud.slice(0, 40)}…"`);
}

for (const woord of ["clone-website", "Reverse-Engineer", "Fares", "faresmasharawi", "Bakker"]) {
  if (agents.includes(woord)) fouten.push(`AGENTS.md noemt "${woord}" (rest van de template)`);
}

// (d) Elk contentbestand staat in AGENTS.md.
const contentBestanden = [];
const loop = (map, voorvoegsel = "") => {
  for (const naam of readdirSync(map, { withFileTypes: true })) {
    if (naam.isDirectory()) loop(join(map, naam.name), `${voorvoegsel}${naam.name}/`);
    else if (naam.name.endsWith(".json")) contentBestanden.push(`${voorvoegsel}${naam.name}`);
  }
};
loop("content");
for (const bestand of contentBestanden) if (!agents.includes(bestand)) fouten.push(`AGENTS.md noemt content/${bestand} niet`);

console.log(fouten.length ? `agents-md: FAIL\n  ${fouten.join("\n  ")}` : `agents-md: PASS — ${regels} regels, ${contentBestanden.length} contentbestanden genoemd, 0 skill-mappen`);
process.exit(fouten.length ? 1 : 0);
