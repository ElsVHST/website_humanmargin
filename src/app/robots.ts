import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/content";

export const dynamic = "force-static";

/** Alles mag gecrawld worden; een voorbeeldlink staat op noindex via de meta-tag en X-Robots-Tag. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
