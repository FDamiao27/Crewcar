import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/page-editor";
import { PageHeader } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth/session";
import { getPage } from "@/lib/queries/admin";

export const metadata = { title: "Página" };

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin("content.manage");
  const page = await getPage((await params).slug);
  if (!page) notFound();
  return (
    <>
      <PageHeader title={page.title} back={{ href: "/admin/conteudos#paginas", label: "Conteúdos" }} description={`Endereço público: /${page.slug}`} />
      <PageEditor
        slug={page.slug}
        initial={{ title: page.title, body: page.body, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", isPublished: page.isPublished }}
      />
    </>
  );
}
