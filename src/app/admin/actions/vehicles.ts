"use server";

import { logActivity } from "@/lib/activity";
import { ActionError, runAction, type ActionResult } from "@/lib/admin/action";
import { copyPhotos, deletePhotoFiles, insertVehicle, uniqueSlug, updateVehicleRow } from "@/lib/admin/vehicles";
import { can } from "@/lib/auth/permissions";
import { sql, type Tx } from "@/lib/db";
import { formatPrice, parseEurosToCents } from "@/lib/format";
import { localInputToDate } from "@/lib/time";
import { fieldErrors, promotionSchema, vehicleSchema, type PromotionInput, type VehicleFormState } from "@/lib/vehicle-schema";
import { getAdminSettings } from "@/lib/queries/admin";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

function parseVehicle(input: VehicleFormState) {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) throw new ActionError("Existem campos por corrigir. Verifique os separadores assinalados.", fieldErrors(parsed.error));
  return parsed.data;
}

export async function createVehicle(input: VehicleFormState): Promise<ActionResult<{ id: string }>> {
  return runAction("vehicles.manage", async (user) => {
    const data = parseVehicle(input);
    const row = await sql.begin((tx) => insertVehicle(tx as unknown as Tx, data, user.id, { canSeeCosts: can(user.role, "costs.view") }));
    await logActivity({ actorId: user.id, action: "criar", entityType: "viatura", entityId: row.id, summary: `Criou a viatura ${data.brand} ${data.model} (${data.reference})` });
    return { ok: true, message: "Viatura criada.", data: { id: row.id } };
  });
}

export async function updateVehicle(id: string, input: VehicleFormState): Promise<ActionResult<{ slug: string }>> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(id)) throw new ActionError("Viatura inválida.");
    const data = parseVehicle(input);
    const result = await sql.begin((tx) => updateVehicleRow(tx as unknown as Tx, id, data, user.id, { canSeeCosts: can(user.role, "costs.view") }));
    if (!result) throw new ActionError("A viatura já não existe.");
    await logActivity({ actorId: user.id, action: "editar", entityType: "viatura", entityId: id, summary: `Editou a viatura ${data.brand} ${data.model} (${data.reference})` });
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
    const [v] = await sql<{ reference: string; brand: string; model: string; priceCents: number | null; archivedAt: Date | null }[]>`
      select reference, brand, model, price_cents, archived_at from vehicles where id = ${id}`;
    if (!v) throw new ActionError("A viatura já não existe.");
    if (action === "publicar") {
      if (!v.priceCents) throw new ActionError("Indique o preço de venda antes de publicar.");
      if (v.archivedAt) throw new ActionError("Restaure a viatura antes de a publicar.");
    }
    const by = user.id;
    switch (action) {
      case "publicar":
        await sql`update vehicles set is_published = true, published_at = coalesce(published_at, now()), updated_by = ${by} where id = ${id}`;
        break;
      case "retirar":
        await sql`update vehicles set is_published = false, updated_by = ${by} where id = ${id}`;
        break;
      case "destacar":
        await sql`update vehicles set is_featured = true, updated_by = ${by} where id = ${id}`;
        break;
      case "remover_destaque":
        await sql`update vehicles set is_featured = false, updated_by = ${by} where id = ${id}`;
        break;
      case "disponivel":
        await sql`update vehicles set status = 'disponivel', reserved_at = null, sold_at = null, updated_by = ${by} where id = ${id}`;
        break;
      case "reservar":
        await sql`update vehicles set status = 'reservado', reserved_at = now(), sold_at = null, updated_by = ${by} where id = ${id}`;
        break;
      case "vender":
        await sql`update vehicles set status = 'vendido', sold_at = now(), is_featured = false, updated_by = ${by} where id = ${id}`;
        // Promoções ativas ou agendadas terminam com a venda
        await sql`update promotions set ends_at = now() where vehicle_id = ${id} and cancelled_at is null and starts_at <= now() and (ends_at is null or ends_at > now())`;
        await sql`update promotions set cancelled_at = now() where vehicle_id = ${id} and cancelled_at is null and starts_at > now()`;
        break;
      case "arquivar":
        await sql`update vehicles set archived_at = now(), is_published = false, is_featured = false, updated_by = ${by} where id = ${id}`;
        break;
      case "restaurar":
        await sql`update vehicles set archived_at = null, updated_by = ${by} where id = ${id}`;
        break;
    }
    await logActivity({ actorId: by, action, entityType: "viatura", entityId: id, summary: `${QUICK_MESSAGES[action].replace(/\.$/, "")}: ${v.brand} ${v.model} (${v.reference})` });
    return { ok: true, message: QUICK_MESSAGES[action] };
  });
}

