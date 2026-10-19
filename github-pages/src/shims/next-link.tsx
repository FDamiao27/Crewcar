import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router";
import { withBase } from "../config";

// Substitui next/link pelo Link do React Router (com o caminho base do GitHub Pages).
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _prefetch, scroll, replace, ...rest }, ref) {
  if (/^(https?:|mailto:|tel:|#|\/\/)/.test(href)) return <a ref={ref} href={href} {...rest} />;
  if (rest.target === "_blank") return <a ref={ref} href={withBase(href)} {...rest} />;
  return <RouterLink ref={ref} to={href} replace={replace} preventScrollReset={scroll === false} {...rest} />;
});

export default Link;
