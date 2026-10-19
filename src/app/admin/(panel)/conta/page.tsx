import { AccountForms } from "@/components/admin/account-forms";
import { PageHeader } from "@/components/admin/sidebar";
import { ROLES } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "A minha conta" };

export default async function AccountPage() {
  const user = await requireAdmin();
  return (
    <>
      <PageHeader title="A minha conta" description={`${user.name} · ${user.email} · ${ROLES[user.role]}`} />
      <AccountForms />
    </>
  );
}
