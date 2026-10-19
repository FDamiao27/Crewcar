import { LeadsView } from "@/components/admin/views/leads";
import { requireAdmin } from "@/lib/auth/session";
import { listLeads } from "@/lib/queries/admin";

export const metadata = { title: "Contactos" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LeadsPage({ searchParams }: Props) {
  await requireAdmin("leads.manage");
  const sp = await searchParams;
  const filters = { q: sp.q?.slice(0, 100), estado: sp.estado, pagina: Number(sp.pagina) || 1 };
  const result = await listLeads(filters);
  return <LeadsView result={result} filters={filters} />;
}
