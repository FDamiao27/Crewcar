import { Download } from "lucide-react";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AccountForms } from "@/components/admin/account-forms";
import { CsvImporter } from "@/components/admin/csv-importer";
import { PageEditor } from "@/components/admin/page-editor";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { PageHeader } from "@/components/admin/sidebar";
import { VehicleEditor } from "@/components/admin/vehicle-editor";
import { ContentView } from "@/components/admin/views/content";
import { DashboardView } from "@/components/admin/views/dashboard";
import { LeadView } from "@/components/admin/views/lead";
import { LeadsView } from "@/components/admin/views/leads";
import { PricesView } from "@/components/admin/views/prices";
import { UsersView } from "@/components/admin/views/users";
import { VehiclesView } from "@/components/admin/views/vehicles";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { buildCsv, type ExportVehicle } from "@/lib/admin/csv";
import { can, ROLES } from "@/lib/auth/permissions";
import { EMPTY_VEHICLE_FORM } from "@/lib/vehicle-schema";
import { fetchAll, logActivity } from "../core";
import { filterLeads, filterVehicles } from "../filters";
import { loadContentDocs, loadDashboard, loadLead, loadLeads, loadPage, loadPages, loadPricingDetails, loadSettings, loadStock, loadUsers, loadVehicle } from "../queries";
import { Loaded, useAdmin, useAdminData, usePageTitle } from "../session";

const useQuery = () => Object.fromEntries(useSearchParams()[0].entries()) as Record<string, string | undefined>;

function NotFoundNotice({ what }: { what: string }) {
  return <EmptyState title={`${what} não encontrado(a)`} description="Pode ter sido eliminado(a) ou o endereço está incorreto." />;
}

export function DashboardPage() {
  usePageTitle("Painel");
  const user = useAdmin();
  const sp = useQuery();
  const state = useAdminData(loadDashboard, []);
  return <Loaded state={state}>{(data) => <DashboardView user={user} data={data} permissionError={sp.erro === "permissao"} />}</Loaded>;
}

