/**
 * Gedeelde tekstgereedschappen voor de controlescripts.
 * Normaliseren (AC-I2): kleine letters, witruimte gelijk, typografische aanhalingstekens recht,
 * ® en (r) weg, leestekens weg. Zo vallen opmaakverschillen weg, maar woorden niet.
 */
export function normaliseer(s) {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[­​-‍﻿]/g, "")
    .replace(/®|\(r\)/gi, " ")
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const woorden = (s) => normaliseer(s).split(" ").filter(Boolean);

/** Zinnen uit een blok tekst, op punt/vraagteken/uitroepteken. */
export function zinnen(blok) {
  return blok
    .split(/(?<=[.!?])\s+/)
    .map((z) => z.trim())
    .filter(Boolean);
}

/** Zichtbare tekst per blok uit HTML, zonder <head>, scripts, stijlen en svg. */
export function blokkenUitHtml(html) {
  const body = html.slice(html.indexOf("<body"));
  const schoon = body
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // De letters van de hero-kop zitten elk in een eigen span: die plakken we weer aan elkaar,
    // anders leest de meting "D E M E N S" in plaats van "De mens".
    .replace(/<span class="hm-ch[^"]*"[^>]*>([^<]*)<\/span>/g, "$1")
    // `a` telt als eigen blok: twee knoppen naast elkaar zijn twee teksten, geen zin.
    .replace(/<(p|div|section|h[1-6]|li|ul|ol|br|footer|header|figcaption|blockquote|address|summary|details|tr|td|th|dt|dd|article|nav|main|button|dialog|a)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|h[1-6]|li|ul|ol|footer|header|figcaption|blockquote|address|summary|details|tr|td|th|dt|dd|article|nav|main|button|dialog|a)>/gi, "\n")
    // Elk ander tag-einde geeft een spatie: anders plakt "01" aan "Welke toepassingen…".
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  return schoon
    .split("\n")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter((r) => r.length > 1);
}

/**
 * Eenheden uit een bronbestand: alinea's en lijstitems. Een regel die met een opsommingsteken,
 * nummer of tab begint is een nieuwe eenheid; ingesprongen vervolgregels horen bij de vorige.
 */
export function eenhedenUitBron(tekst, { perRegel = false } = {}) {
  const regels = tekst.split(/\r?\n/).filter((r) => !/^[\s|v^]+$/.test(r) || !r.trim());
  if (perRegel) return regels.map((r) => r.trim()).filter(Boolean);
  const uit = [];
  let vorigeLeeg = true;
  let vorigeInspring = false;
  const isKop = (r) => {
    const letters = r.replace(/[^\p{L}]/gu, "");
    return letters.length > 1 && letters === letters.toUpperCase();
  };
  const isGegeven = (r) => /^[\w.+-]+@[\w.-]+$/.test(r) || /^[\d+][\d\s]{7,}$/.test(r) || /^(linkedin|contactgegevens:?)$/i.test(r);
  for (const regel of regels) {
    if (!regel.trim()) {
      vorigeLeeg = true;
      continue;
    }
    const kaal = regel.trim();
    const inspring = /^[\s\t]{2,}/.test(regel) || /^\t/.test(regel);
    const opsomming = /^\s*([-•*]|\d{1,2}[.)]?\s|•)/.test(regel);
    // Een kop in hoofdletters, een los gegeven (e-mail, telefoon) of een opsomming begint een
    // nieuwe eenheid; ingesprongen vervolgregels horen bij de vorige.
    const vorige = uit[uit.length - 1];
    const nieuw =
      vorigeLeeg ||
      opsomming ||
      isKop(kaal) ||
      isGegeven(kaal) ||
      /^Human\s+MARGIN\(r\)$/i.test(kaal) ||
      (vorige && (isKop(vorige) || isGegeven(vorige) || /^Human\s+MARGIN\(r\)$/i.test(vorige))) ||
      inspring !== vorigeInspring;
    if (nieuw || !uit.length) uit.push(regel.trim());
    else uit[uit.length - 1] += " " + regel.trim();
    vorigeLeeg = false;
    vorigeInspring = inspring;
  }
  return uit;
}
