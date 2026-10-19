import { Container, PageHero } from "@/components/site/section";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { useMeta, useShowroom } from "../showroom";
import { NotFoundPage } from "./not-found";

export function LegalPage({ slug }: { slug: string }) {
  const { pages } = useShowroom();
  const page = pages.find((p) => p.slug === slug);
  useMeta(page ? page.seoTitle || page.title : "Página não encontrada", page?.seoDescription);
  if (!page) return <NotFoundPage />;
  return (
    <>
      <PageHero eyebrow="Informação" title={page.title} />
      <Container className="py-14 md:py-20">
        <article className="mx-auto max-w-3xl">
          <Markdown source={page.body} />
          <p className="mt-12 border-t border-line pt-6 text-xs text-metal">Última atualização: {formatDate(page.updatedAt)}</p>
        </article>
      </Container>
    </>
  );
}
