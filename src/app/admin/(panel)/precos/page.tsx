import { PricesView } from "@/components/admin/views/prices";
import { requireAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { getAdminSettings, listAdminVehicles, type PriceHistoryRow, type AdminPromotion } from "@/lib/queries/admin";

export const metadata = { title: "Preços e descontos" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function PricesPage({ searchParams }: Props) {
  await requireAdmin("vehicles.manage");
  const sp = await searchParams;
  const filters = { q: sp.q?.slice(0, 100), desconto: sp.desconto, estado: sp.estado, ordem: sp.ordem ?? "marca", vista: "ativas", pagina: Number(sp.pagina) || 1 };
  const [result, settings] = await Promise.all([listAdminVehicles(filters, 30), getAdminSettings()]);
  const ids = result.items.map((v) => v.id);
  const [promos, history] = ids.length
    ? await Promise.all([
        sql<(AdminPromotion & { vehicleId: string })[]>`
          select p.id, p.vehicle_id, p.discount_type, p.amount_cents, p.percent_bp, p.label, p.starts_at, p.ends_at, p.cancelled_at, p.created_at, u.name as created_by_name
          from promotions p left join admin_users u on u.id = p.created_by
          where p.vehicle_id in ${sql(ids)} order by p.starts_at desc`,
        sql<(PriceHistoryRow & { vehicleId: string })[]>`
          select h.id, h.vehicle_id, h.price_cents, h.previous_price_cents, h.created_at, u.name as changed_by_name
          from price_history h left join admin_users u on u.id = h.changed_by
          where h.vehicle_id in ${sql(ids)} order by h.created_at desc, h.id desc`,
      ])
    : [[], []];

  return <PricesView result={result} filters={filters} promos={promos} history={history} timeZone={settings.regional.timezone} />;
}
