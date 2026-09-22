import type { Metadata } from "next";
import type { Pagina } from "./schema";
import { isVoorbeeld, leesSite, paginaPad, siteUrl } from "./content";

/** Metadata per pagina (AC-T5): unieke titel en beschrijving, canonical op humanmargin.eu, OG. */
export function metadataVoor(pagina: Pagina): Metadata {
  const url = `${siteUrl()}${paginaPad(pagina.slug)}`;
  return {
    title: { absolute: pagina.titel },
    description: pagina.beschrijving,
    alternates: { canonical: url },
    openGraph: {
      title: pagina.titel,
      description: pagina.beschrijving,
      url,
      siteName: leesSite().naam,
      locale: "nl_NL",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: pagina.titel, description: pagina.beschrijving },
    robots: isVoorbeeld() ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/** JSON-LD: ProfessionalService + Person (home, over mij) en FAQPage (home). */
export function jsonLdVoor(pagina: Pagina): object[] {
  const site = leesSite();
  const basis = siteUrl();
  const persoon = {
    "@type": "Person",
    "@id": `${basis}/over-mij/#els`,
    name: "Els Verheirstraeten",
    jobTitle: "Certified AI Compliance Officer",
    worksFor: { "@id": `${basis}/#human-margin` },
    sameAs: [site.contact.linkedin],
  };
  const dienst = {
    "@type": "ProfessionalService",
    "@id": `${basis}/#human-margin`,
    name: site.naam,
    url: `${basis}/`,
    email: site.contact.email,
    telephone: site.contact.telefoon,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.bedrijf.straat,
      postalCode: site.bedrijf.postcode,
      addressLocality: site.bedrijf.plaats,
      addressCountry: "NL",
    },
    founder: { "@id": persoon["@id"] },
    sameAs: [site.contact.linkedin],
  };
  const uit: object[] = [];
  if (pagina.slug === "home" || pagina.slug === "over-mij") uit.push({ "@context": "https://schema.org", "@graph": [dienst, persoon] });
  if (pagina.slug === "home") {
    const faq = pagina.secties.find((s) => s.type === "faq");
    if (faq && faq.type === "faq") {
      uit.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.vragen.map((v) => ({ "@type": "Question", name: v.vraag, acceptedAnswer: { "@type": "Answer", text: v.antwoord.join(" ") } })),
      });
    }
  }
  return uit;
}
