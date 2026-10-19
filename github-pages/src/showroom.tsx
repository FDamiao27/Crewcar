import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadShowroom, type Showroom } from "./data";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Showroom };

const ShowroomContext = createContext<{ state: State; reload: () => void } | null>(null);

/** Carrega os dados públicos uma vez por visita (atualizados a cada carregamento da página). */
export function ShowroomProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    loadShowroom()
      .then((data) => setState({ status: "ready", data }))
      .catch((err: unknown) => {
        console.error(err);
        setState({ status: "error", message: "Não foi possível carregar as viaturas. Verifique a ligação e tente novamente." });
      });
  }, []);
  useEffect(load, [load]);
  return <ShowroomContext.Provider value={{ state, reload: load }}>{children}</ShowroomContext.Provider>;
}

export function useShowroomState() {
  const ctx = useContext(ShowroomContext);
  if (!ctx) throw new Error("useShowroomState fora de ShowroomProvider");
  return ctx;
}

/** Dados disponíveis (só usar dentro de páginas apresentadas depois do carregamento). */
export function useShowroom(): Showroom {
  const { state } = useShowroomState();
  if (state.status !== "ready") throw new Error("Dados ainda não carregados");
  return state.data;
}

/** Título e descrição da página (SEO básico numa aplicação de página única). */
export function useMeta(title: string | null, description?: string | null) {
  const { state } = useShowroomState();
  const brand = state.status === "ready" ? state.data.settings.brandName : "CREW CAR";
  useEffect(() => {
    document.title = title ? `${title} · ${brand}` : brand;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta && description) meta.content = description;
  }, [title, description, brand]);
}
