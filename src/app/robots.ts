import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getPublishedSite } from "@/lib/queries/public";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { settings } = await getPublishedSite();
  if (!settings.publishing.allowIndexing) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
