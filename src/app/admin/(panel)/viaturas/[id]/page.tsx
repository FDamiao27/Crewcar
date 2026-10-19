import { notFound } from "next/navigation";
import { VehicleEditor } from "@/components/admin/vehicle-editor";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminSettings, getAdminVehicle } from "@/lib/queries/admin";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props) {
  const v = await getAdminVehicle((await params).id);
  return { title: v ? `${v.form.brand} ${v.form.model} (${v.reference})` : "Viatura" };
}

export default async function EditVehiclePage({ params, searchParams }: Props) {
  const user = await requireAdmin("vehicles.manage");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [v, settings] = await Promise.all([getAdminVehicle(id), getAdminSettings()]);
  if (!v) notFound();
  const seeCosts = can(user.role, "costs.view");
  // Dados privados de custo nunca são enviados ao navegador de utilizadores sem permissão
  const form = seeCosts ? v.form : { ...v.form, purchasePrice: "" };

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
      initial={form}
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
}
