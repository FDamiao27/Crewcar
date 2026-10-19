import { useLocation, useNavigate } from "react-router";

// Substitui next/navigation (apenas o que os componentes partilhados utilizam).
type Options = { scroll?: boolean };

export function usePathname(): string {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string, opts?: Options) => navigate(href, { preventScrollReset: opts?.scroll === false }),
    replace: (href: string, opts?: Options) => navigate(href, { replace: true, preventScrollReset: opts?.scroll === false }),
    back: () => navigate(-1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}
