/**
 * Het contentcontract van de site (PRD-001 §3.2, AC-P9). Eén schema, gebruikt door:
 * - de bouw (src/lib/content.ts): een ongeldig bestand laat `next build` falen met bestand + veld;
 * - de controlereeks (qa/content-check.mjs, draait dit bestand direct met Node);
 * - de ChatGPT-koppeling (PRD-002): een voorstel dat dit schema breekt, wordt nooit gepubliceerd.
 *
 * Alleen "wisbare" TypeScript (geen enum/namespace), zodat Node dit bestand zonder bouwstap kan lezen.
 * Bestanden: content/site.json · content/kantlijn.json · content/media.json · content/paginas/*.json
 */
import { z } from "zod";

z.config(z.locales.nl());

const tekst = z.string().trim().min(1, { error: "Dit veld mag niet leeg zijn." });
const korteTekst = (max: number) => tekst.max(max, { error: `Maximaal ${max} tekens.` });
// Eén bron voor wat een paginanaam mag zijn: hetzelfde patroon dat de ChatGPT-koppeling gebruikt.
// Relatief, niet via de @-alias: dit bestand wordt ook door de controlescripts met kale Node geladen.
export { slugPatroon } from "./koppeling/paden.mjs";
import { slugPatroon } from "./koppeling/paden.mjs";
const slug = z.string().regex(slugPatroon, { error: "Alleen kleine letters, cijfers en streepjes (2–60 tekens)." });
const beeldId = z.string().regex(/^[a-z0-9-]{2,80}$/, { error: "Verwijs naar een beeld uit content/media.json (id)." });

/* ── Knoppen ─────────────────────────────────────────────────────────────────────────────── */

/** Waar een knop naartoe gaat. Vaste doelen lezen hun adres uit site.json, zodat een e-mailadres
 *  of Calendly-link op één plek staat (AC-I6). Een pad is een interne pagina, bv. "/aanbod/". */
export const knopDoel = z.union([
  z.literal("kennismaking"),
  z.literal("keuzehulp"),
  z.literal("mail"),
  z.literal("bellen"),
  z.literal("linkedin"),
  z.string().regex(/^\/([a-z0-9-]+\/)*(#[a-z0-9-]+)?$/, { error: 'Een pad begint en eindigt met "/", bv. "/aanbod/".' }),
]);
export const knop = z.object({ tekst: korteTekst(60), doel: knopDoel });

/* ── Bouwstenen: de basis van elke pagina, ook van nieuwe pagina's via ChatGPT ─────────────── */

export const bouwsteen = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kop"), tekst: korteTekst(120), niveau: z.union([z.literal(2), z.literal(3)]).default(2) }),
  z.object({ type: z.literal("alinea"), tekst: korteTekst(3000) }),
  z.object({ type: z.literal("citaat"), tekst: korteTekst(600), bron: korteTekst(120).optional() }),
  z.object({ type: z.literal("foto"), beeld: beeldId, bijschrift: korteTekst(200).optional() }),
  z.object({ type: z.literal("lijst"), items: z.array(korteTekst(600)).min(1).max(30), genummerd: z.boolean().default(false) }),
  z.object({ type: z.literal("knop"), tekst: korteTekst(60), doel: knopDoel }),
]);
export type Bouwsteen = z.infer<typeof bouwsteen>;
export const BASIS_BOUWSTENEN = ["kop", "alinea", "citaat", "foto", "lijst", "knop"] as const;

/* ── Secties ─────────────────────────────────────────────────────────────────────────────── */

export const achtergrond = z.enum(["licht", "zwart", "grijs", "geel"]);
const sectieBasis = {
  /** Anker van de sectie; notities en markeringen in kantlijn.json verwijzen hiernaar. */
  id: slug,
  achtergrond: achtergrond.optional(),
};

const opening = z.object({
  ...sectieBasis,
  type: z.literal("opening"),
  /** Toon het volledige logo boven de kop (alleen de home). */
  logo: z.boolean().default(false),
  kicker: korteTekst(80).optional(),
  kop: korteTekst(90),
  lead: z.array(korteTekst(600)).default([]),
  knoppen: z.array(knop).max(3).default([]),
  beeld: beeldId,
  /** Uitsnede van de foto (CSS object-position), bv. "50% 30%". */
  beeldFocus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).default("50% 50%"),
});

