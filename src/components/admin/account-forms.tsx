"use client";

import { useState, useTransition } from "react";
import { changePassword, signOutOtherSessions } from "@/app/admin/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { Panel } from "./ui";

export function AccountForms() {
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <Panel title="Alterar palavra-passe">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await changePassword(form);
              if (r.ok) {
                setForm({ current: "", next: "", confirm: "" });
                setErrors({});
                toast(r.message ?? "Palavra-passe alterada.");
              } else {
                setErrors(r.fieldErrors ?? {});
                toast(r.message, "error");
              }
            });
          }}
        >
          <Input label="Palavra-passe atual" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} error={errors.current} />
          <Input
            label="Nova palavra-passe"
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
            error={errors.next}
            hint="Mínimo 10 caracteres, com letras e números."
          />
          <Input label="Confirmar nova palavra-passe" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={errors.confirm} />
          <Button type="submit" loading={pending}>
            Alterar palavra-passe
          </Button>
        </form>
      </Panel>
      <Panel title="Sessões">
        <p className="text-sm text-metal">As sessões expiram após 12 horas de inatividade. Pode terminar de imediato as sessões abertas noutros dispositivos.</p>
        <Button
          className="mt-4"
          variant="secondary"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await signOutOtherSessions();
              toast(r.ok ? (r.message ?? "Concluído.") : r.message, r.ok ? "success" : "error");
            })
          }
        >
          Terminar outras sessões
        </Button>
      </Panel>
    </div>
  );
}
