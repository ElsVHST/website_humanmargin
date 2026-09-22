#!/usr/bin/env node
/**
 * De grenzen van de koppeling, zonder netwerk (PRD-002 §5.2, AC-V1, AC-V2, AC-S3).
 *
 * Dit test dezelfde code die in productie draait: `src/lib/koppeling/paden.mjs` wordt door de
 * tools geïmporteerd én hier. Een tweede, nagebouwde versie zou vrolijk groen blijven terwijl de
 * echte regel stuk is.
 *
 *   node qa/koppeling-unit.mjs
 */
import { FOTO_MAX_BYTES, FOTO_MAX_ZIJDE, FOTO_TYPEN, MAX_OPEN_VOORSTELLEN, veiligPad, veiligeSlug } from "../src/lib/koppeling/paden.mjs";

const uitslagen = [];
const meld = (naam, ok, detail) => {
  uitslagen.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${naam}${detail ? ` — ${detail}` : ""}`);
};

const weigert = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

/* ── Paden (AC-V2) ───────────────────────────────────────────────────────────────────────── */
const goedePaden = ["content/paginas/home.json", "content/site.json", "content/media.json", "public/media/foto.jpg"];
const foutePaden = [
  "package.json",
  "../package.json",
  "content/../package.json",
  "/etc/passwd",
  "src/app/page.tsx",
  "public/fonts/feisty/feisty.css",
  ".env.local",
  "content/paginas/../../next.config.ts",
  "public\\media\\..\\..\\package.json",
];
meld(
  "AC-V2 de vier soorten paden die mogen, mogen",
  goedePaden.every((p) => {
    try {
      return veiligPad(p) === p;
    } catch {
      return false;
    }
  }),
  goedePaden.join(", "),
);
const geweigerd = foutePaden.filter((p) => weigert(() => veiligPad(p)));
meld("AC-V2 alles buiten content en public/media wordt geweigerd", geweigerd.length === foutePaden.length, `${geweigerd.length} van de ${foutePaden.length} geweigerd${geweigerd.length < foutePaden.length ? `; door: ${foutePaden.filter((p) => !geweigerd.includes(p)).join(", ")}` : ""}`);

/* ── Paginanamen (AC-V1) ─────────────────────────────────────────────────────────────────── */
const goedeSlugs = ["home", "over-mij", "workshop-12-november", "ab"];
// "Home" en "main" horen hier niet bij: hoofdletters worden gewoon kleine letters, en "main" is
// een geldige paginanaam die nooit als taknaam gebruikt wordt.
const fouteSlugs = ["", "a", "over mij", "../home", "home.json", "héél-lang", "x".repeat(61), "refs/heads/main", "home/../..", "voorstel/x"];
meld(
  "AC-V1 gewone paginanamen mogen",
  goedeSlugs.every((s) => veiligeSlug(s) === s.toLowerCase()),
  goedeSlugs.join(", "),
);
const slugFout = fouteSlugs.filter((s) => weigert(() => veiligeSlug(s)));
meld("AC-V1 een paginanaam kan nooit een pad of een tak worden", slugFout.length === fouteSlugs.length, `${slugFout.length} van de ${fouteSlugs.length} geweigerd${slugFout.length < fouteSlugs.length ? `; door: ${JSON.stringify(fouteSlugs.filter((s) => !slugFout.includes(s)))}` : ""}`);
meld("AC-V1 hoofdletters worden gewoon kleine letters", veiligeSlug("Home") === "home" && veiligeSlug("  Over-Mij ") === "over-mij", 'Home → home, "  Over-Mij " → over-mij');

/* ── Foto's (AC-S3) ──────────────────────────────────────────────────────────────────────── */
meld("AC-S3 alleen JPEG, PNG en WebP staan op de lijst", FOTO_TYPEN.length === 3 && !FOTO_TYPEN.some((t) => t.includes("svg")), FOTO_TYPEN.join(", "));
meld("AC-S3 de grenzen staan op 15 MB en 2400 px", FOTO_MAX_BYTES === 15 * 1024 * 1024 && FOTO_MAX_ZIJDE === 2400, `${FOTO_MAX_BYTES / 1024 / 1024} MB · ${FOTO_MAX_ZIJDE} px`);
meld("AC-V6 hoogstens vijf voorstellen tegelijk", MAX_OPEN_VOORSTELLEN === 5, String(MAX_OPEN_VOORSTELLEN));

/* ── De grens staat er maar één keer ─────────────────────────────────────────────────────── */
{
  const { readFileSync } = await import("node:fs");
  const bron = readFileSync("src/lib/koppeling/voorstellen.ts", "utf8");
  const eigenRegex = /content\\\/\[/.test(bron) || /startsWith\("public\/media/.test(bron);
  meld("de padgrens staat niet een tweede keer in de tools", !eigenRegex, eigenRegex ? "voorstellen.ts heeft een eigen kopie van de regel" : "één bron: paden.mjs");
}

const mislukt = uitslagen.filter((u) => !u).length;
console.log(`koppeling-unit: ${mislukt ? "FAIL" : "PASS"} (${uitslagen.length - mislukt}/${uitslagen.length})`);
process.exit(mislukt ? 1 : 0);
