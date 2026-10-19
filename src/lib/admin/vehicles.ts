import "server-only";
import { randomUUID } from "node:crypto";
import { sql, type Tx } from "@/lib/db";
import { storage } from "@/lib/storage";
import { variantKeys } from "@/lib/images";
import { buildVehicleSlug, slugify, type VehicleData } from "@/lib/vehicle-schema";

// Operações de escrita de viaturas reutilizadas pelo formulário, duplicação e importação CSV.

export async function uniqueSlug(tx: Tx, desired: string, excludeId?: string): Promise<string> {
  const base = slugify(desired) || "viatura";
  const rows = await tx<{ slug: string }[]>`
    select slug from vehicles where (slug = ${base} or slug like ${`${base}-%`}) ${excludeId ? tx`and id <> ${excludeId}` : tx``}`;
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/** Colunas de escrita a partir dos dados validados. */
export function vehicleColumns(d: VehicleData, opts: { canSeeCosts: boolean }) {
  return {
    brand: d.brand,
    model: d.model,
    version: d.version,
    category: d.category as string | null,
    reference: d.reference,
    registrationYear: d.registrationYear,
    firstRegistrationDate: d.firstRegistrationDate,
    mileageKm: d.mileageKm,
    fuel: d.fuel as string | null,
    transmission: d.transmission as string | null,
    engineCc: d.engineCc,
    powerHp: d.powerHp,
    exteriorColor: d.exteriorColor,
    interiorColor: d.interiorColor,
    doors: d.doors,
    seats: d.seats,
    condition: d.condition as string | null,
    vin: d.vin,
    priceCents: d.price,
    ...(opts.canSeeCosts ? { purchasePriceCents: d.purchasePrice } : {}),
    shortDescription: d.shortDescription,
    description: d.description,
    warrantyInfo: d.warrantyInfo,
    warrantyVerified: d.warrantyVerified,
    commercialInfo: d.commercialInfo,
    internalNotes: d.internalNotes,
    videoUrl: d.videoUrl,
    status: d.status,
    isPublished: d.isPublished,
    isFeatured: d.isFeatured,
    seoTitle: d.seoTitle,
    seoDescription: d.seoDescription,
  };
}

export async function replaceChildren(tx: Tx, vehicleId: string, d: Pick<VehicleData, "equipment" | "extras" | "links">) {
  await tx`delete from vehicle_equipment where vehicle_id = ${vehicleId}`;
  const equipment = [
    ...d.equipment.map((label, position) => ({ vehicleId, kind: "equipamento", label, position })),
    ...d.extras.map((label, position) => ({ vehicleId, kind: "extra", label, position })),
  ];
  if (equipment.length) await tx`insert into vehicle_equipment ${tx(equipment, "vehicleId", "kind", "label", "position")}`;
  await tx`delete from vehicle_links where vehicle_id = ${vehicleId}`;
  const links = d.links.map((l, position) => ({ vehicleId, kind: l.kind, label: l.label, url: l.url, isPublic: l.isPublic, position }));
  if (links.length) await tx`insert into vehicle_links ${tx(links, "vehicleId", "kind", "label", "url", "isPublic", "position")}`;
}

export async function insertVehicle(tx: Tx, d: VehicleData, userId: string, opts: { canSeeCosts: boolean }): Promise<{ id: string; slug: string }> {
  const slug = await uniqueSlug(tx, d.slug ?? buildVehicleSlug(d));
  const cols = {
    ...vehicleColumns(d, opts),
    slug,
    createdBy: userId,
    updatedBy: userId,
    publishedAt: d.isPublished ? new Date() : null,
    reservedAt: d.status === "reservado" ? new Date() : null,
    soldAt: d.status === "vendido" ? new Date() : null,
  };
  const [row] = await tx<{ id: string; slug: string }[]>`insert into vehicles ${tx(cols)} returning id, slug`;
  await replaceChildren(tx, row.id, d);
  return row;
}

export async function updateVehicleRow(tx: Tx, id: string, d: VehicleData, userId: string, opts: { canSeeCosts: boolean }) {
  const [current] = await tx<{ slug: string; status: string; isPublished: boolean; publishedAt: Date | null }[]>`
    select slug, status, is_published, published_at from vehicles where id = ${id} for update`;
  if (!current) return null;
  const slug = d.slug && d.slug !== current.slug ? await uniqueSlug(tx, d.slug, id) : current.slug;
  const cols = {
    ...vehicleColumns(d, opts),
    slug,
    updatedBy: userId,
    publishedAt: d.isPublished && !current.publishedAt ? new Date() : current.publishedAt,
  };
  await tx`
    update vehicles set ${tx(cols)},
      reserved_at = case when ${d.status} = 'reservado' and status <> 'reservado' then now() when ${d.status} <> 'reservado' then null else reserved_at end,
      sold_at = case when ${d.status} = 'vendido' and status <> 'vendido' then now() when ${d.status} <> 'vendido' then null else sold_at end
    where id = ${id}`;
  await replaceChildren(tx, id, d);
  return { slug };
}

/** Elimina os ficheiros das fotografias (todas as versões) do armazenamento. */
export async function deletePhotoFiles(photos: { storageKey: string; variants: number[] }[]) {
  const keys = photos.flatMap((p) => variantKeys(p.storageKey, p.variants));
  try {
    await storage().delete(keys);
  } catch (err) {
    console.error("Falha ao remover ficheiros", err);
  }
}

export async function copyPhotos(sourceVehicleId: string, targetVehicleId: string) {
  const photos = await sql<{ storageKey: string; width: number; height: number; bytes: number; variants: number[]; position: number; isPrimary: boolean; altText: string | null; caption: string | null }[]>`
    select storage_key, width, height, bytes, variants, position, is_primary, alt_text, caption
    from vehicle_photos where vehicle_id = ${sourceVehicleId} order by position`;
  for (const p of photos) {
    const newKey = `vehicles/${targetVehicleId}/${randomUUID()}`;
    for (const w of p.variants) {
      const file = await storage().get(`${p.storageKey}-${w}.webp`);
      if (file) await storage().put(`${newKey}-${w}.webp`, file.body, "image/webp");
    }
    await sql`
      insert into vehicle_photos (vehicle_id, storage_key, width, height, bytes, variants, position, is_primary, alt_text, caption)
      values (${targetVehicleId}, ${newKey}, ${p.width}, ${p.height}, ${p.bytes}, ${p.variants}, ${p.position}, ${p.isPrimary}, ${p.altText}, ${p.caption})`;
  }
  return photos.length;
}
