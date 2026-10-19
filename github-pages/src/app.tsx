import { Eye, RotateCcw } from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect, type ReactNode } from "react";
import Link from "next/link";
import { Outlet, Route, Routes, useLocation } from "react-router";
import { CookieConsent } from "@/components/site/consent";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { activeBanners } from "@/lib/site-schema";
import { todayIn } from "@/lib/time";
import { AboutPage } from "./pages/about";
import { CatalogPage } from "./pages/catalog";
import { ContactPage } from "./pages/contacts";
import { HomePage } from "./pages/home";
import { LegalPage } from "./pages/legal";
import { NotFoundPage } from "./pages/not-found";
import { VehiclePage } from "./pages/vehicle";
import { withBase } from "./config";
import { isPreview, setPreview } from "./data";
import { ShowroomProvider, useShowroomState } from "./showroom";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="[--header-offset:4rem] md:[--header-offset:4.5rem]">{children}</div>;
}

function Layout() {
  const { state, reload } = useShowroomState();

  // Cores e tipografia definidas no back office
  useLayoutEffect(() => {
    if (state.status !== "ready") return;
    const { colors, font } = state.data.settings.appearance;
    const root = document.documentElement;
    root.dataset.font = font;
    root.style.setProperty("--cc-ink", colors.ink);
    root.style.setProperty("--cc-ink-2", colors.ink2);
    root.style.setProperty("--cc-graphite", colors.graphite);
    root.style.setProperty("--cc-metal", colors.metal);
    root.style.setProperty("--cc-soft", colors.soft);
    root.style.setProperty("--cc-white", colors.white);
  }, [state]);

  if (state.status === "loading") {
    return (
      <Frame>
        <div className="hero-backdrop flex min-h-dvh flex-col items-center justify-center gap-6" aria-busy="true">
          <Logo brandName="CREW CAR" size="lg" />
          <Spinner label="A carregar…" />
        </div>
      </Frame>
    );
  }
  if (state.status === "error") {
    return (
      <Frame>
        <div className="hero-backdrop flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
          <Logo brandName="CREW CAR" size="lg" />
          <p className="max-w-md text-sm text-metal" role="alert">
            {state.message}
          </p>
          <Button variant="secondary" onClick={reload} icon={<RotateCcw className="size-4" />}>
            Tentar novamente
          </Button>
        </div>
      </Frame>
    );
  }

  const { settings, content, pages } = state.data;
  const banners = activeBanners(content, todayIn(settings.regional.timezone));
  const legalSlugs = pages.map((p) => p.slug);

  return (
    <>
      <a
        href="#conteudo"
        className="fixed top-2 left-2 z-[100] -translate-y-20 rounded-sm bg-white px-4 py-2 text-sm font-semibold text-ink focus:translate-y-0"
      >
        Saltar para o conteúdo
      </a>
      {isPreview() && (
        <div className="fixed inset-x-0 bottom-0 z-[95] flex items-center justify-center gap-3 border-t border-warn/40 bg-ink-2/95 px-4 py-2.5 text-xs text-soft backdrop-blur">
          <Eye className="size-4 text-warn" aria-hidden="true" />
          <span>Pré-visualização do rascunho — os visitantes continuam a ver a versão publicada.</span>
          <a href={withBase("/api/preview/sair")} className="font-semibold text-white underline underline-offset-2">
            Sair
          </a>
        </div>
      )}
      <div className={banners.length ? "[--header-offset:6.5rem] md:[--header-offset:7rem]" : "[--header-offset:4rem] md:[--header-offset:4.5rem]"}>
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
        <main id="conteudo">
          <Outlet />
        </main>
      </div>
      <SiteFooter settings={settings} content={content} legalSlugs={legalSlugs} />
      <CookieConsent
        enabled={settings.cookies.bannerEnabled}
        message={settings.cookies.message}
        analytics={settings.analytics}
        hasCookiePage={legalSlugs.includes("cookies")}
      />
    </>
  );
}

const AdminApp = lazy(() => import("./admin/app"));

/** Ativa ou desativa a pré-visualização de rascunhos e volta ao website. */
function PreviewSwitch({ on }: { on: boolean }) {
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("destino") ?? "/";
    const safe = /^\/(?!\/)[\w\-/?=&%.]*$/.test(target) && !target.startsWith("/admin") ? target : "/";
    setPreview(on);
    window.location.replace(withBase(on ? safe : "/"));
  }, [on]);
  return null;
}

export function App() {
  return (
    <Routes>
      <Route
        path="admin/*"
        element={
          <Suspense fallback={null}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="api/admin/preview" element={<PreviewSwitch on />} />
      <Route path="api/preview/sair" element={<PreviewSwitch on={false} />} />
      <Route path="*" element={<Showroom />} />
    </Routes>
  );
}

function Showroom() {
  return (
    <ShowroomProvider>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="viaturas" element={<CatalogPage />} />
          <Route path="viaturas/:slug" element={<VehiclePage />} />
          <Route path="o-stand" element={<AboutPage />} />
          <Route path="contactos" element={<ContactPage />} />
          <Route path="privacidade" element={<LegalPage slug="privacidade" />} />
          <Route path="cookies" element={<LegalPage slug="cookies" />} />
          <Route path="informacao-legal" element={<LegalPage slug="informacao-legal" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ShowroomProvider>
  );
}
