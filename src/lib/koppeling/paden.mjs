/**
 * De grenzen van de koppeling, als los bestand zonder afhankelijkheden (AC-V1, AC-V2).
 *
 * Deze twee regels bepalen wat de koppeling mag aanraken. Ze staan bewust apart en in gewoon
 * JavaScript, zodat de controlereeks ze rechtstreeks kan testen — dezelfde code die in productie
 * draait, niet een nagebouwde versie ervan.
 */

/** Een paginanaam: kleine letters, cijfers en streepjes, 2 tot 60 tekens. */
export const slugPatroon = /^[a-z0-9-]{2,60}$/;

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