export async function duplicateVehicle(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(id)) throw new ActionError("Viatura inválida.");
    const newId = await sql.begin(async (rawTx) => {
      const tx = rawTx as unknown as Tx;
      const [src] = await tx<{ reference: string; slug: string; brand: string; model: string }[]>`select reference, slug, brand, model from vehicles where id = ${id}`;
      if (!src) throw new ActionError("A viatura já não existe.");
      let reference = `${src.reference}-COPIA`.slice(0, 40);
      for (let i = 2; (await tx`select 1 from vehicles where lower(reference) = lower(${reference})`).length; i++) {
        reference = `${src.reference.slice(0, 32)}-COPIA${i}`;
      }
      const slug = await uniqueSlug(tx, `${src.slug}-copia`);
      const [row] = await tx<{ id: string }[]>`
        insert into vehicles (
          slug, reference, brand, model, version, category, registration_year, first_registration_date, mileage_km, fuel,
          transmission, engine_cc, power_hp, exterior_color, interior_color, doors, seats, condition, purchase_price_cents,
          price_cents, short_description, description, warranty_info, warranty_verified, commercial_info, internal_notes,
          video_url, status, is_published, is_featured, is_demo, seo_title, seo_description, created_by, updated_by)
        select ${slug}, ${reference}, brand, model, version, category, registration_year, first_registration_date, mileage_km, fuel,
          transmission, engine_cc, power_hp, exterior_color, interior_color, doors, seats, condition, purchase_price_cents,
          price_cents, short_description, description, warranty_info, warranty_verified, commercial_info, internal_notes,
          video_url, 'disponivel', false, false, is_demo, null, null, ${user.id}, ${user.id}
        from vehicles where id = ${id}
        returning id`;
      await tx`insert into vehicle_equipment (vehicle_id, kind, label, position) select ${row.id}, kind, label, position from vehicle_equipment where vehicle_id = ${id}`;
      await tx`insert into vehicle_links (vehicle_id, kind, label, url, is_public, position) select ${row.id}, kind, label, url, is_public, position from vehicle_links where vehicle_id = ${id}`;
      return row.id;
    });
    const copied = await copyPhotos(id, newId);
    await logActivity({ actorId: user.id, action: "duplicar", entityType: "viatura", entityId: newId, summary: `Duplicou o anúncio ${id.slice(0, 8)} (${copied} fotografia(s) copiada(s))` });
    return { ok: true, message: "Anúncio duplicado como rascunho (não publicado). Reveja a referência e o VIN.", data: { id: newId } };
  });
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  return runAction("vehicles.delete", async (user) => {
    if (!isUuid(id)) throw new ActionError("Viatura inválida.");
    const photos = await sql<{ storageKey: string; variants: number[] }[]>`select storage_key, variants from vehicle_photos where vehicle_id = ${id}`;
    const [v] = await sql<{ reference: string; brand: string; model: string }[]>`delete from vehicles where id = ${id} returning reference, brand, model`;
    if (!v) throw new ActionError("A viatura já não existe.");
    await deletePhotoFiles(photos);
    await logActivity({ actorId: user.id, action: "eliminar", entityType: "viatura", entityId: id, summary: `Eliminou a viatura ${v.brand} ${v.model} (${v.reference})` });
    return { ok: true, message: "Viatura eliminada definitivamente." };
  });
}

