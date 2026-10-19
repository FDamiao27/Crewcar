import { ContentView } from "@/components/admin/views/content";
import { requireAdmin } from "@/lib/auth/session";
import { getContentDocs, listPages } from "@/lib/queries/admin";

export const metadata = { title: "Conteúdos" };

export default async function ContentPage() {
  await requireAdmin("content.manage");
  const [docs, pages] = await Promise.all([getContentDocs(), listPages()]);
  return <ContentView docs={docs} pages={pages} />;
}
