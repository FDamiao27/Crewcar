import { notFound } from "next/navigation";
import { LeadView } from "@/components/admin/views/lead";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { getLead } from "@/lib/queries/admin";

export const metadata = { title: "Contacto" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("leads.manage");
  const data = await getLead((await params).id);
  if (!data) notFound();
  return <LeadView data={data} canDelete={can(user.role, "leads.delete")} />;
}
