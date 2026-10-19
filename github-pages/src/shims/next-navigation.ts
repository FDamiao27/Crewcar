import { useLocation, useNavigate } from "react-router";

// Substitui next/navigation (apenas o que os componentes partilhados utilizam).
type Options = { scroll?: boolean };

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string, opts?: Options) => navigate(href, { preventScrollReset: opts?.scroll === false }),
    replace: (href: string, opts?: Options) => navigate(href, { replace: true, preventScrollReset: opts?.scroll === false }),
    back: () => navigate(-1),
    // No back office os dados são recarregados sem recarregar a página
    refresh: () => (window.location.pathname.includes("/admin") ? window.dispatchEvent(new Event("cc-refresh")) : window.location.reload()),
    prefetch: () => {},
  };
}
