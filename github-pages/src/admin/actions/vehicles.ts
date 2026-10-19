// Versão no navegador de src/app/admin/actions/vehicles.ts (mesmas funções e resultados).
import { can } from "@/lib/auth/permissions";
import { formatPrice, parseEurosToCents } from "@/lib/format";
import { localInputToDate } from "@/lib/time";
import { buildVehicleSlug, fieldErrors, promotionSchema, slugify, vehicleSchema, type PromotionInput, type VehicleData, type VehicleFormState } from "@/lib/vehicle-schema";
import { ActionError, adminDb, bucket, check, fetchAll, logActivity, runAction, type ActionResult, type AdminUser } from "../core";
import { removeFiles } from "../images";
import { loadSettings } from "../queries";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

function parseVehicle(input: VehicleFormState): VehicleData {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) throw new ActionError("Existem campos por corrigir. Verifique os separadores assinalados.", fieldErrors(parsed.error));
  return parsed.data;
}

export async function uniqueSlug(desired: string, excludeId?: string): Promise<string> {
  const base = slugify(desired) || "viatura";
  let q = adminDb.from("vehicles").select("slug").or(`slug.eq.${base},slug.like.${base}-*`);
  if (excludeId) q = q.neq("id", excludeId);
  const taken = new Set((check(await q) ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function columns(d: VehicleData, canSeeCosts: boolean) {
  return {
    brand: d.brand,
    model: d.model,
    version: d.version,
    category: d.category,
    reference: d.reference,
    registration_year: d.registrationYear,
    first_registration_date: d.firstRegistrationDate,
    mileage_km: d.mileageKm,
    fuel: d.fuel,
    transmission: d.transmission,
    engine_cc: d.engineCc,
    power_hp: d.powerHp,
    exterior_color: d.exteriorColor,
    interior_color: d.interiorColor,
    doors: d.doors,
    seats: d.seats,
    condition: d.condition,
    vin: d.vin,
    price_cents: d.price,
    ...(canSeeCosts ? { purchase_price_cents: d.purchasePrice } : {}),
    short_description: d.shortDescription,
    description: d.description,
    warranty_info: d.warrantyInfo,
    warranty_verified: d.warrantyVerified,
    commercial_info: d.commercialInfo,
    internal_notes: d.internalNotes,
    video_url: d.videoUrl,
    status: d.status,
    is_published: d.isPublished,
    is_featured: d.isFeatured,
    seo_title: d.seoTitle,
    seo_description: d.seoDescription,
  };
}

export async function replaceChildren(vehicleId: string, d: Pick<VehicleData, "equipment" | "extras" | "links">) {
  check(await adminDb.from("vehicle_equipment").delete().eq("vehicle_id", vehicleId));
  const equipment = [
    ...d.equipment.map((label, position) => ({ vehicle_id: vehicleId, kind: "equipamento", label, position })),
    ...d.extras.map((label, position) => ({ vehicle_id: vehicleId, kind: "extra", label, position })),
  ];
  if (equipment.length) check(await adminDb.from("vehicle_equipment").insert(equipment));
  check(await adminDb.from("vehicle_links").delete().eq("vehicle_id", vehicleId));
  const links = d.links.map((l, position) => ({ vehicle_id: vehicleId, kind: l.kind, label: l.label, url: l.url, is_public: l.isPublic, position }));
  if (links.length) check(await adminDb.from("vehicle_links").insert(links));
}

export async function insertVehicle(d: VehicleData, user: AdminUser): Promise<{ id: string; slug: string }> {
  const slug = await uniqueSlug(d.slug ?? buildVehicleSlug(d));
  const now = new Date().toISOString();
  const row = check(
    await adminDb
      .from("vehicles")
      .insert({
        ...columns(d, can(user.role, "costs.view")),
        slug,
        created_by: user.id,
        updated_by: user.id,
        published_at: d.isPublished ? now : null,
        reserved_at: d.status === "reservado" ? now : null,
        sold_at: d.status === "vendido" ? now : null,
      })
      .select("id,slug")
      .single(),
  ) as { id: string; slug: string };
  await replaceChildren(row.id, d);
  return row;
}

export async function createVehicle(input: VehicleFormState): Promise<ActionResult<{ id: string }>> {
  return runAction("vehicles.manage", async (user) => {
    const data = parseVehicle(input);
    const row = await insertVehicle(data, user);
    await logActivity({ action: "criar", entityType: "viatura", entityId: row.id, summary: `Criou a viatura ${data.brand} ${data.model} (${data.reference})` });
    return { ok: true, message: "Viatura criada.", data: { id: row.id } };
  });
}

export async function updateVehicleRow(id: string, data: VehicleData, user: AdminUser, only?: Set<string>) {
  const current = check(await adminDb.from("vehicles").select("slug,status,published_at,reserved_at,sold_at").eq("id", id).maybeSingle()) as {
    slug: string;
    status: string;
    published_at: string | null;
    reserved_at: string | null;
    sold_at: string | null;
  } | null;
  if (!current) return null;
  const slug = data.slug && data.slug !== current.slug ? await uniqueSlug(data.slug, id) : current.slug;
  const now = new Date().toISOString();
  let cols: Record<string, unknown> = {
    ...columns(data, can(user.role, "costs.view")),
    slug,
    published_at: data.isPublished && !current.published_at ? now : current.published_at,
    reserved_at: data.status === "reservado" ? (current.status === "reservado" ? current.reserved_at : now) : null,
    sold_at: data.status === "vendido" ? (current.status === "vendido" ? current.sold_at : now) : null,
  };
  if (only) cols = Object.fromEntries(Object.entries(cols).filter(([k]) => only.has(k)));
  check(await adminDb.from("vehicles").update({ ...cols, updated_by: user.id }).eq("id", id));
  return { slug };
}

export async function updateVehicle(id: string, input: VehicleFormState): Promise<ActionResult<{ slug: string }>> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(id)) throw new ActionError("Viatura inválida.");
    const data = parseVehicle(input);
    const result = await updateVehicleRow(id, data, user);
    if (!result) throw new ActionError("A viatura já não existe.");
    await replaceChildren(id, data);
    await logActivity({ action: "editar", entityType: "viatura", entityId: id, summary: `Editou a viatura ${data.brand} ${data.model} (${data.reference})` });
    return { ok: true, message: "Alterações guardadas.", data: { slug: result.slug } };
  });
}

