import { PageHeader } from "@/components/admin/sidebar";
import { UsersManager } from "@/components/admin/users-manager";
import { PERMISSIONS, ROLES, permissionsFor } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/queries/admin";

export const metadata = { title: "Utilizadores" };

export default async function UsersPage() {
  const me = await requireAdmin("users.manage");
  const users = await listUsers();
  return (
    <>
      <PageHeader title="Utilizadores" description="Apenas o proprietário pode criar contas. Não existe registo público de administradores." />
      <UsersManager users={users} meId={me.id} />
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