function ExportButton({ vista }: { vista: string }) {
  const user = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const [vehicles, equipment] = await Promise.all([
        fetchAll<ExportVehicle & { id: string; reference: string; archivedAt: string | null }>("vehicles", "*"),
        fetchAll<{ vehicleId: string; kind: string; label: string; position: number }>("vehicle_equipment", "vehicle_id,kind,label,position"),
      ]);
      equipment.sort((a, b) => a.position - b.position);
      const rows = vehicles
        .filter((v) => (vista === "arquivadas" ? v.archivedAt : vista === "todas" ? true : !v.archivedAt))
        .sort((a, b) => a.reference.toLowerCase().localeCompare(b.reference.toLowerCase()))
        .map((v) => {
          const own = equipment.filter((e) => e.vehicleId === v.id);
          return { ...v, equipment: own.filter((e) => e.kind === "equipamento").map((e) => e.label), extras: own.filter((e) => e.kind === "extra").map((e) => e.label) };
        });
      const csv = buildCsv(rows, { includeCosts: can(user.role, "costs.view") });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `crewcar-stock-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await logActivity({ action: "exportar", entityType: "viatura", summary: `Exportou ${rows.length} viatura(s) em CSV` });
    } catch (err) {
      console.error(err);
      toast("Não foi possível exportar o stock.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex h-8 items-center gap-2 rounded-sm border border-line-strong px-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white hover:border-white/60 disabled:opacity-50"
    >
      <Download className="size-3.5" /> Exportar CSV
    </button>
  );
}

export function VehiclesPage() {
  usePageTitle("Viaturas");
  const user = useAdmin();
  const sp = useQuery();
  const filters = {
    q: sp.q?.slice(0, 100),
    estado: sp.estado,
    publicacao: sp.publicacao,
    vista: sp.vista ?? "ativas",
    desconto: sp.desconto,
    ordem: sp.ordem,
    pagina: Number(sp.pagina) || 1,
  };
  const state = useAdminData(loadStock, []);
  return (
    <Loaded state={state}>
      {(stock) => (
        <VehiclesView
          result={filterVehicles(stock.rows, filters)}
          filters={filters}
          demoCount={stock.demoCount}
          seeCosts={can(user.role, "costs.view")}
          canDelete={can(user.role, "vehicles.delete")}
          exportControl={<ExportButton vista={filters.vista} />}
        />
      )}
    </Loaded>
  );
}

async function nextReference(): Promise<string> {
  const rows = await fetchAll<{ reference: string }>("vehicles", "reference");
  const n = rows.reduce((max, r) => Math.max(max, Number(/^CC-(\d{1,6})$/.exec(r.reference)?.[1] ?? 0)), 0) + 1;
  return `CC-${String(n).padStart(4, "0")}`;
}

export function NewVehiclePage() {
  usePageTitle("Nova viatura");
  const user = useAdmin();
  const state = useAdminData(async () => {
    const [reference, settings] = await Promise.all([nextReference(), loadSettings()]);
    return { reference, settings };
  }, []);
  return (
    <Loaded state={state}>
      {({ reference, settings }) => (
        <VehicleEditor
          initial={{ ...EMPTY_VEHICLE_FORM, reference }}
          seeCosts={can(user.role, "costs.view")}
          canDelete={false}
          timeZone={settings.regional.timezone}
        />
      )}
    </Loaded>
  );
}

export function EditVehiclePage() {
  const { id = "" } = useParams();
  const user = useAdmin();
  const sp = useQuery();
  const state = useAdminData(() => Promise.all([loadVehicle(id), loadSettings()]), [id]);
  const v = state.status === "ready" ? state.data[0] : null;
  usePageTitle(v ? `${v.form.brand} ${v.form.model} (${v.reference})` : "Viatura");
  return (
    <Loaded state={state}>
      {([v, settings]) => {
        if (!v) return <NotFoundNotice what="Viatura" />;
        const seeCosts = can(user.role, "costs.view");
        return (
          <VehicleEditor
            key={v.id}
            vehicle={{
              id: v.id,
              slug: v.slug,
              reference: v.reference,
              status: v.status,
              isPublished: v.isPublished,
              isFeatured: v.isFeatured,
              isDemo: v.isDemo,
              archived: !!v.archivedAt,
              priceCents: v.priceCents,
              createdAt: v.createdAt,
              updatedAt: v.updatedAt,
              publishedAt: v.publishedAt,
              soldAt: v.soldAt,
              createdByName: v.createdByName,
              updatedByName: v.updatedByName,
              leadCount: v.leadCount,
            }}
            initial={seeCosts ? v.form : { ...v.form, purchasePrice: "" }}
            photos={v.photos}
            promotions={v.promotions}
            history={v.priceHistory}
            pricing={v.pricing}
            seeCosts={seeCosts}
            canDelete={can(user.role, "vehicles.delete")}
            timeZone={settings.regional.timezone}
            initialTab={sp.tab}
          />
        );
      }}
    </Loaded>
  );
}

export function ImportPage() {
  usePageTitle("Importar CSV");
  const user = useAdmin();
  return (
    <>
      <PageHeader
        title="Importar viaturas (CSV)"
        back={{ href: "/admin/viaturas", label: "Viaturas" }}
        description="Carregue um ficheiro CSV. Antes de gravar, é apresentada uma análise com erros de validação e duplicados."
      />
      <CsvImporter canSeeCosts={can(user.role, "costs.view")} />
    </>
  );
}

export function PricesPage() {
  usePageTitle("Preços e descontos");
  const sp = useQuery();
  const filters = { q: sp.q?.slice(0, 100), desconto: sp.desconto, estado: sp.estado, ordem: sp.ordem ?? "marca", vista: "ativas", pagina: Number(sp.pagina) || 1 };
  const key = JSON.stringify(filters);
  const state = useAdminData(async () => {
    const [stock, settings] = await Promise.all([loadStock(), loadSettings()]);
    const result = filterVehicles(stock.rows, filters, 30);
    const details = await loadPricingDetails(result.items.map((v) => v.id));
    const promos = result.items.flatMap((v) => (details.promos.get(v.id) ?? []).map((p) => ({ ...p, vehicleId: v.id })));
    const history = result.items.flatMap((v) => (details.history.get(v.id) ?? []).map((h) => ({ ...h, vehicleId: v.id })));
    return { result, promos, history, timeZone: settings.regional.timezone };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <Loaded state={state}>{(d) => <PricesView result={d.result} filters={filters} promos={d.promos} history={d.history} timeZone={d.timeZone} />}</Loaded>;
}

export function LeadsPage() {
  usePageTitle("Contactos");
  const sp = useQuery();
  const filters = { q: sp.q?.slice(0, 100), estado: sp.estado, pagina: Number(sp.pagina) || 1 };
  const state = useAdminData(loadLeads, []);
  return <Loaded state={state}>{(leads) => <LeadsView result={filterLeads(leads, filters)} filters={filters} />}</Loaded>;
}

export function LeadPage() {
  usePageTitle("Contacto");
  const { id = "" } = useParams();
  const user = useAdmin();
  const state = useAdminData(() => loadLead(id), [id]);
  return <Loaded state={state}>{(data) => (data ? <LeadView data={data} canDelete={can(user.role, "leads.delete")} /> : <NotFoundNotice what="Contacto" />)}</Loaded>;
}

export function ContentPage() {
  usePageTitle("Conteúdos");
  const state = useAdminData(() => Promise.all([loadContentDocs(), loadPages()]), []);
  return <Loaded state={state}>{([docs, pages]) => <ContentView docs={docs} pages={pages} />}</Loaded>;
}

export function EditPagePage() {
  usePageTitle("Página");
  const { slug = "" } = useParams();
  const state = useAdminData(() => loadPage(slug), [slug]);
  return (
    <Loaded state={state}>
      {(page) =>
        page ? (
          <>
            <PageHeader title={page.title} back={{ href: "/admin/conteudos#paginas", label: "Conteúdos" }} description={`Endereço público: /${page.slug}`} />
            <PageEditor
              slug={page.slug}
              initial={{ title: page.title, body: page.body, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", isPublished: page.isPublished }}
            />
          </>
        ) : (
          <NotFoundNotice what="Página" />
        )
      }
    </Loaded>
  );
}

export function SettingsPage() {
  usePageTitle("Definições");
  const state = useAdminData(loadSettings, []);
  return (
    <Loaded state={state}>
      {(settings) => (
        <>
          <PageHeader title="Definições gerais" description="Dados da marca, contactos, aparência, regionalização, cookies e publicação. As alterações aplicam-se de imediato ao website." />
          <SettingsEditor initial={settings} />
        </>
      )}
    </Loaded>
  );
}

export function UsersPage() {
  usePageTitle("Utilizadores");
  const me = useAdmin();
  const state = useAdminData(loadUsers, []);
  return (
    <Loaded state={state}>
      {(users) => (
        <UsersView
          users={users}
          meId={me.id}
          description="Apenas o proprietário pode criar contas. Não existe registo público de administradores. Ao criar um utilizador, é gerada uma palavra-passe temporária que deve ser comunicada de forma segura."
        />
      )}
    </Loaded>
  );
}

export function AccountPage() {
  usePageTitle("A minha conta");
  const user = useAdmin();
  return (
    <>
      <PageHeader title="A minha conta" description={`${user.name} · ${user.email} · ${ROLES[user.role]}`} />
      <AccountForms />
    </>
  );
}
