"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addLeadNote, deleteLead, setLeadStatus } from "@/app/admin/actions/leads";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";

export function LeadControls({ id, status, canDelete }: { id: string; status: LeadStatus; canDelete: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  return (
    <section className="rounded-sm surface p-5" aria-label="Gestão do contacto">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">Estado do contacto</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Estado">
        {(Object.keys(LEAD_STATUSES) as LeadStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setLeadStatus(id, s);
                toast(r.ok ? (r.message ?? "Atualizado.") : r.message, r.ok ? "success" : "error");
              })
            }
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors disabled:opacity-60",
              status === s ? "border-white bg-white text-ink" : "border-line text-soft hover:border-white/40",
            )}
          >
            {LEAD_STATUSES[s]}
          </button>
        ))}
      </div>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addLeadNote(id, note);
            if (r.ok) {
              setNote("");
              toast(r.message ?? "Nota adicionada.");
            } else toast(r.message, "error");
          });
        }}
      >
        <Textarea label="Adicionar nota interna" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={5000} placeholder="Ex.: Ligou a pedir test drive para sábado." />
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" variant="subtle" loading={pending} disabled={!note.trim()}>
            Guardar nota
          </Button>
          {canDelete && (
            <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirm(true)}>
              Eliminar contacto
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Eliminar contacto?"
        description="Os dados pessoais, a mensagem, as notas e o histórico deste contacto são eliminados definitivamente (por exemplo, a pedido do titular dos dados)."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          const r = await deleteLead(id);
          setConfirm(false);
          if (r.ok) {
            toast(r.message ?? "Eliminado.");
            router.replace("/admin/contactos");
          } else toast(r.message, "error");
        }}
      />
    </section>
  );
}
