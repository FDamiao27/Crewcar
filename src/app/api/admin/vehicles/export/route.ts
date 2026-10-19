import { buildCsv, type ExportVehicle } from "@/lib/admin/csv";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/auth/permissions";
import { getCurrentAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";

// Exportação do stock em CSV. O preço de aquisição só é incluído para utilizadores autorizados.
export async function GET(request: Request) {
  const user = await getCurrentAdmin();
  if (!user || !can(user.role, "vehicles.manage")) return new Response("Não autorizado", { status: 401 });
  const vista = new URL(request.url).searchParams.get("vista") ?? "ativas";
  const rows = await sql<ExportVehicle[]>`
    select v.*,
      coalesce(array(select label from vehicle_equipment e where e.vehicle_id = v.id and e.kind = 'equipamento' order by position), '{}') as equipment,
      coalesce(array(select label from vehicle_equipment e where e.vehicle_id = v.id and e.kind = 'extra' order by position), '{}') as extras
    from vehicles v
    where ${vista === "arquivadas" ? sql`v.archived_at is not null` : vista === "todas" ? sql`true` : sql`v.archived_at is null`}
    order by lower(v.reference)`;
  const csv = buildCsv(rows, { includeCosts: can(user.role, "costs.view") });
  await logActivity({ actorId: user.id, action: "exportar", entityType: "viatura", summary: `Exportou ${rows.length} viatura(s) em CSV` });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crewcar-stock-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
