"use client";

import { KeyRound, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { createUser, resetUserPassword, updateUser } from "@/app/admin/actions/users";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { Badge, Notice } from "@/components/ui/misc";
import { fieldBase } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

type User = { id: string; email: string; name: string; role: Role; isActive: boolean; lastLoginAt: Date | null; createdAt: Date; lockedUntil: Date | null };

export function UsersManager({ users, meId }: { users: User[]; meId: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "editor" as Role, password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);

  const now = Date.now();
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>
          Novo utilizador
        </Button>
      </div>
      <div className="overflow-x-auto rounded-sm border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[0.66rem] uppercase tracking-[0.14em] text-metal">
              <th className="px-4 py-3">Utilizador</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Último acesso</th>
              <th className="px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="text-white">
                    {u.name} {u.id === meId && <span className="text-xs text-metal">(você)</span>}
                  </p>
                  <p className="text-xs text-metal">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    Perfil de {u.name}
                  </label>
                  <select
                    id={`role-${u.id}`}
                    value={u.role}
                    disabled={pending || u.id === meId}
                    className={cn(fieldBase, "cc-select h-9 py-1.5 text-sm")}
                    onChange={(e) =>
                      start(async () => {
                        const r = await updateUser(u.id, { role: e.target.value as Role });
                        toast(r.ok ? (r.message ?? "Atualizado.") : r.message, r.ok ? "success" : "error");
                      })
                    }
                  >
                    {Object.entries(ROLES).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {!u.isActive ? (
                    <Badge tone="neutral">Desativado</Badge>
                  ) : u.lockedUntil && new Date(u.lockedUntil).getTime() > now ? (
                    <Badge tone="warn">Bloqueado temporariamente</Badge>
                  ) : (
                    <Badge tone="ok">Ativo</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-metal tabular">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {u.id !== meId && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon={<KeyRound className="size-3.5" />} onClick={() => setResetTarget(u)}>
                        Redefinir palavra-passe
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await updateUser(u.id, { isActive: !u.isActive });
                            toast(r.ok ? (r.message ?? "Atualizado.") : r.message, r.ok ? "success" : "error");
                          })
                        }
                      >
                        {u.isActive ? "Desativar" : "Reativar"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Novo utilizador"
        description="Partilhe a palavra-passe temporária de forma segura. O utilizador deve alterá-la no primeiro acesso."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await createUser(form);
                  if (r.ok) {
                    setCreating(false);
                    setErrors({});
                    if (r.data?.password) setSecret({ email: form.email, password: r.data.password });
                    setForm({ name: "", email: "", role: "editor", password: "" });
                    toast(r.message ?? "Criado.");
                  } else {
                    setErrors(r.fieldErrors ?? {});
                    toast(r.message, "error");
                  }
                })
              }
            >
              Criar utilizador
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <Select label="Perfil" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} options={ROLES} />
          <Input
            label="Palavra-passe (opcional)"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            hint="Deixe vazio para gerar uma palavra-passe temporária."
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        tone="primary"
        title="Redefinir palavra-passe?"
        description={`É gerada uma nova palavra-passe temporária para ${resetTarget?.email} e as sessões ativas são terminadas.`}
        confirmLabel="Redefinir"
        onConfirm={async () => {
          if (!resetTarget) return;
          const r = await resetUserPassword(resetTarget.id);
          const email = resetTarget.email;
          setResetTarget(null);
          if (r.ok && r.data) setSecret({ email, password: r.data.password });
          else if (!r.ok) toast(r.message, "error");
        }}
      />

      <Dialog open={!!secret} onClose={() => setSecret(null)} title="Palavra-passe temporária" size="sm">
        <Notice tone="warn">Esta palavra-passe só é mostrada agora. Copie-a e entregue-a ao utilizador por um canal seguro.</Notice>
        <p className="mt-4 text-sm text-metal">{secret?.email}</p>
        <p className="mt-1 rounded-sm border border-line bg-ink px-3 py-2 font-mono text-base text-white select-all">{secret?.password}</p>
      </Dialog>
    </>
  );
}
