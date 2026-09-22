import type { MetadataRoute } from "next";
import { leesPaginas, paginaPad, siteUrl } from "@/lib/content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return leesPaginas().map((p) => ({
    url: `${siteUrl()}${paginaPad(p.slug)}`,
    changeFrequency: "monthly",
    priority: p.slug === "home" ? 1 : 0.7,
  }));
}
