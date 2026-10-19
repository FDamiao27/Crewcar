import { VehicleEditor } from "@/components/admin/vehicle-editor";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { getAdminSettings } from "@/lib/queries/admin";
import { EMPTY_VEHICLE_FORM } from "@/lib/vehicle-schema";

export const metadata = { title: "Nova viatura" };

export default async function NewVehiclePage() {
  const user = await requireAdmin("vehicles.manage");
  const settings = await getAdminSettings();
  // Sugestão de referência sequencial (pode ser alterada)
  const [{ n }] = await sql<{ n: number }[]>`
    select coalesce(max(substring(reference from '^CC-(\d{1,6})$')::int), 0) + 1 as n from vehicles`;
  return (
    <VehicleEditor
      initial={{ ...EMPTY_VEHICLE_FORM, reference: `CC-${String(n).padStart(4, "0")}` }}
      seeCosts={can(user.role, "costs.view")}
      canDelete={false}
      timeZone={settings.regional.timezone}
    />
  );
}
