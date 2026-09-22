import "server-only";
import sharp from "sharp";
import { media as mediaSchema } from "@/lib/schema";
import * as gh from "@/lib/koppeling/github";
import { openVoorstellen, veiligPad, veiligeSlug } from "@/lib/koppeling/voorstellen";

/*
 * Foto's toevoegen (AC-S3).
 *
 * Wat er binnenkomt is een bestand van iemand anders. Daarom: alleen JPEG, PNG en WebP — geen SVG,
 * want dat is een document dat code kan bevatten en de site zet SVG's onverpakt neer voor de
 * klantlogo's. Hoogstens 15 MB. De lange zijde gaat naar 2400 pixels, en alles wat de camera er
 * verder in stopte (waaronder de plaatsbepaling) gaat eruit.
 */

const TOEGESTAAN = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ZIJDE = 2400;

export type Bestandsverwijzing = { download_url?: string; name?: string; mime_type?: string };

/**
 * De foto ophalen, met de omleidingen in eigen hand.
 *
 * `fetch` volgt standaard elke omleiding, dus een open omleiding op een toegestane host maakt van
 * deze server een ophaaldienst voor willekeurige adressen. Daarom: elke stap opnieuw toetsen, en
 * hoogstens drie stappen. En de grootte onderweg meten — niet pas nadat alles in het geheugen
 * staat. Beide gevonden door de beta-tester, ronde 2.
 */
async function haalFotoOp(adres: string, magHier: (u: URL) => boolean): Promise<Buffer> {
  let url = adres;
  for (let stap = 0; stap < 4; stap++) {
    let doel: URL;
    try {
      doel = new URL(url);
    } catch {
      throw new Error("Ik kon de foto niet ophalen. Probeer hem opnieuw te sturen.");
    }
    if (!magHier(doel)) throw new Error("Deze foto kan ik niet ophalen. Voeg hem toe via ChatGPT zelf, dan komt hij goed binnen.");

    const r = await fetch(doel, { redirect: "manual" }).catch(() => null);
    if (!r) throw new Error("Ik kon de foto niet ophalen. Probeer hem opnieuw te sturen.");
    if (r.status >= 300 && r.status < 400) {
      const volgende = r.headers.get("location");
      if (!volgende) throw new Error("Ik kon de foto niet ophalen. Probeer hem opnieuw te sturen.");
      url = new URL(volgende, doel).toString();
      continue;
    }
    if (!r.ok) throw new Error("Ik kon de foto niet ophalen. Probeer hem opnieuw te sturen.");

    const gemeld = Number(r.headers.get("content-length") ?? 0);
    if (gemeld > MAX_BYTES) throw new Error(`Deze foto is ${(gemeld / 1024 / 1024).toFixed(1)} MB. Hij mag hoogstens 15 MB zijn.`);

    const stukken: Buffer[] = [];
    let totaal = 0;
    const lezer = r.body?.getReader();
    if (!lezer) return Buffer.from(await r.arrayBuffer());
    for (;;) {
      const { done, value } = await lezer.read();
      if (done) break;
      totaal += value.byteLength;
      if (totaal > MAX_BYTES) {
        await lezer.cancel();
        throw new Error("Deze foto is te groot. Hij mag hoogstens 15 MB zijn.");
      }
      stukken.push(Buffer.from(value));
    }
    return Buffer.concat(stukken);
  }
  throw new Error("Ik kon de foto niet ophalen: hij wordt te vaak doorgestuurd.");
}