const tekstSectie = z.object({
  ...sectieBasis,
  type: z.literal("tekst"),
  label: korteTekst(60).optional(),
  kop: korteTekst(160).optional(),
  bouwstenen: z.array(bouwsteen).min(1).max(80),
  beeld: beeldId.optional(),
  beeldPositie: z.enum(["links", "rechts"]).default("rechts"),
  beeldFocus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).default("50% 50%"),
});

const vragenlijst = z.object({
  ...sectieBasis,
  type: z.literal("vragenlijst"),
  label: korteTekst(60).optional(),
  kop: korteTekst(160),
  subkop: korteTekst(80).optional(),
  intro: korteTekst(400).optional(),
  vragen: z.array(korteTekst(200)).min(1).max(12),
  slot: korteTekst(400).optional(),
});

const panelen = z.object({
  ...sectieBasis,
  type: z.literal("panelen"),
  kop: korteTekst(80),
  panelen: z
    .array(z.object({ woord: korteTekst(30), titel: korteTekst(60), tekst: korteTekst(300) }))
    .min(2)
    .max(5),
  naschrift: z.array(bouwsteen).default([]),
});

const verwijzingen = z.object({
  ...sectieBasis,
  type: z.literal("verwijzingen"),
  kop: korteTekst(80),
  blokken: z
    .array(
      z.object({
        titel: korteTekst(80),
        tekst: z.array(korteTekst(400)).min(1).max(3),
        beeld: beeldId,
        beeldFocus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).default("50% 50%"),
        knop,
      }),
    )
    .min(1)
    .max(3),
});

const klanten = z.object({ ...sectieBasis, type: z.literal("klanten"), kop: korteTekst(80) });

const faq = z.object({
  ...sectieBasis,
  type: z.literal("faq"),
  kop: korteTekst(80),
  vragen: z.array(z.object({ vraag: korteTekst(200), antwoord: z.array(korteTekst(1200)).min(1).max(6) })).min(1).max(20),
  knop: knop.optional(),
});

const contact = z.object({
  ...sectieBasis,
  type: z.literal("contact"),
  kop: korteTekst(80),
  tekst: z.array(korteTekst(400)).max(4).default([]),
  knop,
  subkop: korteTekst(120).optional(),
  toonBedrijfsgegevens: z.boolean().default(false),
});

const cyclus = z.object({
  ...sectieBasis,
  type: z.literal("cyclus"),
  stappen: z.array(z.object({ nummer: z.string().regex(/^\d{2}$/), naam: korteTekst(40), vraag: korteTekst(80) })).min(2).max(5),
  terug: korteTekst(80),
  tekst: z.array(korteTekst(600)).default([]),
});

/** Een bedrag in hele euro's; de weergave ("€ 1.399", "excl. btw") komt uit de code en site.json. */
const prijs = z.object({
  vanaf: z.boolean().default(false),
  bedrag: z.number({ error: "Een prijs is een getal, bv. 997." }).int().positive().max(100000),
  /** Wat na het bedrag komt, bv. "per maand" of "voor 10 sessies". */
  eenheid: korteTekst(40).optional(),
  /** Tekst vóór het bedrag, bv. "Kaarten". */
  voor: korteTekst(40).optional(),
});

const aanbodDeel = z.object({
  ...sectieBasis,
  type: z.literal("aanbod-deel"),
  nummer: z.string().regex(/^\d{2}$/),
  titel: korteTekst(80),
  intro: z.array(korteTekst(600)).default([]),
  blokken: z
    .array(
      z.object({
        kop: korteTekst(60),
        tekst: z.array(korteTekst(600)).default([]),
        lijst: z.array(korteTekst(400)).default([]),
        naschrift: z.array(korteTekst(600)).default([]),
      }),
    )
    .default([]),
  /** Kopje boven de prijs, bv. "Wat het kost". Leeg = geen kopje. */
  prijsKop: korteTekst(40).optional(),
  prijzen: z.array(prijs).min(1).max(4),
  prijsToelichting: z.array(korteTekst(400)).default([]),
  inzet: beeldId.optional(),
});

const methode = z.object({
  ...sectieBasis,
  type: z.literal("methode"),
  kop: korteTekst(80),
  letters: z.array(z.object({ letter: z.string().regex(/^[A-Z]$/), woord: korteTekst(30), tekst: korteTekst(400) })).min(2).max(10),
});

const punten = z.object({
  ...sectieBasis,
  type: z.literal("punten"),
  kop: korteTekst(160),
  items: z.array(z.object({ nadruk: korteTekst(200), tekst: korteTekst(800).optional() })).min(1).max(10),
});

