import { DashboardView } from "@/components/admin/views/dashboard";
import { requireAdmin } from "@/lib/auth/session";
import { getDashboard } from "@/lib/queries/admin";

export const metadata = { title: "Painel" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DashboardPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const data = await getDashboard();
  return <DashboardView user={user} data={data} permissionError={sp.erro === "permissao"} />;
}
