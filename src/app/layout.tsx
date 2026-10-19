import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import { getPublishedSite } from "@/lib/queries/public";
import { assetUrl } from "@/lib/site-schema";

// Todo o site é gerado a cada pedido a partir da base de dados (alterações visíveis de imediato).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings, content } = await getPublishedSite();
  const title = content.seo.title || settings.brandName;
  const icons = settings.favicon
    ? {
        icon: [{ url: assetUrl(settings.favicon, 64, "png"), type: "image/png", sizes: "64x64" }],
        apple: [{ url: assetUrl(settings.favicon, 180, "png"), sizes: "180x180" }],
      }
    : { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] };
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${settings.brandName}` },
    description: content.seo.description || undefined,
    applicationName: settings.brandName,
    icons,
    openGraph: {
      type: "website",
      locale: "pt_PT",
      siteName: settings.brandName,
      title,
      description: content.seo.description || undefined,
      images: content.seo.ogImage ? [{ url: assetUrl(content.seo.ogImage, 1200), width: 1200 }] : undefined,
    },
    twitter: { card: "summary_large_image" },
    robots: settings.publishing.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings } = await getPublishedSite();
  const c = settings.appearance.colors;
  const style = {
    "--cc-ink": c.ink,
    "--cc-ink-2": c.ink2,
    "--cc-graphite": c.graphite,
    "--cc-metal": c.metal,
    "--cc-soft": c.soft,
    "--cc-white": c.white,
  } as CSSProperties;

  return (
    <html lang="pt-PT" data-font={settings.appearance.font} style={style}>
      <body>{children}</body>
    </html>
  );
}