const verhaal = z.object({
  ...sectieBasis,
  type: z.literal("verhaal"),
  /** Eén alinea (40–90 woorden) die woord voor woord oplicht bij het scrollen. */
  tekst: korteTekst(900),
});

const slotzin = z.object({
  ...sectieBasis,
  type: z.literal("slotzin"),
  regels: z.array(korteTekst(60)).min(1).max(3),
  /** Letters die dichtdrukken als de zin het midden van het scherm nadert (kinetic-type, AC-B8). */
  kinetisch: z.boolean().default(false),
});

export const sectie = z.discriminatedUnion("type", [
  opening,
  tekstSectie,
  vragenlijst,
  panelen,
  verwijzingen,
  klanten,
  faq,
  contact,
  cyclus,
  aanbodDeel,
  methode,
  punten,
  verhaal,
  slotzin,
]);
export type Sectie = z.infer<typeof sectie>;

/* ── Pagina ──────────────────────────────────────────────────────────────────────────────── */

export const pagina = z
  .object({
    /** Het adres: "home" wordt "/", anders "/<slug>/". */
    slug,
    /** <title>, ≤ 60 tekens (AC-T5). */
    titel: korteTekst(60),
    /** Meta-description, ≤ 155 tekens (AC-T5). */
    beschrijving: korteTekst(155),
    /** Paginakop (h1) als de pagina niet met een opening begint. */
    kop: korteTekst(90).optional(),
    /** Alleen tonen als deze schakelaar in site.json aan staat (bv. "leeszaal"). */
    schakelaar: z.string().optional(),
    ogBeeld: beeldId.optional(),
    secties: z.array(sectie).min(1).max(40),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    p.secties.forEach((s, i) => {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", path: ["secties", i, "id"], message: `Het anker "${s.id}" komt twee keer voor.` });
      ids.add(s.id);
    });
    const openingen = p.secties.filter((s) => s.type === "opening").length;
    if (openingen > 1) ctx.addIssue({ code: "custom", path: ["secties"], message: "Een pagina heeft hoogstens één opening." });
    if (openingen === 0 && !p.kop) ctx.addIssue({ code: "custom", path: ["kop"], message: "Een pagina zonder opening heeft een kop nodig." });
    if (p.secties[0]?.type !== "opening" && openingen === 1)
      ctx.addIssue({ code: "custom", path: ["secties", 0], message: "De opening staat altijd bovenaan." });
  });
export type Pagina = z.infer<typeof pagina>;

/* ── Site ────────────────────────────────────────────────────────────────────────────────── */