type QuickAction = "publicar" | "retirar" | "destacar" | "remover_destaque" | "disponivel" | "reservar" | "vender" | "arquivar" | "restaurar";

const QUICK_MESSAGES: Record<QuickAction, string> = {
  publicar: "Viatura publicada no showroom.",
  retirar: "Viatura retirada de publicação.",
  destacar: "Viatura marcada como destaque.",
  remover_destaque: "Destaque removido.",
  disponivel: "Viatura marcada como disponível.",
  reservar: "Viatura marcada como reservada.",
  vender: "Viatura marcada como vendida. Deixou de aparecer no stock disponível.",
  arquivar: "Viatura arquivada.",
  restaurar: "Viatura restaurada.",
};

export async function quickVehicleAction(id: string, action: QuickAction): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(id) || !(action in QUICK_MESSAGES)) throw new ActionError("Pedido inválido.");
    const v = check(await adminDb.from("vehicles").select("reference,brand,model,price_cents,archived_at,published_at").eq("id", id).maybeSingle()) as {
      reference: string;
      brand: string;
      model: string;
      price_cents: number | null;
      archived_at: string | null;
      published_at: string | null;
    } | null;
    if (!v) throw new ActionError("A viatura já não existe.");
    if (action === "publicar") {
      if (!v.price_cents) throw new ActionError("Indique o preço de venda antes de publicar.");
      if (v.archived_at) throw new ActionError("Restaure a viatura antes de a publicar.");
    }
    const now = new Date().toISOString();
    const patch: Record<QuickAction, Record<string, unknown>> = {
      publicar: { is_published: true, published_at: v.published_at ?? now },
      retirar: { is_published: false },
      destacar: { is_featured: true },
      remover_destaque: { is_featured: false },
      disponivel: { status: "disponivel", reserved_at: null, sold_at: null },
      reservar: { status: "reservado", reserved_at: now, sold_at: null },
      vender: { status: "vendido", sold_at: now, is_featured: false },
      arquivar: { archived_at: now, is_published: false, is_featured: false },
      restaurar: { archived_at: null },
    };
    check(await adminDb.from("vehicles").update({ ...patch[action], updated_by: user.id }).eq("id", id));
    if (action === "vender") {
      // Promoções em curso terminam; agendadas são canceladas
      check(await adminDb.from("promotions").update({ ends_at: now }).eq("vehicle_id", id).is("cancelled_at", null).lte("starts_at", now).or(`ends_at.is.null,ends_at.gt.${now}`));
      check(await adminDb.from("promotions").update({ cancelled_at: now }).eq("vehicle_id", id).is("cancelled_at", null).gt("starts_at", now));
    }
    await logActivity({ action, entityType: "viatura", entityId: id, summary: `${QUICK_MESSAGES[action].replace(/\.$/, "")}: ${v.brand} ${v.model} (${v.reference})` });
    return { ok: true, message: QUICK_MESSAGES[action] };
  });
}

