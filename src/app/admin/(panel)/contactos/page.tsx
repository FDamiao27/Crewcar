import { Inbox, Search } from "lucide-react";
import Link from "next/link";
import { AutoForm } from "@/components/admin/auto-form";
import { AdminPagination, buildHref } from "@/components/admin/pagination";
import { PageHeader } from "@/components/admin/sidebar";
import { LeadStatusBadge, Table, td, th } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/misc";
import { fieldBase, inputClass } from "@/components/ui/styles";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/format";
import { listLeads } from "@/lib/queries/admin";

export const metadata = { title: "Contactos" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LeadsPage({ searchParams }: Props) {
  await requireAdmin("leads.manage");
  const sp = await searchParams;
  const filters = { q: sp.q?.slice(0, 100), estado: sp.estado, pagina: Number(sp.pagina) || 1 };
  const result = await listLeads(filters);
  const params = { ...filters, pagina: undefined };
  const pending = (result.counts.novo ?? 0) + (result.counts.em_contacto ?? 0) + (result.counts.em_negociacao ?? 0);

  return (
    <>
      <PageHeader title="Contactos" description="Pedidos recebidos através do website. Os dados pessoais só são acessíveis a utilizadores autenticados." />

      <nav aria-label="Estados" className="mb-5 flex flex-wrap gap-2">
        {[["", "Todos"], ["pendentes", `Pendentes (${pending})`], ...Object.entries(LEAD_STATUSES).map(([k, l]) => [k, `${l} (${result.counts[k] ?? 0})`])].map(
          ([k, l]) => (
            <Link
              key={k}
              href={buildHref("/admin/contactos", { q: filters.q, estado: k || undefined })}
              aria-current={(filters.estado ?? "") === k ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                (filters.estado ?? "") === k ? "border-white bg-white text-ink" : "border-line text-soft hover:border-white/40",
              )}
            >
              {l}
            </Link>
          ),
        )}
      </nav>

      <AutoForm action="/admin/contactos" className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-metal" aria-hidden="true" />
          <label htmlFor="q" className="sr-only">
            Pesquisar contactos
          </label>
          <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Nome, e-mail, telefone, viatura, mensagem…" className={cn(inputClass, "h-10 py-2 pl-9")} />
        </div>
        <label htmlFor="f-estado" className="sr-only">
          Estado
        </label>
        <select id="f-estado" name="estado" defaultValue={filters.estado ?? ""} className={cn(fieldBase, "cc-select h-10 py-2 text-sm")}>
          <option value="">Todos os estados</option>
          <option value="pendentes">Pendentes</option>
          {Object.entries(LEAD_STATUSES).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </AutoForm>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={filters.q || filters.estado ? "Nenhum contacto corresponde aos filtros" : "Ainda não existem contactos"}
          description="Os pedidos enviados pelos formulários do website aparecem aqui automaticamente."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th} scope="col">Data</th>
              <th className={th} scope="col">Nome</th>
              <th className={th} scope="col">Contacto</th>
              <th className={th} scope="col">Viatura pretendida</th>
              <th className={th} scope="col">Origem</th>
              <th className={th} scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((l) => (
              <tr key={l.id} className={cn("hover:bg-white/[0.015]", l.status === "novo" && "bg-white/[0.02]")}>
                <td className={cn(td, "whitespace-nowrap text-xs text-metal tabular")}>{formatDateTime(l.createdAt)}</td>
                <td className={td}>
                  <Link href={`/admin/contactos/${l.id}`} className={cn("hover:underline", l.status === "novo" ? "font-semibold text-white" : "text-white")}>
                    {l.name}
                  </Link>
                  <p className="max-w-80 truncate text-xs text-metal">{l.message}</p>
                </td>
                <td className={cn(td, "text-xs")}>
                  {l.email && <p className="truncate">{l.email}</p>}
                  {l.phone && <p className="text-metal tabular">{l.phone}</p>}
                </td>
                <td className={cn(td, "max-w-64 truncate text-xs")}>{l.vehicleLabel ?? <span className="text-metal">—</span>}</td>
                <td className={cn(td, "text-xs text-metal")}>{(l.source && LEAD_SOURCES[l.source]) ?? "—"}</td>
                <td className={td}>
                  <LeadStatusBadge status={l.status} />
                  {l.noteCount > 0 && <span className="ml-2 text-xs text-metal">{l.noteCount} nota(s)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-3 text-xs text-metal">{formatNumber(result.total)} contacto(s)</p>
      <AdminPagination page={result.page} pages={result.pages} href={(p) => buildHref("/admin/contactos", params, { pagina: p })} />
    </>
  );
}
