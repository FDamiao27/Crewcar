import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/sidebar";
import { Logo } from "@/components/site/logo";
import { ToastProvider } from "@/components/ui/toast";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { countNewLeads } from "@/lib/queries/admin";
import { getPublishedSite } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: { default: "Back office", template: "%s · Back office" },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const [{ settings }, newLeads] = await Promise.all([getPublishedSite(), countNewLeads()]);
  const items = [
    { key: "dashboard" },
    { key: "vehicles" },
    { key: "prices" },
    { key: "leads", badge: newLeads },
    { key: "content" },
    ...(can(user.role, "settings.manage") ? [{ key: "settings" }] : []),
    ...(can(user.role, "users.manage") ? [{ key: "users" }] : []),
  ];
  return (
    <ToastProvider>
      <AdminShell logo={<Logo brandName={settings.brandName} logo={settings.logo} size="sm" />} user={{ name: user.name, role: user.role }} items={items}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