async function copyPhotos(sourceId: string, targetId: string): Promise<number> {
  const photos = await fetchAll<{ storageKey: string; width: number; height: number; bytes: number; variants: number[]; position: number; isPrimary: boolean; altText: string | null; caption: string | null }>(
    "vehicle_photos",
    "storage_key,width,height,bytes,variants,position,is_primary,alt_text,caption",
    (q) => (q as { eq: (c: string, v: string) => unknown }).eq("vehicle_id", sourceId),
  );
  for (const p of photos) {
    const newKey = `vehicles/${targetId}/${crypto.randomUUID()}`;
    for (const w of p.variants) {
      const { error } = await bucket().copy(`${p.storageKey}-${w}.webp`, `${newKey}-${w}.webp`);
      if (error) throw new ActionError(`Falha ao copiar fotografias: ${error.message}`);
    }
    check(
      await adminDb.from("vehicle_photos").insert({
        vehicle_id: targetId,
        storage_key: newKey,
        width: p.width,
        height: p.height,
        bytes: p.bytes,
        variants: p.variants,
        position: p.position,
        is_primary: p.isPrimary,
        alt_text: p.altText,
        caption: p.caption,
      }),
    );
  }
  return photos.length;
}

export async function duplicateVehicle(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(id)) throw new ActionError("Viatura inválida.");
    const src = check(await adminDb.from("vehicles").select("*").eq("id", id).maybeSingle()) as Record<string, unknown> | null;
    if (!src) throw new ActionError("A viatura já não existe.");
    const baseRef = String(src.reference);
    let reference = `${baseRef}-COPIA`.slice(0, 40);
    for (let i = 2; ; i++) {
      const { count } = await adminDb.from("vehicles").select("id", { count: "exact", head: true }).ilike("reference", reference);
      if (!count) break;
      reference = `${baseRef.slice(0, 32)}-COPIA${i}`;
    }
    const slug = await uniqueSlug(`${src.slug}-copia`);
    const copy: Record<string, unknown> = { ...src };
    for (const k of ["id", "created_at", "updated_at", "published_at", "reserved_at", "sold_at", "archived_at", "vin", "seo_title", "seo_description"]) delete copy[k];
    Object.assign(copy, { slug, reference, status: "disponivel", is_published: false, is_featured: false, created_by: user.id, updated_by: user.id });
    if (!can(user.role, "costs.view")) delete copy.purchase_price_cents;
    const row = check(await adminDb.from("vehicles").insert(copy).select("id").single()) as { id: string };
    const [equipment, links] = await Promise.all([
      fetchAll<{ kind: string; label: string; position: number }>("vehicle_equipment", "kind,label,position", (q) => (q as { eq: (c: string, v: string) => unknown }).eq("vehicle_id", id)),
      fetchAll<{ kind: string; label: string | null; url: string; isPublic: boolean; position: number }>("vehicle_links", "kind,label,url,is_public,position", (q) =>
        (q as { eq: (c: string, v: string) => unknown }).eq("vehicle_id", id),
      ),
    ]);
    if (equipment.length) check(await adminDb.from("vehicle_equipment").insert(equipment.map((e) => ({ vehicle_id: row.id, kind: e.kind, label: e.label, position: e.position }))));
    if (links.length)
      check(await adminDb.from("vehicle_links").insert(links.map((l) => ({ vehicle_id: row.id, kind: l.kind, label: l.label, url: l.url, is_public: l.isPublic, position: l.position }))));
    const copied = await copyPhotos(id, row.id);
    await logActivity({ action: "duplicar", entityType: "viatura", entityId: row.id, summary: `Duplicou o anúncio ${baseRef} (${copied} fotografia(s) copiada(s))` });
    return { ok: true, message: "Anúncio duplicado como rascunho (não publicado). Reveja a referência e o VIN.", data: { id: row.id } };
  });
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  return runAction("vehicles.delete", async () => {
    if (!isUuid(id)) throw new ActionError("Viatura inválida.");
    const photos = await fetchAll<{ storageKey: string; variants: number[] }>("vehicle_photos", "storage_key,variants", (q) => (q as { eq: (c: string, v: string) => unknown }).eq("vehicle_id", id));
    const deleted = check(await adminDb.from("vehicles").delete().eq("id", id).select("reference,brand,model")) as { reference: string; brand: string; model: string }[];
    if (!deleted.length) throw new ActionError("A viatura já não existe.");
    await removeFiles(photos);
    const v = deleted[0];
    await logActivity({ action: "eliminar", entityType: "viatura", entityId: id, summary: `Eliminou a viatura ${v.brand} ${v.model} (${v.reference})` });
    return { ok: true, message: "Viatura eliminada definitivamente." };
  });
}

