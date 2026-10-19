import { Download } from "lucide-react";
import { buildHref } from "@/components/admin/pagination";
import { VehiclesView } from "@/components/admin/views/vehicles";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { listAdminVehicles } from "@/lib/queries/admin";

export const metadata = { title: "Viaturas" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function VehiclesPage({ searchParams }: Props) {
  const user = await requireAdmin("vehicles.manage");
  const sp = await searchParams;
  const filters = {
    q: sp.q?.slice(0, 100),
    estado: sp.estado,
    publicacao: sp.publicacao,
    vista: sp.vista ?? "ativas",
    desconto: sp.desconto,
    ordem: sp.ordem,
    pagina: Number(sp.pagina) || 1,
  };
  const [result, [demo]] = await Promise.all([
    listAdminVehicles(filters),
    sql<{ n: number }[]>`select count(*)::int as n from vehicles where is_demo`,
  ]);
  return (
    <VehiclesView
      result={result}
      filters={filters}
      demoCount={demo.n}
      seeCosts={can(user.role, "costs.view")}
      canDelete={can(user.role, "vehicles.delete")}
      exportControl={
        <a href={buildHref("/api/admin/vehicles/export", { vista: filters.vista })} className="inline-flex">
          <span className="inline-flex h-8 items-center gap-2 rounded-sm border border-line-strong px-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white hover:border-white/60">
            <Download className="size-3.5" /> Exportar CSV
          </span>
        </a>
      }
    />
  );
}
