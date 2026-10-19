"use client";

import { Archive, ArchiveRestore, BadgeCheck, Copy, Eye, EyeOff, Pencil, Star, StarOff, Trash2, CircleDashed, ExternalLink, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteVehicle, duplicateVehicle, quickVehicleAction } from "@/app/admin/actions/vehicles";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionMenu, type MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import type { VehicleStatus } from "@/lib/constants";

export type VehicleActionTarget = {
  id: string;
  slug: string;
  reference: string;
  title: string;
  status: VehicleStatus;
  isPublished: boolean;
  isFeatured: boolean;
  archived: boolean;
};

export function useVehicleActions(v: VehicleActionTarget, opts: { canDelete: boolean; onDeleted?: () => void; showEdit?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "delete" | "sell" | "archive">(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast(r.message ?? "Concluído.");
      else toast(r.message ?? "Não foi possível concluir a operação.", "error");
    });

  const quick = (a: Parameters<typeof quickVehicleAction>[1]) => run(() => quickVehicleAction(v.id, a));

  const items: MenuItem[] = [
    ...(opts.showEdit !== false ? [{ label: "Editar", icon: <Pencil />, onSelect: () => router.push(`/admin/viaturas/${v.id}`) } as MenuItem] : []),
    { type: "link", label: v.isPublished && !v.archived ? "Ver no showroom" : "Pré-visualizar", icon: <ExternalLink />, href: `/viaturas/${v.slug}${v.isPublished ? "" : "?preview=1"}`, external: true },
    { type: "separator" },
    ...(!v.archived
      ? ([
          v.isPublished
            ? { label: "Retirar de publicação", icon: <EyeOff />, onSelect: () => quick("retirar") }
            : { label: "Publicar", icon: <Eye />, onSelect: () => quick("publicar") },
          v.isFeatured
            ? { label: "Remover destaque", icon: <StarOff />, onSelect: () => quick("remover_destaque") }
            : { label: "Marcar como destaque", icon: <Star />, onSelect: () => quick("destacar"), disabled: v.status === "vendido" },
          { type: "separator" },
          { label: "Marcar como disponível", icon: <CircleCheck />, onSelect: () => quick("disponivel"), disabled: v.status === "disponivel" },
          { label: "Marcar como reservada", icon: <CircleDashed />, onSelect: () => quick("reservar"), disabled: v.status === "reservado" },
          { label: "Marcar como vendida", icon: <BadgeCheck />, onSelect: () => setConfirm("sell"), disabled: v.status === "vendido" },
          { type: "separator" },
        ] as MenuItem[])
      : []),
    {
      label: "Duplicar anúncio",
      icon: <Copy />,
      onSelect: () =>
        start(async () => {
          const r = await duplicateVehicle(v.id);
          if (r.ok && r.data) {
            toast(r.message ?? "Anúncio duplicado.");
            router.push(`/admin/viaturas/${r.data.id}`);
          } else toast(r.message ?? "Erro ao duplicar.", "error");
        }),
    },
    v.archived
      ? { label: "Restaurar", icon: <ArchiveRestore />, onSelect: () => quick("restaurar") }
      : { label: "Arquivar", icon: <Archive />, onSelect: () => setConfirm("archive") },
    ...(opts.canDelete ? ([{ label: "Eliminar…", icon: <Trash2 />, danger: true, onSelect: () => setConfirm("delete") }] as MenuItem[]) : []),
  ];

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Eliminar viatura definitivamente?"
        description={
          <>
            <p>
              A viatura <strong className="text-white">{v.title}</strong> ({v.reference}), as fotografias, o histórico de preços e as promoções
              serão eliminados. Os pedidos de contacto associados são mantidos.
            </p>
            <p className="mt-2 text-metal">Para manter o registo histórico, prefira marcar como vendida ou arquivar.</p>
          </>
        }
        confirmLabel="Eliminar"
        requireText={v.reference}
        onConfirm={async () => {
          const r = await deleteVehicle(v.id);
          setConfirm(null);
          if (r.ok) {
            toast(r.message ?? "Viatura eliminada.");
            opts.onDeleted?.();
          } else toast(r.message, "error");
        }}
      />
      <ConfirmDialog
        open={confirm === "sell"}
        onClose={() => setConfirm(null)}
        tone="primary"
        title="Marcar como vendida?"
        description="A viatura deixa de aparecer no catálogo e nos destaques, e as promoções em curso terminam. O registo fica guardado no histórico."
        confirmLabel="Marcar como vendida"
        onConfirm={async () => {
          const r = await quickVehicleAction(v.id, "vender");
          setConfirm(null);
          toast(r.ok ? (r.message ?? "Concluído.") : r.message, r.ok ? "success" : "error");
        }}
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        tone="primary"
        title="Arquivar viatura?"
        description="A viatura é retirada do showroom e da lista de stock ativo. Pode restaurá-la a qualquer momento."
        confirmLabel="Arquivar"
        onConfirm={async () => {
          const r = await quickVehicleAction(v.id, "arquivar");
          setConfirm(null);
          toast(r.ok ? (r.message ?? "Concluído.") : r.message, r.ok ? "success" : "error");
        }}
      />
    </>
  );

  return { items, dialogs, pending };
}

export function VehicleRowActions({ vehicle, canDelete }: { vehicle: VehicleActionTarget; canDelete: boolean }) {
  const { items, dialogs, pending } = useVehicleActions(vehicle, { canDelete });
  return (
    <div className={pending ? "pointer-events-none opacity-50" : undefined}>
      <ActionMenu items={items} label={`Ações para ${vehicle.reference}`} />
      {dialogs}
    </div>
  );
}