export async function removeDemoVehicles(): Promise<ActionResult> {
  return runAction("vehicles.delete", async (user) => {
    const photos = await sql<{ storageKey: string; variants: number[] }[]>`
      select p.storage_key, p.variants from vehicle_photos p join vehicles v on v.id = p.vehicle_id where v.is_demo`;
    const removed = await sql`delete from vehicles where is_demo returning id`;
    await deletePhotoFiles(photos);
    await logActivity({ actorId: user.id, action: "eliminar", entityType: "viatura", summary: `Removeu ${removed.length} viatura(s) de demonstração` });
    return { ok: true, message: `${removed.length} viatura(s) de demonstração removida(s).` };
  });
}

// ───────────────────────────── Fotografias ─────────────────────────────

export async function reorderPhotos(vehicleId: string, ids: string[]): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(vehicleId) || ids.some((i) => !isUuid(i)) || ids.length > 200) throw new ActionError("Pedido inválido.");
    await sql.begin(async (tx) => {
      for (const [position, photoId] of ids.entries()) {
        await tx`update vehicle_photos set position = ${position} where id = ${photoId} and vehicle_id = ${vehicleId}`;
      }
      await tx`update vehicles set updated_by = ${user.id}, updated_at = now() where id = ${vehicleId}`;
    });
    return { ok: true, message: "Ordem das fotografias guardada." };
  });
}

export async function setPrimaryPhoto(vehicleId: string, photoId: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async () => {
    if (!isUuid(vehicleId) || !isUuid(photoId)) throw new ActionError("Pedido inválido.");
    await sql.begin(async (tx) => {
      await tx`update vehicle_photos set is_primary = false where vehicle_id = ${vehicleId} and is_primary`;
      const r = await tx`update vehicle_photos set is_primary = true where id = ${photoId} and vehicle_id = ${vehicleId}`;
      if (r.count === 0) throw new ActionError("Fotografia não encontrada.");
    });
    return { ok: true, message: "Fotografia principal definida." };
  });
}

export async function updatePhotoMeta(photoId: string, meta: { altText: string; caption: string }): Promise<ActionResult> {
  return runAction("vehicles.manage", async () => {
    if (!isUuid(photoId)) throw new ActionError("Pedido inválido.");
    const alt = meta.altText.trim().slice(0, 200) || null;
    const caption = meta.caption.trim().slice(0, 300) || null;
    await sql`update vehicle_photos set alt_text = ${alt}, caption = ${caption} where id = ${photoId}`;
    return { ok: true, message: "Legenda guardada." };
  });
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async () => {
    if (!isUuid(photoId)) throw new ActionError("Pedido inválido.");
    const [p] = await sql<{ vehicleId: string; storageKey: string; variants: number[]; isPrimary: boolean }[]>`
      delete from vehicle_photos where id = ${photoId} returning vehicle_id, storage_key, variants, is_primary`;
    if (!p) throw new ActionError("A fotografia já não existe.");
    if (p.isPrimary) {
      await sql`
        update vehicle_photos set is_primary = true
        where id = (select id from vehicle_photos where vehicle_id = ${p.vehicleId} order by position limit 1)`;
    }
    await deletePhotoFiles([p]);
    return { ok: true, message: "Fotografia removida." };
  });
}

// ───────────────────────────── Preços e promoções ─────────────────────────────

export async function updateBasePrice(vehicleId: string, priceText: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(vehicleId)) throw new ActionError("Viatura inválida.");
    const cents = parseEurosToCents(priceText);
    if (cents === null || cents <= 0) throw new ActionError("Indique um preço válido, superior a zero.", { price: "Preço inválido." });
    const [v] = await sql<{ reference: string }[]>`
      update vehicles set price_cents = ${cents}, updated_by = ${user.id} where id = ${vehicleId} returning reference`;
    if (!v) throw new ActionError("A viatura já não existe.");
    await logActivity({ actorId: user.id, action: "preco", entityType: "viatura", entityId: vehicleId, summary: `Alterou o preço de ${v.reference} para ${formatPrice(cents)}` });
    return { ok: true, message: `Preço atualizado para ${formatPrice(cents)}.` };
  });
}

