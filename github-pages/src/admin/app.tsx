import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AdminShell } from "@/components/admin/sidebar";
import { Logo } from "@/components/site/logo";
import { ToastProvider } from "@/components/ui/toast";
import { can } from "@/lib/auth/permissions";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/site-schema";
import { adminDb } from "./core";
import { LoginPage } from "./pages/login";
import * as P from "./pages/panel";
import { loadSettings } from "./queries";
import { RequireAdmin, SessionProvider, useAdmin } from "./session";

// Back office no navegador (crew-car.pt/admin): sessão do Supabase Auth e acesso aos
// dados controlado pela base de dados (políticas RLS da migração 0005).

function useNewLeads(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () =>
      adminDb
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "novo")
        .then(({ count }) => setN(count ?? 0));
    load();
    window.addEventListener("cc-refresh", load);
    return () => window.removeEventListener("cc-refresh", load);
  }, []);
  return n;
}

function Panel() {
  const user = useAdmin();
  const newLeads = useNewLeads();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const load = () => loadSettings().then(setSettings, () => undefined);
    load();
    window.addEventListener("cc-refresh", load);
    return () => window.removeEventListener("cc-refresh", load);
  }, []);
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
    <AdminShell logo={<Logo brandName={settings.brandName} logo={settings.logo} size="sm" />} user={{ name: user.name, role: user.role }} items={items}>
      <Routes>
        <Route index element={<P.DashboardPage />} />
        <Route path="viaturas" element={<RequireAdmin permission="vehicles.manage"><P.VehiclesPage /></RequireAdmin>} />
        <Route path="viaturas/nova" element={<RequireAdmin permission="vehicles.manage"><P.NewVehiclePage /></RequireAdmin>} />
        <Route path="viaturas/importar" element={<RequireAdmin permission="vehicles.manage"><P.ImportPage /></RequireAdmin>} />
        <Route path="viaturas/:id" element={<RequireAdmin permission="vehicles.manage"><P.EditVehiclePage /></RequireAdmin>} />
        <Route path="precos" element={<RequireAdmin permission="vehicles.manage"><P.PricesPage /></RequireAdmin>} />
        <Route path="contactos" element={<RequireAdmin permission="leads.manage"><P.LeadsPage /></RequireAdmin>} />
        <Route path="contactos/:id" element={<RequireAdmin permission="leads.manage"><P.LeadPage /></RequireAdmin>} />
        <Route path="conteudos" element={<RequireAdmin permission="content.manage"><P.ContentPage /></RequireAdmin>} />
        <Route path="conteudos/paginas/:slug" element={<RequireAdmin permission="content.manage"><P.EditPagePage /></RequireAdmin>} />
        <Route path="definicoes" element={<RequireAdmin permission="settings.manage"><P.SettingsPage /></RequireAdmin>} />
        <Route path="utilizadores" element={<RequireAdmin permission="users.manage"><P.UsersPage /></RequireAdmin>} />
        <Route path="conta" element={<P.AccountPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminShell>
  );
}

export default function AdminApp() {
  useEffect(() => {
    // O back office não deve ser indexado pelos motores de pesquisa
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <SessionProvider>
      <ToastProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <RequireAdmin>
                <Panel />
              </RequireAdmin>
            }
          />
        </Routes>
      </ToastProvider>
    </SessionProvider>
  );
}
