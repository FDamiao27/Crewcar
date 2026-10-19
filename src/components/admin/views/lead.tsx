import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { LeadControls } from "@/components/admin/lead-controls";
import { PageHeader } from "@/components/admin/sidebar";
import { LeadStatusBadge, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { whatsappDigits } from "@/lib/site-schema";
import type { LeadStatus } from "@/lib/constants";
import type { LeadRow } from "@/lib/queries/admin";

export type LeadDetail = {
  lead: LeadRow & { referrer: string | null; consentAt: Date | null };
  activity: { id: string; kind: "criado" | "estado" | "nota"; fromStatus: LeadStatus | null; toStatus: LeadStatus | null; body: string | null; createdAt: Date; actorName: string | null }[];
  otherLeads: { id: string; createdAt: Date; status: LeadStatus; vehicleLabel: string | null }[];
};

export function LeadView({ data, canDelete }: { data: LeadDetail; canDelete: boolean }) {
  const { lead, activity, otherLeads } = data;

  return (
    <>
      <PageHeader title={lead.name} back={{ href: "/admin/contactos", label: "Contactos" }} description={<>Recebido em {formatDateTime(lead.createdAt)} · <LeadStatusBadge status={lead.status} /></>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Pedido">
            {lead.subject && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-metal">{lead.subject}</p>}
            <p className="text-sm leading-relaxed whitespace-pre-line text-soft">{lead.message}</p>
            <dl className="mt-5 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-metal">Viatura pretendida</dt>
                <dd className="mt-0.5 text-white">
                  {lead.vehicleId ? (
                    <Link href={`/admin/viaturas/${lead.vehicleId}`} className="hover:underline">
                      {lead.vehicleLabel}
                    </Link>
                  ) : (
                    (lead.vehicleLabel ?? "—")
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-metal">Origem</dt>
                <dd className="mt-0.5 text-white">{(lead.source && LEAD_SOURCES[lead.source]) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-metal">Consentimento</dt>
                <dd className="mt-0.5 text-white">{lead.consentAt ? `Dado em ${formatDateTime(lead.consentAt)}` : "—"}</dd>
              </div>
              {lead.referrer && (
                <div>
                  <dt className="text-xs text-metal">Página de origem</dt>
                  <dd className="mt-0.5 truncate text-white">{lead.referrer}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <LeadControls id={lead.id} status={lead.status} canDelete={canDelete} />

          <Panel title="Histórico" bodyClassName="p-0">
            <ol>
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 border-b border-line px-5 py-3.5 last:border-0">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-metal" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    {a.kind === "criado" && <p className="text-sm text-soft">Pedido recebido através do website.</p>}
                    {a.kind === "estado" && (
                      <p className="text-sm text-soft">
                        Estado alterado de “{a.fromStatus ? LEAD_STATUSES[a.fromStatus] : "—"}” para “{a.toStatus ? LEAD_STATUSES[a.toStatus] : "—"}”.
                      </p>
                    )}
                    {a.kind === "nota" && <p className="text-sm whitespace-pre-line text-white">{a.body}</p>}
                    <p className="mt-0.5 text-xs text-metal">
                      {a.kind === "nota" ? "Nota interna · " : ""}
                      {a.actorName ?? "Website"} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Dados de contacto">
            <dl className="space-y-3 text-sm">
              {lead.email && (
                <div>
                  <dt className="text-xs text-metal">E-mail</dt>
                  <dd className="break-all text-white">{lead.email}</dd>
                </div>
              )}
              {lead.phone && (
                <div>
                  <dt className="text-xs text-metal">Telefone</dt>
                  <dd className="text-white tabular">{lead.phone}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              {lead.email && (
                <a href={`mailto:${lead.email}?subject=${encodeURIComponent(lead.vehicleLabel ? `Re: ${lead.vehicleLabel}` : "Pedido de contacto")}`} className={buttonClass("secondary", "md")}>
                  <Mail className="size-4" /> Responder por e-mail
                </a>
              )}
              {lead.phone && (
                <>
                  <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "md")}>
                    <Phone className="size-4" /> Ligar
                  </a>
                  <a href={`https://wa.me/${whatsappDigits(lead.phone)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md")}>
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                </>
              )}
              {lead.vehicleSlug && (
                <a href={`/viaturas/${lead.vehicleSlug}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "md")}>
                  <ExternalLink className="size-4" /> Ver anúncio
                </a>
              )}
            </div>
          </Panel>

          {otherLeads.length > 0 && (
            <Panel title="Outros pedidos deste cliente" bodyClassName="p-0">
              <ul>
                {otherLeads.map((o) => (
                  <li key={o.id} className="border-b border-line last:border-0">
                    <Link href={`/admin/contactos/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-white/[0.02]">
                      <span className="min-w-0">
                        <span className="block truncate text-soft">{o.vehicleLabel ?? "Pedido geral"}</span>
                        <span className="text-xs text-metal">{formatDateTime(o.createdAt)}</span>
                      </span>
                      <LeadStatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
