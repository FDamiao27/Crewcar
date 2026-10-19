import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getPublishedPageSlugs, getPublishedSite, sitemapVehicles } from "@/lib/queries/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { settings } = await getPublishedSite();
  const [vehicles, pages] = await Promise.all([sitemapVehicles(false), getPublishedPageSlugs()]);
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily" as const, priority: 1 },
    { url: `${base}/viaturas`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${base}/o-stand`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${base}/contactos`, changeFrequency: "monthly" as const, priority: 0.6 },
    ...pages.map((slug) => ({ url: `${base}/${slug}`, changeFrequency: "yearly" as const, priority: 0.2 })),
    ...vehicles.map((v) => ({
      url: `${base}/viaturas/${v.slug}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ].filter(() => settings.publishing.allowIndexing);
}
