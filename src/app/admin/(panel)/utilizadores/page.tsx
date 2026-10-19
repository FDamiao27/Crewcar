import { UsersView } from "@/components/admin/views/users";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/queries/admin";

export const metadata = { title: "Utilizadores" };

export default async function UsersPage() {
  const me = await requireAdmin("users.manage");
  const users = await listUsers();
  return <UsersView users={users} meId={me.id} />;
}
