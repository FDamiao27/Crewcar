import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { LEAD_STATUSES, VEHICLE_STATUSES, type LeadStatus, type VehicleStatus } from "@/lib/constants";

export function StatCard({ label, value, hint, href, icon }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; icon?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-metal">{label}</p>
        {icon && <span className="text-metal/70 [&_svg]:size-4 [&_svg]:stroke-[1.5]">{icon}</span>}
      </div>
      <p className="mt-3 text-[1.7rem] font-semibold tracking-tight text-white tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-metal">{hint}</p>}
    </>
  );
  const cls = "block rounded-sm surface p-5 transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-white/20")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Panel({ title, actions, children, className, bodyClassName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-sm surface", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const tone = status === "disponivel" ? "ok" : status === "reservado" ? "warn" : "neutral";
  return <Badge tone={tone}>{VEHICLE_STATUSES[status]}</Badge>;
}

export function PublicationBadge({ published, archived }: { published: boolean; archived?: boolean }) {
  if (archived) return <Badge tone="neutral">Arquivada</Badge>;
  return published ? <Badge tone="light">Publicada</Badge> : <Badge tone="outline">Rascunho</Badge>;
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const tone = status === "novo" ? "light" : status === "convertido" ? "ok" : status === "perdido" ? "neutral" : "warn";
  return <Badge tone={tone}>{LEAD_STATUSES[status]}</Badge>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-sm border border-line", className)}>
      <table className="w-full min-w-[1080px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export const th = "border-b border-line bg-white/[0.02] px-4 py-3 text-left text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-metal whitespace-nowrap";
export const td = "border-b border-line px-4 py-3 align-middle text-soft";