export async function removeDemoVehicles(): Promise<ActionResult> {
  return runAction("vehicles.delete", async () => {
    const demos = await fetchAll<{ id: string }>("vehicles", "id", (q) => (q as { eq: (c: string, v: boolean) => unknown }).eq("is_demo", true));
    const ids = demos.map((d) => d.id);
    if (ids.length) {
      const photos = await fetchAll<{ storageKey: string; variants: number[] }>("vehicle_photos", "storage_key,variants", (q) => (q as { in: (c: string, v: string[]) => unknown }).in("vehicle_id", ids));
      check(await adminDb.from("vehicles").delete().in("id", ids));
      await removeFiles(photos);
    }
    await logActivity({ action: "eliminar", entityType: "viatura", summary: `Removeu ${ids.length} viatura(s) de demonstração` });
    return { ok: true, message: `${ids.length} viatura(s) de demonstração removida(s).` };
  });
}

// ───────────────────────────── Fotografias ─────────────────────────────

export async function reorderPhotos(vehicleId: string, ids: string[]): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(vehicleId) || ids.some((i) => !isUuid(i)) || ids.length > 200) throw new ActionError("Pedido inválido.");
    await Promise.all(ids.map(async (photoId, position) => check(await adminDb.from("vehicle_photos").update({ position }).eq("id", photoId).eq("vehicle_id", vehicleId))));
    check(await adminDb.from("vehicles").update({ updated_by: user.id }).eq("id", vehicleId));
    return { ok: true, message: "Ordem das fotografias guardada." };
  });
}

