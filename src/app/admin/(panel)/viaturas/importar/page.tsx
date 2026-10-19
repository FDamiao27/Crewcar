import { PageHeader } from "@/components/admin/sidebar";
import { CsvImporter } from "@/components/admin/csv-importer";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

export const metadata = { title: "Importar CSV" };

export default async function ImportPage() {
  const user = await requireAdmin("vehicles.manage");
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
