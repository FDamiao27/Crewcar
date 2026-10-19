import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { NotFoundContent } from "@/components/site/not-found-content";
import { getPublishedSite } from "@/lib/queries/public";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false } };

export default async function NotFound() {
  const { settings } = await getPublishedSite();
  return (
    <div className="[--header-offset:4.5rem]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center px-5 md:px-8">
          <Link href="/" aria-label="Página inicial">
            <Logo brandName={settings.brandName} logo={settings.logo} />
          </Link>
        </div>
      </header>
      <main>
        <NotFoundContent />
      </main>
    </div>
  );
}
