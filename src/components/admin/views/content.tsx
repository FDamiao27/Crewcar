import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ContentEditor } from "@/components/admin/content-editor";
import { PageHeader } from "@/components/admin/sidebar";
import { Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import type { Content } from "@/lib/site-schema";

export function ContentView({
  docs,
  pages,
}: {
  docs: { contentDraft: Content; hasUnpublished: boolean; contentPublishedAt: Date | null };
  pages: { slug: string; title: string; isPublished: boolean; updatedAt: Date; hasPlaceholders: boolean }[];
}) {
  return (
    <>
      <PageHeader title="Conteúdos do website" description="Edite os textos e imagens sem alterar código. Guarde como rascunho, pré-visualize e publique quando estiver pronto." />
      <ContentEditor draft={docs.contentDraft} hasUnpublished={docs.hasUnpublished} publishedAt={docs.contentPublishedAt} />

      <Panel title="Páginas legais" className="mt-12 scroll-mt-20" bodyClassName="p-0">
        <div id="paginas" />
        <ul>
          {pages.map((p) => (
            <li key={p.slug} className="border-b border-line last:border-0">
              <Link href={`/admin/conteudos/paginas/${p.slug}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02]">
                <div>
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="text-xs text-metal">
                    /{p.slug} · atualizada em {formatDateTime(p.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {p.hasPlaceholders && (
                    <span className="flex items-center gap-1 text-xs text-warn">
                      <AlertTriangle className="size-3.5" /> Campos por preencher
                    </span>
                  )}
                  {p.isPublished ? <Badge tone="light">Publicada</Badge> : <Badge tone="outline">Rascunho</Badge>}
                  <ChevronRight className="size-4 text-metal" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
