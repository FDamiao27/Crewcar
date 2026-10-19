import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getPublishedSite } from "@/lib/queries/public";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sessão", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  const { settings } = await getPublishedSite();
  return (
    <main className="hero-backdrop flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <Logo brandName={settings.brandName} logo={settings.logo} size="lg" />
          <p className="eyebrow">Back office</p>
        </div>
        <div className="rounded-sm surface p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <h1 className="text-lg font-semibold text-white">Iniciar sessão</h1>
          <p className="mt-1 mb-6 text-sm text-metal">Área reservada à equipa {settings.brandName}.</p>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-metal">
          Sem acesso? Peça ao proprietário da conta para criar o seu utilizador.
        </p>
      </div>
    </main>
  );
}
