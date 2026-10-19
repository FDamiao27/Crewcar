import { useEffect, type ReactNode } from "react";

// Substitui next/script: injeta o script no <head> apenas quando o componente é apresentado
// (as ferramentas de análise só são apresentadas depois do consentimento de cookies).
type Props = { src?: string; id?: string; strategy?: string; nonce?: string; children?: ReactNode } & Record<string, unknown>;

export default function Script({ src, id, strategy: _strategy, nonce: _nonce, children, ...attrs }: Props) {
  const code = typeof children === "string" ? children : "";
  useEffect(() => {
    const el = document.createElement("script");
    if (id) el.id = id;
    if (src) {
      el.src = src;
      el.async = true;
    }
    if (code) el.text = code;
    for (const [k, v] of Object.entries(attrs)) if (typeof v === "string") el.setAttribute(k, v);
    document.head.appendChild(el);
    return () => el.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, code, id]);
  return null;
}
