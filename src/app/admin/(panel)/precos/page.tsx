import { ExternalLink, Search, Tag } from "lucide-react";
import Link from "next/link";
import { AutoForm } from "@/components/admin/auto-form";
import { AdminPagination, buildHref } from "@/components/admin/pagination";
import { PriceRow } from "@/components/admin/price-row";
import { PageHeader } from "@/components/admin/sidebar";
import { Table, th } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/misc";
import { fieldBase, inputClass } from "@/components/ui/styles";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { sql } from "@/lib/db";
import { formatNumber } from "@/lib/format";
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
  const params = { ...filters, vista: undefined, pagina: undefined };

  return (
    <>
      <PageHeader
        title="Preços e descontos"
        description={
          <>
            Altere preços, crie e agende promoções e consulte o histórico. As alterações refletem-se de imediato no showroom.{" "}
            <span className="text-metal/80">{formatNumber(result.total)} viatura(s).</span>
          </>
        }
      />

      <AutoForm action="/admin/precos" className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-metal" aria-hidden="true" />
          <label htmlFor="q" className="sr-only">
            Pesquisar
          </label>
          <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Referência, marca, modelo…" className={cn(inputClass, "h-10 py-2 pl-9")} />
        </div>
        <label htmlFor="f-desconto" className="sr-only">
          Desconto
        </label>
        <select id="f-desconto" name="desconto" defaultValue={filters.desconto ?? ""} className={cn(fieldBase, "cc-select h-10 py-2 text-sm")}>
          <option value="">Todas as viaturas</option>
          <option value="com">Com desconto ativo</option>
          <option value="agendado">Com promoção agendada</option>
          <option value="sem">Sem desconto</option>
        </select>
        <label htmlFor="f-estado" className="sr-only">
          Estado
        </label>
        <select id="f-estado" name="estado" defaultValue={filters.estado ?? ""} className={cn(fieldBase, "cc-select h-10 py-2 text-sm")}>
          <option value="">Todos os estados</option>
          <option value="disponivel">Disponível</option>
          <option value="reservado">Reservado</option>
          <option value="vendido">Vendido</option>
        </select>
        <label htmlFor="f-ordem" className="sr-only">
          Ordenar
        </label>
        <select id="f-ordem" name="ordem" defaultValue={filters.ordem} className={cn(fieldBase, "cc-select h-10 py-2 text-sm")}>
          <option value="marca">Marca e modelo</option>
          <option value="referencia">Referência</option>
          <option value="preco_asc">Preço ↑</option>
          <option value="preco_desc">Preço ↓</option>
          <option value="atualizadas">Últimas alterações</option>
        </select>
      </AutoForm>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Tag />}
          title="Nenhuma viatura encontrada"
          description="Ajuste os filtros ou adicione viaturas ao stock."
          action={
            <Link href="/admin/viaturas/nova" className="text-sm text-white underline">
              Adicionar viatura
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th} scope="col">Viatura</th>
              <th className={th} scope="col">Estado</th>
              <th className={cn(th, "text-right")} scope="col">Preço de venda</th>
              <th className={th} scope="col">Promoção</th>
              <th className={cn(th, "text-right")} scope="col">Preço final</th>
              <th className={cn(th, "text-right")} scope="col">Poupança</th>
              <th className={th} scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          {result.items.map((v) => (
            <PriceRow
              key={v.id}
              vehicle={{
                id: v.id,
                slug: v.slug,
                title: `${v.brand} ${v.model}`,
                reference: v.reference,
                status: v.status,
                isPublished: v.isPublished,
                priceCents: v.priceCents,
                scheduled: v.scheduledPromotion,
              }}
              pricing={v.pricing}
              promotions={promos.filter((p) => p.vehicleId === v.id)}
              history={history.filter((h) => h.vehicleId === v.id)}
              timeZone={settings.regional.timezone}
            />
          ))}
        </Table>
      )}
      <AdminPagination page={result.page} pages={result.pages} href={(p) => buildHref("/admin/precos", params, { pagina: p })} />
      <p className="mt-6 flex items-center gap-1.5 text-xs text-metal">
        <ExternalLink className="size-3.5" /> Use “Gerir” para criar descontos, agendar promoções, ver o histórico e pré-visualizar a apresentação pública.
      </p>
    </>
  );
}
