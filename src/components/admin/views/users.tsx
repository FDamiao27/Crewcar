import { PageHeader } from "@/components/admin/sidebar";
import { UsersManager } from "@/components/admin/users-manager";
import { PERMISSIONS, ROLES, permissionsFor } from "@/lib/auth/permissions";
import type { ComponentProps, ReactNode } from "react";

export function UsersView({ users, meId, description }: { users: ComponentProps<typeof UsersManager>["users"]; meId: string; description?: ReactNode }) {
  return (
    <>
      <PageHeader title="Utilizadores" description={description ?? "Apenas o proprietário pode criar contas. Não existe registo público de administradores."} />
      <UsersManager users={users} meId={meId} />
      <section className="mt-10 rounded-sm border border-line p-5">
        <h2 className="text-sm font-semibold text-white">Perfis e permissões</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((r) => (
            <div key={r}>
              <p className="text-sm font-medium text-white">{ROLES[r]}</p>
              <ul className="mt-2 space-y-1 text-xs text-metal">
                {permissionsFor(r).map((p) => (
                  <li key={p}>· {PERMISSIONS[p]}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