export async function setPrimaryPhoto(vehicleId: string, photoId: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async () => {
    if (!isUuid(vehicleId) || !isUuid(photoId)) throw new ActionError("Pedido inválido.");
    check(await adminDb.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId).eq("is_primary", true));
    const updated = check(await adminDb.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId).eq("vehicle_id", vehicleId).select("id"));
    if (!(updated as unknown[]).length) throw new ActionError("Fotografia não encontrada.");
    return { ok: true, message: "Fotografia principal definida." };
  });
}

export async function updatePhotoMeta(photoId: string, meta: { altText: string; caption: string }): Promise<ActionResult> {
  return runAction("vehicles.manage", async () => {
    if (!isUuid(photoId)) throw new ActionError("Pedido inválido.");
    check(
      await adminDb
        .from("vehicle_photos")
        .update({ alt_text: meta.altText.trim().slice(0, 200) || null, caption: meta.caption.trim().slice(0, 300) || null })
        .eq("id", photoId),
    );
    return { ok: true, message: "Legenda guardada." };
  });
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async () => {
    if (!isUuid(photoId)) throw new ActionError("Pedido inválido.");
    const rows = check(await adminDb.from("vehicle_photos").delete().eq("id", photoId).select("vehicle_id,storage_key,variants,is_primary")) as {
      vehicle_id: string;
      storage_key: string;
      variants: number[];
      is_primary: boolean;
    }[];
    const p = rows[0];
    if (!p) throw new ActionError("A fotografia já não existe.");
    if (p.is_primary) {
      const next = check(await adminDb.from("vehicle_photos").select("id").eq("vehicle_id", p.vehicle_id).order("position").limit(1)) as { id: string }[];
      if (next[0]) check(await adminDb.from("vehicle_photos").update({ is_primary: true }).eq("id", next[0].id));
    }
    await removeFiles([{ storageKey: p.storage_key, variants: p.variants }]);
    return { ok: true, message: "Fotografia removida." };
  });
}

// ───────────────────────────── Preços e promoções ─────────────────────────────

export async function updateBasePrice(vehicleId: string, priceText: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(vehicleId)) throw new ActionError("Viatura inválida.");
    const cents = parseEurosToCents(priceText);
    if (cents === null || cents <= 0) throw new ActionError("Indique um preço válido, superior a zero.", { price: "Preço inválido." });
    const rows = check(await adminDb.from("vehicles").update({ price_cents: cents, updated_by: user.id }).eq("id", vehicleId).select("reference")) as { reference: string }[];
    if (!rows.length) throw new ActionError("A viatura já não existe.");
    await logActivity({ action: "preco", entityType: "viatura", entityId: vehicleId, summary: `Alterou o preço de ${rows[0].reference} para ${formatPrice(cents)}` });
    return { ok: true, message: `Preço atualizado para ${formatPrice(cents)}.` };
  });
}

