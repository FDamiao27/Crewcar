import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, PageHero } from "@/components/site/section";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { getPublishedPage } from "@/lib/queries/public";

export async function legalMetadata(slug: string): Promise<Metadata> {
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Página não encontrada" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: { canonical: `/${slug}` },
  };
}

export async function LegalPage({ slug }: { slug: string }) {
  const page = await getPublishedPage(slug);
  if (!page) notFound();
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
