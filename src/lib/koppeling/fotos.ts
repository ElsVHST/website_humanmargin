import "server-only";
import sharp from "sharp";
import { media as mediaSchema } from "@/lib/schema";
import * as gh from "@/lib/koppeling/github";
import { veiligPad, veiligeSlug } from "@/lib/koppeling/voorstellen";

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

export async function voegFotoToe(velden: { tak?: string; alt: string; bestand: Bestandsverwijzing; naam?: string }): Promise<{ id: string; pad: string; breedte: number; hoogte: number; kilobytes: number; tak: string }> {
  const alt = String(velden.alt ?? "").trim();
  if (alt.length < 5) throw new Error("Schrijf er even bij wat er op de foto te zien is; dat is nodig voor wie de site niet kan zien.");

  const bestand = velden.bestand ?? {};
  if (!bestand.download_url) throw new Error("Upload de foto via ChatGPT in de browser. Vanaf de telefoon komt het bestand niet mee.");
  const soort = String(bestand.mime_type ?? "").toLowerCase();
  if (soort.includes("svg")) throw new Error("Een SVG kan ik niet gebruiken. Stuur een JPEG, PNG of WebP.");
  if (soort && !TOEGESTAAN.has(soort)) throw new Error(`Dit bestandstype kan ik niet gebruiken (${soort}). Stuur een JPEG, PNG of WebP.`);

  const opgehaald = await fetch(bestand.download_url);
  if (!opgehaald.ok) throw new Error("Ik kon de foto niet ophalen. Probeer hem opnieuw te sturen.");
  const ruw = Buffer.from(await opgehaald.arrayBuffer());
  if (ruw.length === 0) throw new Error("Dit bestand is leeg.");
  if (ruw.length > MAX_BYTES) throw new Error(`Deze foto is ${(ruw.length / 1024 / 1024).toFixed(1)} MB. Hij mag hoogstens 15 MB zijn.`);

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

  const basisNaam = veiligeSlug((velden.naam ?? bestand.name ?? "foto").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "foto");
  const id = basisNaam;
  const pad = veiligPad(`public/media/${id}.jpg`);

  const tak = velden.tak ?? gh.publicatietak();
  await gh.schrijfBestand(pad, klaar.data, tak, `foto toegevoegd: ${id}.jpg`);

  // De foto moet ook in het mediamanifest staan, anders kan geen enkele pagina eraan refereren.
  const manifestPad = veiligPad("content/media.json");
  const huidig = await gh.leesBestand(manifestPad, tak);
  const manifest = huidig ? (JSON.parse(huidig.tekst) as { beelden: unknown[] }) : { beelden: [] };
  manifest.beelden = (manifest.beelden ?? []).filter((b) => (b as { id?: string }).id !== id);
  manifest.beelden.push({ id, bestand: `${id}.jpg`, alt, breedte: klaar.info.width, hoogte: klaar.info.height });
  const gekeurd = mediaSchema.safeParse(manifest);
  if (!gekeurd.success) throw new Error("De foto past niet in de lijst met beelden; ik heb hem niet toegevoegd.");
  await gh.schrijfBestand(manifestPad, `${JSON.stringify(gekeurd.data, null, 2)}\n`, tak, `beeld ${id} in de lijst`);

  return { id, pad, breedte: klaar.info.width, hoogte: klaar.info.height, kilobytes: Math.round(klaar.data.length / 1024), tak };
}
