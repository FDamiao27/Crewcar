import { LogIn } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/site-schema";
import { adminDb, logActivity, setCurrentAdmin } from "../core";
import { loadSettings } from "../queries";
import { fetchCurrentAdmin, FullScreenLoader, usePageTitle, useSession } from "../session";

export function LoginPage() {
  usePageTitle("Iniciar sessão");
  const { state, refresh } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings, () => undefined);
  }, []);

  if (state.status === "loading") return <FullScreenLoader />;
  const next = params.get("next") ?? "";
  const destination = /^\/admin(\/[\w\-/]*)?(\?[\w=&%-]*)?$/.test(next) ? next : "/admin";
  if (state.status === "ready" && !pending) return <Navigate to={destination} replace />;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
    const password = String(form.get("password") ?? "").slice(0, 200);
    if (!email || !password) return setError("Indique o e-mail e a palavra-passe.");
    setPending(true);
    setError(null);
    try {
      const { error: authError } = await adminDb.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(
          /rate|too many/i.test(authError.message)
            ? "Demasiadas tentativas. Aguarde alguns minutos e tente novamente."
            : "E-mail ou palavra-passe incorretos.",
        );
        return;
      }
      const user = await fetchCurrentAdmin().catch(() => null);
      if (!user) {
        // Conta de autenticação sem registo ativo em admin_users: sem acesso
        await adminDb.auth.signOut({ scope: "local" });
        setError("Esta conta não tem acesso ao back office.");
        return;
      }
      setCurrentAdmin(user);
      await logActivity({ action: "login", entityType: "sessao", summary: `${user.name} iniciou sessão` });
      await refresh();
      navigate(destination, { replace: true });
    } catch {
      setError("Não foi possível iniciar sessão. Verifique a ligação e tente novamente.");
    } finally {
      setPending(false);
    }
  };

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
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && <Notice tone="danger">{error}</Notice>}
            <Input label="E-mail" name="email" type="email" autoComplete="username" required autoFocus />
            <Input label="Palavra-passe" name="password" type="password" autoComplete="current-password" required />
            <Button type="submit" size="lg" className="w-full" loading={pending} icon={<LogIn className="size-4" />}>
              Entrar
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-metal">Sem acesso? Peça ao proprietário da conta para criar o seu utilizador.</p>
      </div>
    </main>
  );
}