export async function voegFotoToe(velden: { tak?: string; alt: string; bestand: Bestandsverwijzing; naam?: string }): Promise<{ id: string; pad: string; breedte: number; hoogte: number; kilobytes: number; tak: string }> {
  // Zonder tak zou een foto rechtstreeks op de publicatietak belanden: dan staat hij op de site
  // zonder dat iemand hem heeft goedgekeurd. Een foto hoort bij een voorstel.
  if (!velden.tak) {
    throw new Error("Zeg er even bij bij welk voorstel deze foto hoort, of maak eerst een voorstel. Zo komt er niets op de site zonder dat jij het gezien hebt.");
  }
  // Bestaat dat voorstel eigenlijk? Zonder deze vraag probeert de tool te schrijven en vertaalt hij
  // daarna een fout van git — terwijl intrekken en publiceren wél netjes zeggen dat ze het niet
  // kennen. Gevonden door de beta-tester, ronde 2.
  const open = await openVoorstellen();
  if (!open.includes(velden.tak)) {
    throw new Error(`Dat voorstel ken ik niet. ${open.length ? `Open voorstellen: ${open.map((t) => t.replace("voorstel/", "")).join(", ")}.` : "Er staan geen voorstellen open; maak er eerst een."}`);
  }
  const alt = String(velden.alt ?? "").trim();
  if (alt.length < 5) throw new Error("Schrijf er even bij wat er op de foto te zien is; dat is nodig voor wie de site niet kan zien.");

  const bestand = velden.bestand ?? {};
  if (!bestand.download_url) throw new Error("Upload de foto via ChatGPT in de browser. Vanaf de telefoon komt het bestand niet mee.");
  // Het adres komt uit een gesprek. Alleen https, en alleen van waar ChatGPT zijn bestanden
  // neerzet — anders haalt de server op verzoek van een vreemde van alles op wat hij kan bereiken.
  const toegestaneHosts = (process.env.FOTO_TOEGESTANE_HOSTS ?? "files.oaiusercontent.com,cdn.openai.com,chatgpt.com,files.openai.com")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const magVanDezeHost = (u: URL) => {
    const lokaalTesten = Boolean(process.env.KOPPELING_TESTTOKEN) && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    const vanChatGpt = u.protocol === "https:" && toegestaneHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
    return vanChatGpt || lokaalTesten;
  };
  const soort = String(bestand.mime_type ?? "").toLowerCase();
  if (soort.includes("svg")) throw new Error("Een SVG kan ik niet gebruiken. Stuur een JPEG, PNG of WebP.");
  if (soort && !TOEGESTAAN.has(soort)) throw new Error(`Dit bestandstype kan ik niet gebruiken (${soort}). Stuur een JPEG, PNG of WebP.`);

  const ruw = await haalFotoOp(bestand.download_url as string, magVanDezeHost);
  if (ruw.length === 0) throw new Error("Dit bestand is leeg.");

  // Niet op de naam of het opgegeven type afgaan: kijken wat het écht is.
  let beeld = sharp(ruw, { failOn: "error" });
  const info = await beeld.metadata().catch(() => null);
  if (!info || !info.format || !["jpeg", "png", "webp"].includes(info.format)) {
    throw new Error("Dit bestand is geen foto die ik kan gebruiken. Stuur een JPEG, PNG of WebP.");
  }
  if (Math.max(info.width ?? 0, info.height ?? 0) > MAX_ZIJDE) {
    beeld = beeld.resize({ width: MAX_ZIJDE, height: MAX_ZIJDE, fit: "inside", withoutEnlargement: true });
  }
  // .jpeg() zonder EXIF-optie schrijft geen metadata terug: de plaatsbepaling gaat er dus uit.
  const klaar = await beeld.jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  const gekozenNaam = (velden.naam ?? bestand.name ?? "foto").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "foto";
  let id: string;
  try {
    id = veiligeSlug(gekozenNaam);
  } catch {
    throw new Error("Geef de foto een naam van minstens twee tekens, met alleen kleine letters, cijfers en streepjes.");
  }
  const pad = veiligPad(`public/media/${id}.jpg`);

  const tak = velden.tak;

  /*
   * Eerst de hele lijst met beelden klaarmaken en keuren, en pas daarna schrijven. Andersom kan de
   * foto wél in de repo staan terwijl de lijst afketst — dan hangt er een bestand zonder regel, en
   * daar heeft niemand iets aan.
   */
  const manifestPad = veiligPad("content/media.json");
  const huidig = await gh.leesBestand(manifestPad, tak);
  const manifest = huidig ? (JSON.parse(huidig.tekst) as { beelden: unknown[] }) : { beelden: [] };
  manifest.beelden = (manifest.beelden ?? []).filter((b) => (b as { id?: string }).id !== id);
  manifest.beelden.push({ id, bestand: `/media/${id}.jpg`, alt, breedte: klaar.info.width, hoogte: klaar.info.height });
  if (alt.length > 200) throw new Error(`De beschrijving is ${alt.length} tekens; hou hem op hoogstens 200. Eén zin is genoeg.`);
  const gekeurd = mediaSchema.safeParse(manifest);
  if (!gekeurd.success) throw new Error("De foto past niet in de lijst met beelden; ik heb hem niet toegevoegd.");

  await gh.schrijfBestand(pad, klaar.data, tak, `foto toegevoegd: ${id}.jpg`);
  await gh.schrijfBestand(manifestPad, `${JSON.stringify(gekeurd.data, null, 2)}\n`, tak, `beeld ${id} in de lijst`);

  return { id, pad, breedte: klaar.info.width, hoogte: klaar.info.height, kilobytes: Math.round(klaar.data.length / 1024), tak };
}
