import { AlertTriangle, Car, CheckCircle2, CircleDashed, Inbox, Plus, Star, Tag } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/sidebar";
import { LeadStatusBadge, Panel, StatCard } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { can, type Role } from "@/lib/auth/permissions";
import type { LeadStatus } from "@/lib/constants";
import { formatDateTime, formatNumber, formatPrice, formatRelative } from "@/lib/format";

export type DashboardData = {
  stats: { total: number; available: number; reserved: number; sold: number; featured: number; published: number; drafts: number; discounted: number; stockValue: number; stockCost: number; withoutPhotos: number };
  leads: { newLeads: number; pending: number; last7: number };
  activity: { id: string; summary: string; createdAt: Date; actorName: string | null }[];
  recentLeads: { id: string; name: string; vehicleLabel: string | null; status: LeadStatus; createdAt: Date }[];
  checks: { hasContacts: boolean; publishedPages: number };
};

export function DashboardView({ user, data, permissionError }: { user: { name: string; role: Role }; data: DashboardData; permissionError?: boolean }) {
  const { stats, leads, activity, recentLeads, checks } = data;
  const seeCosts = can(user.role, "costs.view");

  const setup = [
    { done: checks.hasContacts, label: "Configurar telefone e e-mail do stand", href: "/admin/definicoes" },
    { done: checks.publishedPages >= 1, label: "Rever e publicar as páginas legais (privacidade, cookies, informação legal)", href: "/admin/conteudos#paginas" },
    { done: stats.total > 0, label: "Adicionar a primeira viatura", href: "/admin/viaturas/nova" },
    { done: stats.published > 0, label: "Publicar viaturas no showroom", href: "/admin/viaturas?publicacao=rascunho" },
  ];
  const pendingSetup = setup.filter((s) => !s.done);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description="Resumo do stock e dos contactos, calculado a partir dos dados atuais."
        actions={
          can(user.role, "vehicles.manage") && (
            <LinkButton href="/admin/viaturas/nova" icon={<Plus className="size-4" />}>
              Adicionar viatura
            </LinkButton>
          )
        }
      />

      {permissionError && (
        <Notice tone="danger" className="mb-6">
          Não tem permissão para aceder a essa área.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de viaturas" value={formatNumber(stats.total)} hint={`${formatNumber(stats.published)} publicadas · ${formatNumber(stats.drafts)} em rascunho`} href="/admin/viaturas" icon={<Car />} />
        <StatCard label="Disponíveis" value={formatNumber(stats.available)} href="/admin/viaturas?estado=disponivel" icon={<CheckCircle2 />} />
        <StatCard label="Reservadas" value={formatNumber(stats.reserved)} href="/admin/viaturas?estado=reservado" icon={<CircleDashed />} />
        <StatCard label="Vendidas" value={formatNumber(stats.sold)} href="/admin/viaturas?estado=vendido" hint="Mantidas no histórico" />
        <StatCard label="Em destaque" value={formatNumber(stats.featured)} href="/admin/viaturas?publicacao=destaque" icon={<Star />} />
        <StatCard label="Com desconto ativo" value={formatNumber(stats.discounted)} href="/admin/precos?desconto=com" icon={<Tag />} />
        <StatCard
          label="Valor do stock ativo"
          value={formatPrice(stats.stockValue)}
          hint={seeCosts && stats.stockCost > 0 ? `Custo de aquisição: ${formatPrice(stats.stockCost)}` : "Disponíveis + reservadas, preço atual"}
        />
        <StatCard
          label="Contactos"
          value={formatNumber(leads.newLeads)}
          hint={`novos · ${formatNumber(leads.pending)} pendentes · ${formatNumber(leads.last7)} nos últimos 7 dias`}
          href="/admin/contactos?estado=novo"
          icon={<Inbox />}
        />
      </div>

      {(pendingSetup.length > 0 || stats.withoutPhotos > 0) && (
        <Panel title="Por fazer" className="mt-6">
          <ul className="space-y-2.5">
            {pendingSetup.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 text-sm text-soft hover:text-white">
                  <CircleDashed className="size-4 shrink-0 text-warn" /> {s.label}
                </Link>
              </li>
            ))}
            {stats.withoutPhotos > 0 && (
              <li className="flex items-center gap-3 text-sm text-soft">
                <AlertTriangle className="size-4 shrink-0 text-warn" />
                {formatNumber(stats.withoutPhotos)} viatura(s) ainda sem fotografias.
              </li>
            )}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Últimos contactos"
          actions={
            <Link href="/admin/contactos" className="text-xs text-metal hover:text-white">
              Ver todos
            </Link>
          }
          bodyClassName="p-0"
        >
          {recentLeads.length ? (
            <ul>
              {recentLeads.map((l) => (
                <li key={l.id} className="border-b border-line last:border-0">
                  <Link href={`/admin/contactos/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{l.name}</p>
                      <p className="truncate text-xs text-metal">{l.vehicleLabel ?? "Pedido geral"} · {formatRelative(l.createdAt)}</p>
                    </div>
                    <LeadStatusBadge status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-metal">Ainda não foram recebidos pedidos de contacto.</p>
          )}
        </Panel>

        <Panel title="Atividade recente" bodyClassName="p-0">
          {activity.length ? (
            <ol>
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 border-b border-line px-5 py-3 last:border-0">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-metal" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm text-soft">{a.summary}</p>
                    <p className="text-xs text-metal" title={formatDateTime(a.createdAt)}>
                      {a.actorName ?? "Sistema"} · {formatRelative(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-metal">Sem atividade registada.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