export const site = z.object({
  naam: korteTekst(60),
  contact: z.object({
    email: z.email({ error: "Geen geldig e-mailadres." }),
    /** In internationale vorm, alleen cijfers na de +, bv. "+31687673886". */
    telefoon: z.string().regex(/^\+\d{8,15}$/),
    /** Zoals het op de site staat, bv. "+31 6 87 67 38 86". */
    telefoonWeergave: korteTekst(30),
    linkedin: z.url().regex(/^https:\/\/www\.linkedin\.com\//),
    linkedinWeergave: korteTekst(80),
    calendly: z.url().regex(/^https:\/\/calendly\.com\//),
  }),
  bedrijf: z.object({
    handelsnaam: korteTekst(80),
    rechtsvorm: korteTekst(80).optional(),
    straat: korteTekst(80),
    postcode: korteTekst(10),
    plaats: korteTekst(60),
    kvk: z.string().regex(/^\d{8}$/),
    /** Leeg = de regel ontbreekt op de site (V15). */
    btwId: z.string().default(""),
  }),
  /** Tekst achter elke prijs (V12). */
  btwLabel: korteTekst(20),
  navigatie: z.array(z.object({ label: korteTekst(30), pad: z.string().regex(/^\/[a-z0-9-]+\/$/), schakelaar: z.string().optional() })).min(1).max(7),
  kennismakingLabel: korteTekst(40),
  klanten: z
    .array(z.object({ naam: korteTekst(60), logo: z.string().regex(/^\/media\/klanten\/[a-z0-9-]+\.(svg|png)$/).optional(), logoVerhouding: z.number().positive().optional() }))
    .max(12),
  credit: z.object({ tekst: korteTekst(60), url: z.url() }),
  schakelaars: z.object({
    leeszaal: z.boolean(),
    kantlijn: z.boolean(),
    kineticType: z.boolean(),
  }),
  keuzehulp: z.object({
    knop: korteTekst(40),
    vraag: korteTekst(80),
    onderwerpen: z.array(z.object({ id: slug, label: korteTekst(40), onderwerp: korteTekst(80) })).min(2).max(8),
    tweedeVraag: korteTekst(80),
    kennismaking: korteTekst(60),
    mail: korteTekst(60),
    bellen: korteTekst(60),
    terug: korteTekst(30),
    sluiten: korteTekst(30),
  }),
  cookiebanner: z.object({
    tekst: korteTekst(300),
    accepteren: korteTekst(30),
    weigeren: korteTekst(30),
    instellingen: korteTekst(40),
    meerLezen: korteTekst(40),
  }),
  nietGevonden: z.object({ kop: korteTekst(80), tekst: korteTekst(200), knop: korteTekst(40), beeld: beeldId }),
  voet: z.object({ privacyLabel: korteTekst(30), skiplink: korteTekst(40), menu: korteTekst(20), sluitMenu: korteTekst(30) }),
  /** Korte vaste teksten in de opmaak (labels, schermlezerteksten). */
  labels: z.object({
    kiesStap: korteTekst(40),
    stapVan: korteTekst(20),
    cyclus: korteTekst(60),
    kvk: korteTekst(10),
    btw: korteTekst(10),
    linkedin: korteTekst(20),
    hoofdmenu: korteTekst(30),
    home: korteTekst(30),
  }),
});
export type Site = z.infer<typeof site>;

/* ── Kantlijn: notities en markeringen (V14, AC-B6/B7) ────────────────────────────────────── */

/** Alleen deze notities, allemaal uit de bron (PRD-001 §6.3). */
export const NOTITIES = ["Wat wil je?", "HOE DAN??", "Lees!", "MEER WETEN", "Rebel by nature, not by nurture.", "Blijf vragen.", "Nieuwsgierigheid is verzet."] as const;

export const kantlijn = z
  .object({
    notities: z.array(
      z.object({
        pagina: slug,
        sectie: slug,
        tekst: z.enum(NOTITIES, { error: `Een notitie is één van: ${NOTITIES.join(" · ")}` }),
        kleur: z.enum(["blauw", "geel"]),
        pijl: z.enum(["pijl-gebogen", "pijl-recht", "pijl-notitie"]).optional(),
        /** "kantlijn" = naast de tekst; "foto" = op de foto van de opening. */
        plek: z.enum(["kantlijn", "foto"]).default("kantlijn"),
      }),
    ),
    markeringen: z.array(
      z.object({
        pagina: slug,
        sectie: slug,
        tekst: korteTekst(200),
        stijl: z.enum(["markeerstift", "doorhaling"]).default("markeerstift"),
        omcirkeld: z.boolean().default(false),
      }),
    ),
  })
  .superRefine((k, ctx) => {
    const perSectie = new Map<string, number>();
    k.notities.forEach((n, i) => {
      const sleutel = `${n.pagina}/${n.sectie}`;
      perSectie.set(sleutel, (perSectie.get(sleutel) ?? 0) + 1);
      if ((perSectie.get(sleutel) ?? 0) > 1) ctx.addIssue({ code: "custom", path: ["notities", i], message: `Hoogstens één notitie per sectie (${sleutel}).` });
    });
    const markeringen = new Map<string, number>();
    k.markeringen.forEach((m, i) => {
      const sleutel = `${m.pagina}/${m.sectie}`;
      markeringen.set(sleutel, (markeringen.get(sleutel) ?? 0) + 1);
      if ((markeringen.get(sleutel) ?? 0) > 2) ctx.addIssue({ code: "custom", path: ["markeringen", i], message: `Hoogstens twee markeringen per sectie (${sleutel}).` });
    });
  });
export type Kantlijn = z.infer<typeof kantlijn>;

/* ── Beelden ─────────────────────────────────────────────────────────────────────────────── */

export const media = z.object({
  beelden: z.array(
    z.object({
      id: beeldId,
      bestand: z.string().regex(/^\/media\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/),
      alt: korteTekst(200),
      breedte: z.number().int().positive(),
      hoogte: z.number().int().positive(),
      soort: z.enum(["foto", "inzet"]).default("foto"),
    }),
  ),
});
export type Media = z.infer<typeof media>;

/** Leesbare foutmelding met bestand en veld, voor de bouw én voor de koppeling. */
export function beschrijfFout(bestand: string, fout: z.ZodError): string {
  return fout.issues.map((i) => `${bestand} → ${i.path.length ? i.path.join(".") : "(bestand)"}: ${i.message}`).join("\n");
}