export async function createPromotion(vehicleId: string, input: PromotionInput): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(vehicleId)) throw new ActionError("Viatura inválida.");
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Verifique os dados da promoção.", fieldErrors(parsed.error));
    const p = parsed.data;
    const v = check(await adminDb.from("vehicles").select("price_cents,reference,status").eq("id", vehicleId).maybeSingle()) as {
      price_cents: number | null;
      reference: string;
      status: string;
    } | null;
    if (!v) throw new ActionError("A viatura já não existe.");
    if (!v.price_cents) throw new ActionError("Defina primeiro o preço de venda da viatura.");
    if (v.status === "vendido") throw new ActionError("Não é possível criar promoções para viaturas vendidas.");

    let amountCents: number | null = null;
    let percentBp: number | null = null;
    if (p.discountType === "percentagem") {
      const pct = Number(p.value.replace(",", ".").replace("%", "").trim());
      if (!Number.isFinite(pct) || pct <= 0 || pct > 90) throw new ActionError("A percentagem deve estar entre 0,01% e 90%.", { value: "Percentagem inválida." });
      percentBp = Math.round(pct * 100);
    } else {
      amountCents = parseEurosToCents(p.value);
      if (amountCents === null || amountCents <= 0) throw new ActionError("Indique um valor válido.", { value: "Valor inválido." });
      if (p.discountType === "valor" && amountCents >= v.price_cents) throw new ActionError("O desconto tem de ser inferior ao preço de venda.", { value: "Desconto demasiado elevado." });
      if (p.discountType === "preco_final" && amountCents >= v.price_cents)
        throw new ActionError("O preço promocional tem de ser inferior ao preço de venda atual.", { value: "Deve ser inferior ao preço de venda." });
    }

    const tz = (await loadSettings()).regional.timezone;
    const now = new Date();
    const startsAt = p.startsAt ? localInputToDate(p.startsAt, tz) : now;
    if (!startsAt) throw new ActionError("Data de início inválida.", { startsAt: "Data inválida." });
    if (startsAt.getTime() < now.getTime() - 5 * 60_000)
      throw new ActionError("A promoção não pode começar no passado.", { startsAt: "Escolha uma data futura ou deixe vazio para começar agora." });
    const effectiveStart = startsAt.getTime() < now.getTime() ? now : startsAt;
    const endsAt = p.endsAt ? localInputToDate(p.endsAt, tz) : null;
    if (p.endsAt && !endsAt) throw new ActionError("Data de fim inválida.", { endsAt: "Data inválida." });
    if (endsAt && endsAt <= effectiveStart) throw new ActionError("A data de fim tem de ser posterior ao início.", { endsAt: "Deve ser posterior ao início." });

    check(
      await adminDb.from("promotions").insert({
        vehicle_id: vehicleId,
        discount_type: p.discountType,
        amount_cents: amountCents,
        percent_bp: percentBp,
        label: p.label,
        starts_at: effectiveStart.toISOString(),
        ends_at: endsAt?.toISOString() ?? null,
        created_by: user.id,
      }),
    );
    check(await adminDb.from("vehicles").update({ updated_by: user.id }).eq("id", vehicleId));
    const scheduled = effectiveStart.getTime() > now.getTime() + 60_000;
    await logActivity({ action: "promocao", entityType: "promocao", entityId: vehicleId, summary: `${scheduled ? "Agendou" : "Criou"} uma promoção para ${v.reference}` });
    return { ok: true, message: scheduled ? "Promoção agendada." : "Promoção ativa no showroom." };
  });
}

export async function endPromotion(promotionId: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(promotionId)) throw new ActionError("Pedido inválido.");
    const p = check(await adminDb.from("promotions").select("vehicle_id,starts_at,ends_at,cancelled_at").eq("id", promotionId).maybeSingle()) as {
      vehicle_id: string;
      starts_at: string;
      ends_at: string | null;
      cancelled_at: string | null;
    } | null;
    if (!p || p.cancelled_at) throw new ActionError("A promoção já não existe.");
    const now = new Date();
    const started = new Date(p.starts_at) <= now;
    if (!started) check(await adminDb.from("promotions").update({ cancelled_at: now.toISOString() }).eq("id", promotionId));
    else if (!p.ends_at || new Date(p.ends_at) > now) check(await adminDb.from("promotions").update({ ends_at: now.toISOString() }).eq("id", promotionId));
    else throw new ActionError("Esta promoção já terminou.");
    check(await adminDb.from("vehicles").update({ updated_by: user.id }).eq("id", p.vehicle_id));
    await logActivity({ action: "promocao", entityType: "promocao", entityId: p.vehicle_id, summary: "Removeu uma promoção" });
    return { ok: true, message: started ? "Promoção terminada. O preço normal está de novo em vigor." : "Promoção agendada cancelada." };
  });
}
