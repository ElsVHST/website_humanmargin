import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Zet de werkmap vast op dit project, zodat een package-lock.json in een bovenliggende map
// Turbopack niet op het verkeerde spoor zet.
const projectRoot = dirname(fileURLToPath(import.meta.url));

/*
 * Voorbeeldlink of echte site?
 * - Een preview-deployment op Vercel (VERCEL_ENV=preview) is altijd een voorbeeld.
 * - NEXT_PUBLIC_DEMO=1 maakt ook een productiebouw tot voorbeeld (de demo op ons eigen account).
 * Een voorbeeld krijgt noindex in de HTML én een X-Robots-Tag-header.
 */
const isVoorbeeld = process.env.NEXT_PUBLIC_DEMO === "1" || process.env.VERCEL_ENV === "preview";

/*
 * Next bakt een NEXT_PUBLIC_-variabele alleen in als hij bij de bouw bestaat. Ontbreekt hij, dan
 * blijft `process.env.X` in de bundel staan en wordt de code erachter niet weggesnoeid. Daarom
 * krijgt elke schakelaar hier een vaste standaardwaarde. Zonder GA-ID zit er dan 0 regels
 * Google Analytics in de bundel (gecontroleerd door qa/check-bundel.mjs).
 */
const env = {
  NEXT_PUBLIC_SITE_URL: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://humanmargin.eu").replace(/\/$/, ""),
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID ?? "",
  NEXT_PUBLIC_DEMO: isVoorbeeld ? "1" : "0",
};

/*
 * Beveiligingsheaders (security-baseline blok H). Geen nonce-CSP: die maakt elke pagina dynamisch,
 * en deze site is statisch voorgerenderd. De site heeft geen invoer van bezoekers; tekst uit de
 * content wordt door React als tekst geschreven. Google Analytics staat pas in de CSP toegestaan
 * als er een meet-ID is, en laadt ook dan pas na "Accepteren".
 */
const heeftGa = env.NEXT_PUBLIC_GA_ID !== "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${heeftGa ? " https://www.googletagmanager.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${heeftGa ? " https://*.google-analytics.com https://*.googletagmanager.com" : ""}`,
  "font-src 'self'",
  `connect-src 'self'${heeftGa ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
  ...(isVoorbeeld ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  turbopack: { root: projectRoot },
  // De MCP-route leest AGENTS.md om ChatGPT dezelfde regels mee te geven als elke andere agent
  // (PRD-002 AC-S0). Zonder deze regel laat de bouw dat bestand weg uit de serverbundel.
  outputFileTracingIncludes: { "/api/mcp": ["./AGENTS.md"] },
  // De controlereeks bouwt proeven (een nieuwe pagina, een meet-ID) naar een eigen map, zodat de
  // echte bouw in .next onaangeroerd blijft.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  env,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 828, 1080, 1280, 1600, 2048],
    imageSizes: [96, 160, 200, 256, 320, 400],
  },
  async headers() {
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
