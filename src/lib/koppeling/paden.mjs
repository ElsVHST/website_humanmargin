/**
 * De grenzen van de koppeling, als los bestand zonder afhankelijkheden (AC-V1, AC-V2).
 *
 * Deze twee regels bepalen wat de koppeling mag aanraken. Ze staan bewust apart en in gewoon
 * JavaScript, zodat de controlereeks ze rechtstreeks kan testen — dezelfde code die in productie
 * draait, niet een nagebouwde versie ervan.
 */

/**
 * Een paginanaam: kleine letters, cijfers en streepjes, 2 tot 60 tekens, en hij moet beginnen en
 * eindigen met een letter of cijfer. Zonder die laatste eis komt "---" erdoor, en dat wordt een
 * pagina op /---/ en een tak "voorstel/2026-09-22---". Gezien tijdens de beta-test van 22-09.
 */
export const slugPatroon = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;

export function veiligPad(pad) {
  const schoon = String(pad ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
  if (schoon.includes("..") || schoon.startsWith("/")) throw new Error("Dat pad mag ik niet gebruiken.");
  if (!/^content\/[\w./-]+$/.test(schoon) && !/^public\/media\/[\w./-]+$/.test(schoon)) {
    throw new Error("Ik kan alleen de inhoud en de foto's van de site wijzigen, niet de rest van het project.");
  }
  return schoon;
}

export function veiligeSlug(slug) {
  const schoon = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!slugPatroon.test(schoon)) throw new Error("Een paginanaam mag alleen kleine letters, cijfers en streepjes bevatten (2 tot 60 tekens).");
  return schoon;
}

/** Wat een foto mag zijn (AC-S3). */
export const FOTO_TYPEN = ["image/jpeg", "image/png", "image/webp"];
export const FOTO_MAX_BYTES = 15 * 1024 * 1024;
export const FOTO_MAX_ZIJDE = 2400;
export const MAX_OPEN_VOORSTELLEN = 5;

/*
 * Velden die geen lopende tekst zijn maar een verwijzing: daar mag nooit in vervangen worden.
 * Anders verandert het vervangen van "markeerstift" in een alinea óók het beeld-id waar een foto
 * aan hangt, en valt de pagina om bij de bouw. Gevonden door de beta-tester, 22-09.
 */
export const GEEN_TEKSTVELD = new Set(["id", "slug", "type", "beeld", "zijbeeld", "doel", "achtergrond", "pijl", "kleur", "plek", "pagina", "sectie", "bestand", "soort"]);

/** Vervangt tekst in elk tekstveld van een object, en telt hoe vaak dat lukte. */
export function vervangInTekst(waarde, zoek, vervang, teller = { n: 0 }, veld) {
  if (veld && GEEN_TEKSTVELD.has(veld)) return waarde;
  if (typeof waarde === "string") {
    if (waarde.includes(zoek)) {
      teller.n++;
      return waarde.split(zoek).join(vervang);
    }
    return waarde;
  }
  if (Array.isArray(waarde)) return waarde.map((w) => vervangInTekst(w, zoek, vervang, teller, veld));
  if (waarde && typeof waarde === "object") {
    const uit = {};
    for (const [k, w] of Object.entries(waarde)) uit[k] = vervangInTekst(w, zoek, vervang, teller, k);
    return uit;
  }
  return waarde;
}
