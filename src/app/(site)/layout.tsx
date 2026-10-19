import { Eye } from "lucide-react";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { CookieConsent } from "@/components/site/consent";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Logo } from "@/components/site/logo";
import { getPublishedPageSlugs } from "@/lib/queries/public";
import { getSite } from "@/lib/queries/site";
import { activeBanners } from "@/lib/site-schema";
import { todayIn } from "@/lib/time";
import Link from "next/link";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [{ settings, content, preview }, legalSlugs, nonce] = await Promise.all([
    getSite(),
    getPublishedPageSlugs(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  const banners = activeBanners(content, todayIn(settings.regional.timezone));

  return (
    <>
      <a
        href="#conteudo"
        className="fixed top-2 left-2 z-[100] -translate-y-20 rounded-sm bg-white px-4 py-2 text-sm font-semibold text-ink focus:translate-y-0"
      >
        Saltar para o conteúdo
      </a>
      {preview && (
        <div className="fixed inset-x-0 bottom-0 z-[95] flex items-center justify-center gap-3 border-t border-warn/40 bg-ink-2/95 px-4 py-2.5 text-xs text-soft backdrop-blur">
          <Eye className="size-4 text-warn" aria-hidden="true" />
          <span>Pré-visualização do rascunho — os visitantes continuam a ver a versão publicada.</span>
          <a href="/api/preview/sair" className="font-semibold text-white underline underline-offset-2">
            Sair
          </a>
        </div>
      )}
      <div
        className={
          banners.length
            ? "[--header-offset:6.5rem] md:[--header-offset:7rem]"
            : "[--header-offset:4rem] md:[--header-offset:4.5rem]"
        }
      >
        <SiteHeader
          logo={<Logo brandName={settings.brandName} logo={settings.logo} />}
          brandName={settings.brandName}
          phone={settings.contact.phone || undefined}
          banner={
            banners[0] ? (
              <div className="flex h-10 items-center justify-center gap-4 border-b border-line bg-graphite px-5 text-[0.78rem] text-soft">
                <span className="truncate">{banners[0].text}</span>
                {banners[0].linkUrl && banners[0].linkLabel && (
                  <Link href={banners[0].linkUrl} className="shrink-0 font-semibold text-white underline underline-offset-4">
                    {banners[0].linkLabel}
                  </Link>
                )}
              </div>
            ) : null
          }
        />
        <main id="conteudo">{children}</main>
      </div>
      <SiteFooter settings={settings} content={content} legalSlugs={legalSlugs} />
      <CookieConsent
        enabled={settings.cookies.bannerEnabled}
        message={settings.cookies.message}
        analytics={settings.analytics}
        nonce={nonce}
        hasCookiePage={legalSlugs.includes("cookies")}
      />
    </>
  );
}