export async function createPromotion(vehicleId: string, input: PromotionInput): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(vehicleId)) throw new ActionError("Viatura inválida.");
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Verifique os dados da promoção.", fieldErrors(parsed.error));
    const p = parsed.data;
    const [v] = await sql<{ priceCents: number | null; reference: string; status: string }[]>`select price_cents, reference, status from vehicles where id = ${vehicleId}`;
    if (!v) throw new ActionError("A viatura já não existe.");
    if (!v.priceCents) throw new ActionError("Defina primeiro o preço de venda da viatura.");
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
      if (p.discountType === "valor" && amountCents >= v.priceCents)
        throw new ActionError("O desconto tem de ser inferior ao preço de venda.", { value: "Desconto demasiado elevado." });
      if (p.discountType === "preco_final" && amountCents >= v.priceCents)
        throw new ActionError("O preço promocional tem de ser inferior ao preço de venda atual.", { value: "Deve ser inferior ao preço de venda." });
    }

    const tz = (await getAdminSettings()).regional.timezone;
    const now = new Date();
    const startsAt = p.startsAt ? localInputToDate(p.startsAt, tz) : now;
    if (!startsAt) throw new ActionError("Data de início inválida.", { startsAt: "Data inválida." });
    const effectiveStart = startsAt.getTime() < now.getTime() ? now : startsAt;
    if (startsAt.getTime() < now.getTime() - 5 * 60_000)
      throw new ActionError("A promoção não pode começar no passado.", { startsAt: "Escolha uma data futura ou deixe vazio para começar agora." });
    const endsAt = p.endsAt ? localInputToDate(p.endsAt, tz) : null;
    if (p.endsAt && !endsAt) throw new ActionError("Data de fim inválida.", { endsAt: "Data inválida." });
    if (endsAt && endsAt <= effectiveStart) throw new ActionError("A data de fim tem de ser posterior ao início.", { endsAt: "Deve ser posterior ao início." });

    await sql`
      insert into promotions (vehicle_id, discount_type, amount_cents, percent_bp, label, starts_at, ends_at, created_by)
      values (${vehicleId}, ${p.discountType}, ${amountCents}, ${percentBp}, ${p.label}, ${effectiveStart}, ${endsAt}, ${user.id})`;
    await sql`update vehicles set updated_by = ${user.id}, updated_at = now() where id = ${vehicleId}`;
    const scheduled = effectiveStart.getTime() > now.getTime() + 60_000;
    await logActivity({ actorId: user.id, action: "promocao", entityType: "promocao", entityId: vehicleId, summary: `${scheduled ? "Agendou" : "Criou"} uma promoção para ${v.reference}` });
    return { ok: true, message: scheduled ? "Promoção agendada." : "Promoção ativa no showroom." };
  });
}

export async function endPromotion(promotionId: string): Promise<ActionResult> {
  return runAction("vehicles.manage", async (user) => {
    if (!isUuid(promotionId)) throw new ActionError("Pedido inválido.");
    const [p] = await sql<{ vehicleId: string; startsAt: Date; endsAt: Date | null; cancelledAt: Date | null }[]>`
      select vehicle_id, starts_at, ends_at, cancelled_at from promotions where id = ${promotionId}`;
    if (!p || p.cancelledAt) throw new ActionError("A promoção já não existe.");
    const now = new Date();
    if (p.startsAt > now) {
      // Ainda não começou: cancelar (nunca foi praticada)
      await sql`update promotions set cancelled_at = now() where id = ${promotionId}`;
    } else if (!p.endsAt || p.endsAt > now) {
      // Em curso: terminar agora, mantendo o registo histórico
      await sql`update promotions set ends_at = now() where id = ${promotionId}`;
    } else {
      throw new ActionError("Esta promoção já terminou.");
    }
    await sql`update vehicles set updated_by = ${user.id}, updated_at = now() where id = ${p.vehicleId}`;
    await logActivity({ actorId: user.id, action: "promocao", entityType: "promocao", entityId: p.vehicleId, summary: "Removeu uma promoção" });
    return { ok: true, message: p.startsAt > now ? "Promoção agendada cancelada." : "Promoção terminada. O preço normal está de novo em vigor." };
  });
}
