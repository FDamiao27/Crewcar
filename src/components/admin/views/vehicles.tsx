import { CarFront, Plus, Search, Star, Upload } from "lucide-react";
import Link from "next/link";
import { AutoForm } from "@/components/admin/auto-form";
import { AdminPagination, buildHref } from "@/components/admin/pagination";
import { PageHeader } from "@/components/admin/sidebar";
import { PublicationBadge, Table, td, th, VehicleStatusBadge } from "@/components/admin/ui";
import { VehicleRowActions } from "@/components/admin/vehicle-actions";
import { RemoveDemoButton } from "@/components/admin/remove-demo";
import { PhotoPlaceholder, photoSrc } from "@/components/site/vehicle-image";
import { LinkButton } from "@/components/ui/button";
import { fieldBase, inputClass } from "@/components/ui/styles";
import { Badge, EmptyState } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { formatDateTime, formatKm, formatNumber, formatPercent, formatPrice } from "@/lib/format";
import type { ReactNode } from "react";
import type { AdminVehicleRow } from "@/lib/queries/admin";

export type VehicleListFilters = { q?: string; estado?: string; publicacao?: string; vista: string; desconto?: string; ordem?: string; pagina: number };

export function VehiclesView({
  result,
  filters,
  demoCount,
  seeCosts,
  canDelete,
  exportControl,
}: {
  result: { items: AdminVehicleRow[]; total: number; page: number; pages: number };
  filters: VehicleListFilters;
  demoCount: number;
  seeCosts: boolean;
  canDelete: boolean;
  exportControl: ReactNode;
}) {
  const params = { ...filters, pagina: undefined };

  return (
    <>
      <PageHeader
        title="Viaturas"
        description={`${formatNumber(result.total)} ${result.total === 1 ? "viatura" : "viaturas"} ${filters.vista === "arquivadas" ? "arquivadas" : ""}`}
        actions={
          <>
            {canDelete && demoCount > 0 && <RemoveDemoButton count={demoCount} />}
            <LinkButton href="/admin/viaturas/importar" variant="secondary" size="sm" icon={<Upload className="size-3.5" />}>
              Importar CSV
            </LinkButton>
            {exportControl}
            <LinkButton href="/admin/viaturas/nova" size="sm" icon={<Plus className="size-3.5" />}>
              Adicionar viatura
            </LinkButton>
          </>
        }
      />

      <AutoForm action="/admin/viaturas" className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-metal" aria-hidden="true" />
          <label htmlFor="q" className="sr-only">
            Pesquisar
          </label>
          <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Referência, marca, modelo, VIN…" className={cn(inputClass, "h-10 py-2 pl-9")} />
        </div>
        <FilterSelect name="vista" label="Vista" value={filters.vista} options={{ ativas: "Stock ativo", arquivadas: "Arquivadas", todas: "Todas" }} />
        <FilterSelect name="estado" label="Estado" value={filters.estado} options={{ "": "Todos os estados", disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido" }} />
        <FilterSelect name="publicacao" label="Publicação" value={filters.publicacao} options={{ "": "Publicação: todas", publicadas: "Publicadas", rascunho: "Rascunho", destaque: "Em destaque" }} />
        <FilterSelect name="desconto" label="Desconto" value={filters.desconto} options={{ "": "Desconto: todos", com: "Com desconto ativo", agendado: "Promoção agendada", sem: "Sem desconto" }} />
        <FilterSelect
          name="ordem"
          label="Ordenar"
          value={filters.ordem}
          options={{ "": "Últimas alterações", recentes: "Criação mais recente", referencia: "Referência", marca: "Marca e modelo", preco_asc: "Preço ↑", preco_desc: "Preço ↓", km_asc: "Quilómetros ↑", ano_desc: "Ano ↓" }}
        />
      </AutoForm>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<CarFront />}
          title={filters.q || filters.estado || filters.publicacao || filters.desconto ? "Nenhuma viatura corresponde aos filtros" : "Ainda não existem viaturas"}
          description="Adicione viaturas uma a uma ou importe um ficheiro CSV com o seu stock."
          action={<LinkButton href="/admin/viaturas/nova">Adicionar viatura</LinkButton>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th} scope="col">
                <span className="sr-only">Fotografia</span>
              </th>
              <th className={th} scope="col">Viatura</th>
              <th className={th} scope="col">Ano</th>
              <th className={th} scope="col">Km</th>
              {seeCosts && (
                <th className={cn(th, "text-right")} scope="col">
                  Aquisição
                </th>
              )}
              <th className={cn(th, "text-right")} scope="col">
                Preço
              </th>
              <th className={th} scope="col">Desconto</th>
              <th className={th} scope="col">Estado</th>
              <th className={th} scope="col">Publicação</th>
              <th className={th} scope="col">Atualizada</th>
              <th className={th} scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((v) => (
              <tr key={v.id} className="hover:bg-white/[0.015]">
                <td className={cn(td, "w-20 py-2")}>
                  <div className="aspect-[4/3] w-16 overflow-hidden rounded-[2px] border border-line">
                    {v.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoSrc(v.photo, 200)} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <PhotoPlaceholder compact />
                    )}
                  </div>
                </td>
                <td className={cn(td, "min-w-64")}>
                  <Link href={`/admin/viaturas/${v.id}`} className="font-medium text-white hover:underline">
                    {v.brand} {v.model}
                  </Link>
                  <p className="mt-0.5 max-w-72 truncate text-xs text-metal">
                    <span className="whitespace-nowrap tabular">{v.reference}</span>
                    {v.version && <> · {v.version}</>}
                  </p>
                  {(v.isFeatured || v.isDemo || v.photoCount === 0) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {v.isFeatured && (
                        <Badge tone="warn">
                          <Star className="size-2.5 fill-current" /> Destaque
                        </Badge>
                      )}
                      {v.isDemo && <Badge tone="outline">Demo</Badge>}
                      {v.photoCount === 0 && <Badge tone="neutral">Sem fotografias</Badge>}
                    </div>
                  )}
                </td>
                <td className={cn(td, "tabular")}>{v.registrationYear ?? "—"}</td>
                <td className={cn(td, "whitespace-nowrap tabular")}>{v.mileageKm !== null ? formatKm(v.mileageKm) : "—"}</td>
                {seeCosts && <td className={cn(td, "text-right whitespace-nowrap text-metal tabular")}>{formatPrice(v.purchasePriceCents)}</td>}
                <td className={cn(td, "text-right whitespace-nowrap tabular")}>
                  <span className="font-medium text-white">{formatPrice(v.pricing.finalPriceCents)}</span>
                  {v.pricing.activePromotion && v.priceCents !== v.pricing.finalPriceCents && (
                    <span className="block text-xs text-metal line-through">{formatPrice(v.priceCents)}</span>
                  )}
                </td>
                <td className={cn(td, "whitespace-nowrap")}>
                  {v.pricing.activePromotion ? (
                    <Badge tone="light">
                      {v.pricing.hasDiscount ? `−${formatPercent(v.pricing.savingsPercent)}` : "Ativa"}
                    </Badge>
                  ) : v.scheduledPromotion ? (
                    <Badge tone="outline">Agendada</Badge>
                  ) : (
                    <span className="text-metal">—</span>
                  )}
                </td>
                <td className={td}>
                  <VehicleStatusBadge status={v.status} />
                </td>
                <td className={td}>
                  <PublicationBadge published={v.isPublished} archived={!!v.archivedAt} />
                </td>
                <td className={cn(td, "whitespace-nowrap text-xs text-metal tabular")}>{formatDateTime(v.updatedAt)}</td>
                <td className={cn(td, "w-10 text-right")}>
                  <VehicleRowActions
                    canDelete={canDelete}
                    vehicle={{
                      id: v.id,
                      slug: v.slug,
                      reference: v.reference,
                      title: `${v.brand} ${v.model}`,
                      status: v.status,
                      isPublished: v.isPublished,
                      isFeatured: v.isFeatured,
                      archived: !!v.archivedAt,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <AdminPagination page={result.page} pages={result.pages} href={(p) => buildHref("/admin/viaturas", params, { pagina: p })} />
    </>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: Record<string, string> }) {
  return (
    <>
      <label htmlFor={`f-${name}`} className="sr-only">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className={cn(fieldBase, "cc-select h-10 py-2 text-sm")}>
        {Object.entries(options).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
    </>
  );
}
