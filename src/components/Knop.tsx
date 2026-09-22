import Link from "next/link";
import { leesSite } from "@/lib/content";
import type { z } from "zod";
import type { knopDoel } from "@/lib/schema";

type Doel = z.infer<typeof knopDoel>;

/** Zet een knopdoel om naar een adres. Vaste doelen lezen hun adres uit site.json (AC-I6). */
export function doelNaarLink(doel: Doel) {
  const { contact } = leesSite();
  switch (doel) {
    case "kennismaking":
      return { href: contact.calendly, extern: true, event: "kennismaking_klik" };
    case "mail":
      return { href: `mailto:${contact.email}`, extern: true, event: "mail_klik" };
    case "bellen":
      return { href: `tel:${contact.telefoon}`, extern: true, event: "bel_klik" };
    case "linkedin":
      return { href: contact.linkedin, extern: true, event: undefined };
    case "keuzehulp":
      // Zonder JavaScript gaat de knop gewoon naar /contact/ (AC-P6).
      return { href: "/contact/", extern: false, event: undefined, keuzehulp: true };
    default:
      return { href: doel, extern: false, event: undefined };
  }
}

type Props = {
  tekst: string;
  doel: Doel;
  stijl?: "knop" | "tekst";
  pijlen?: boolean;
  sectie?: string;
  className?: string;
  fade?: boolean;
};

export function Knop({ tekst, doel, stijl = "knop", pijlen = false, sectie, className, fade }: Props) {
  const link = doelNaarLink(doel);
  const klassen = [stijl === "knop" ? "knop" : "knop-tekst", pijlen && stijl === "knop" ? "knop--pijlen" : "", className ?? ""].filter(Boolean).join(" ");
  const data = {
    "data-event": link.event,
    "data-sectie": sectie,
    "data-keuzehulp": link.keuzehulp ? "" : undefined,
    "data-hero-fade": fade ? "" : undefined,
  };
  if (link.extern) {
    return (
      <a href={link.href} className={klassen} {...data}>
        {tekst}
      </a>
    );
  }
  return (
    <Link href={link.href} className={klassen} {...data}>
      {tekst}
    </Link>
  );
}
