import { Fragment, type ReactNode } from "react";

// Renderizador de Markdown simples e seguro (sem HTML arbitrário) para páginas legais
// e textos institucionais. Suporta: ## títulos, parágrafos, listas (- e 1.), **negrito**,
// *itálico*, [ligações](https://…) e quebras de linha.

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(h) && !/^\/\//.test(h)) return h;
  return null;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[2]) nodes.push(<strong key={key}>{m[2]}</strong>);
    else if (m[4]) nodes.push(<em key={key}>{m[4]}</em>);
    else if (m[6]) {
      const href = safeHref(m[7]);
      nodes.push(
        href ? (
          <a key={key} href={href} {...(/^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {m[6]}
          </a>
        ) : (
          m[6]
        ),
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function withBreaks(text: string, key: string): ReactNode[] {
  return text.split("\n").flatMap((line, i, arr) => [
    <Fragment key={`${key}-l${i}`}>{inline(line, `${key}-${i}`)}</Fragment>,
    i < arr.length - 1 ? <br key={`${key}-br${i}`} /> : null,
  ]);
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: ReactNode[] = [];
  blocks.forEach((raw, bi) => {
    const block = raw.trim();
    if (!block) return;
    const key = `b${bi}`;
    const heading = /^(#{1,4})\s+(.*)$/.exec(block);
    if (heading && !block.includes("\n")) {
      const level = Math.min(4, heading[1].length + 1);
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      out.push(<Tag key={key}>{inline(heading[2], key)}</Tag>);
      return;
    }
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push(
        <ul key={key}>
          {lines.map((l, i) => (
            <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${key}-${i}`)}</li>
          ))}
        </ul>,
      );
      return;
    }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      out.push(
        <ol key={key}>
          {lines.map((l, i) => (
            <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `${key}-${i}`)}</li>
          ))}
        </ol>,
      );
      return;
    }
    out.push(<p key={key}>{withBreaks(block, key)}</p>);
  });
  return <div className={className ?? "prose-cc"}>{out}</div>;
}
