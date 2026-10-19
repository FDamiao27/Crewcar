import { PageHeader } from "@/components/admin/sidebar";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminSettings } from "@/lib/queries/admin";

export const metadata = { title: "Definições" };

export default async function SettingsPage() {
  await requireAdmin("settings.manage");
  const settings = await getAdminSettings();
  return (
    <>
      <PageHeader title="Definições gerais" description="Dados da marca, contactos, aparência, regionalização, cookies e publicação. As alterações aplicam-se de imediato ao website." />
      <SettingsEditor initial={settings} />
    </>
  );
}
