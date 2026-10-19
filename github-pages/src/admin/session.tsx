import { RotateCcw } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Notice, Skeleton } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { adminDb, setCurrentAdmin, type AdminUser } from "./core";

// Sessão do back office: a conta do Supabase Auth só dá acesso se o e-mail estiver
// registado e ativo em admin_users (verificado pela função current_admin na base de dados).

type SessionState = { status: "loading" } | { status: "anonymous" } | { status: "ready"; user: AdminUser };

const SessionContext = createContext<{ state: SessionState; refresh: () => Promise<AdminUser | null> } | null>(null);

export async function fetchCurrentAdmin(): Promise<AdminUser | null> {
  const { data: session } = await adminDb.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await adminDb.rpc("current_admin").maybeSingle<AdminUser>();
  if (error) throw error;
  return data ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const refresh = useCallback(async () => {
    try {
      const user = await fetchCurrentAdmin();
      setCurrentAdmin(user);
      setState(user ? { status: "ready", user } : { status: "anonymous" });
      return user;
    } catch {
      setCurrentAdmin(null);
      setState({ status: "anonymous" });
      return null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const { data } = adminDb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setCurrentAdmin(null);
        setState({ status: "anonymous" });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  return <SessionContext.Provider value={{ state, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fora de SessionProvider");
  return ctx;
}

export function useAdmin(): AdminUser {
  const { state } = useSession();
  if (state.status !== "ready") throw new Error("Sem sessão de administrador");
  return state.user;
}

export function FullScreenLoader() {
  return (
    <div className="hero-backdrop flex min-h-dvh flex-col items-center justify-center gap-6" aria-busy="true">
      <Logo brandName="CREW CAR" size="lg" />
      <Spinner label="A carregar…" />
    </div>
  );
}

/** Exige sessão de administrador (e, opcionalmente, uma permissão) para apresentar o conteúdo. */
export function RequireAdmin({ permission, children }: { permission?: Permission; children: ReactNode }) {
  const { state } = useSession();
  const location = useLocation();
  if (state.status === "loading") return <FullScreenLoader />;
  if (state.status === "anonymous") {
    const next = location.pathname + location.search;
    return <Navigate to={`/admin/login${next !== "/admin" ? `?next=${encodeURIComponent(next)}` : ""}`} replace />;
  }
  if (permission && !can(state.user.role, permission)) return <Navigate to="/admin?erro=permissao" replace />;
  return <>{children}</>;
}

type DataState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Carrega os dados de uma página e volta a carregá-los sempre que uma ação os altera. */
export function useAdminData<T>(loader: () => Promise<T>, deps: unknown[]): DataState<T> & { reload: () => void } {
  const [state, setState] = useState<DataState<T>>({ status: "loading" });
  const seq = useRef(0);
  const load = useCallback(
    (initial: boolean) => {
      const id = ++seq.current;
      if (initial) setState({ status: "loading" });
      loader().then(
        (data) => id === seq.current && setState({ status: "ready", data }),
        (err: unknown) => {
          console.error(err);
          if (id === seq.current) setState({ status: "error", message: "Ocorreu um erro ao obter os dados. Verifique a ligação e tente novamente." });
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  useEffect(() => {
    load(true);
    const onRefresh = () => load(false);
    window.addEventListener("cc-refresh", onRefresh);
    return () => window.removeEventListener("cc-refresh", onRefresh);
  }, [load]);
  return { ...state, reload: () => load(true) };
}

/** Apresenta o estado de carregamento/erro ou o conteúdo da página. */
export function Loaded<T>({ state, children }: { state: DataState<T> & { reload: () => void }; children: (data: T) => ReactNode }) {
  if (state.status === "loading")
    return (
      <div aria-busy="true" aria-label="A carregar">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="mx-auto max-w-xl py-16">
        <Notice tone="danger" title="Não foi possível carregar esta página">
          {state.message}
        </Notice>
        <Button className="mt-4" variant="secondary" onClick={state.reload} icon={<RotateCcw className="size-4" />}>
          Tentar novamente
        </Button>
      </div>
    );
  return <>{children(state.data)}</>;
}

/** Título do separador do navegador nas páginas do back office. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Back office` : "Back office";
  }, [title]);
}
