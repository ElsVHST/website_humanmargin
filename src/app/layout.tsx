// ⚡ Seveke Creative // ​‌​‌​​‌‌‍​‌‌​​‌​‌‍​‌‌‌​‌‌​‍​‌‌​​‌​‌‍​‌‌​‌​‌‌‍​‌‌​​‌​‌‍​‌​​​​‌‌‍​‌‌‌​​‌​‍​‌‌​​‌​‌‍​‌‌​​​​‌‍​‌‌‌​‌​​‍​‌‌​‌​​‌‍​‌‌‌​‌‌​‍​‌‌​​‌​‌
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./secties.css";
import "@/features/hero-motion/hero-motion.css";
import "@/features/header-state/header-state.css";
import "@/features/reveal-on-scroll/reveal-on-scroll.css";
import "@/features/story-word-light/story-word-light.css";
import "@/features/horizontal-scroll-pin/horizontal-scroll-pin.css";
import "@/features/kinetic-type/kinetic-type.css";
import { isVoorbeeld, leesSite, siteUrl } from "@/lib/content";
import { Beweging } from "@/components/Beweging";
import { Keuzehulp } from "@/components/Keuzehulp";
import { Cookiebanner } from "@/components/Cookiebanner";

/*
 * Letters (brandbook dia 7). Alles zelf gehost in src/app/fonts/, met hun OFL-licentie: de browser vraagt
 * nooit iets aan Google (AC-T7), en de bouw hangt niet af van Google Fonts. Inter, Playfair Display
 * (cursief) en Archivo zijn de latin-subsets die Google Fonts zelf serveert (variabel); Archivo Black
 * komt uit de aangeleverde TTF. Alleen de titelletter en de tekstletter worden vooraf geladen (AC-T6);
 * de handschriftfonts laadt features/kantlijn pas na de eerste scroll (AC-T4).
 */
const archivoBlack = localFont({
  src: "./fonts/ArchivoBlack-Regular.ttf",
  variable: "--font-archivo-black",
  weight: "400",
  display: "swap",
  preload: true,
  fallback: ["Arial Black", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});
const inter = localFont({
  src: "./fonts/Inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});
const playfair = localFont({
  src: "./fonts/PlayfairDisplay-Italic-latin.woff2",
  variable: "--font-playfair",
  weight: "400 900",
  style: "italic",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});
/** Variabele Archivo met breedte-as (wdth 62–125), alleen voor kinetic-type op de slotzin van het manifest (AC-B8). */
const archivo = localFont({
  src: "./fonts/Archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["Arial Black", "Arial", "sans-serif"],
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: leesSite().naam,
    robots: isVoorbeeld() ? { index: false, follow: false } : undefined,
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = { themeColor: "#111010", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const site = leesSite();
  const heeftGa = process.env.NEXT_PUBLIC_GA_ID !== "";
  return (
    <html lang="nl" className={`${archivoBlack.variable} ${inter.variable} ${playfair.variable} ${archivo.variable}`}>
      <head>
        {/* Markeert dat JavaScript draait, vóór de eerste paint: alleen dan verbergen we iets om het later te tonen. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a className="skiplink" href="#inhoud">
          {site.voet.skiplink}
        </a>
        {children}
        <Beweging kinetisch={site.schakelaars.kineticType} />
        <Keuzehulp
          teksten={site.keuzehulp}
          contact={{ email: site.contact.email, telefoon: site.contact.telefoon, telefoonWeergave: site.contact.telefoonWeergave, calendly: site.contact.calendly }}
        />
        {heeftGa && <Cookiebanner teksten={site.cookiebanner} />}
      </body>
    </html>
  );
}
