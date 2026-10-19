// Envio de fotografias de viaturas diretamente para o Supabase Storage (substitui
// src/components/admin/photo-upload.ts no back office do GitHub Pages).
import { can } from "@/lib/auth/permissions";
import { adminDb, currentAdmin, logActivity, notifyChange } from "./core";
import { ImageError, processVehiclePhoto, removeFiles } from "./images";

export type UploadResult = { ok: boolean; error?: string };

const MAX_PHOTOS_PER_VEHICLE = 80;

function denied(): UploadResult | null {
  const user = currentAdmin();
  if (!user) return { ok: false, error: "Sessão expirada. Inicie sessão novamente." };
  if (!can(user.role, "vehicles.manage")) return { ok: false, error: "Sem permissão." };
  return null;
}

function failure(err: unknown): UploadResult {
  if (err instanceof ImageError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Não foi possível processar a imagem." };
}

export async function uploadVehiclePhoto(vehicleId: string, file: File, onProgress: (p: number) => void): Promise<UploadResult> {
  const blocked = denied();
  if (blocked) return blocked;
  onProgress(5);
  const { data: existing, error } = await adminDb.from("vehicle_photos").select("position,is_primary").eq("vehicle_id", vehicleId);
  if (error) return { ok: false, error: "Viatura não encontrada." };
  if (existing.length >= MAX_PHOTOS_PER_VEHICLE) return { ok: false, error: `Cada viatura pode ter no máximo ${MAX_PHOTOS_PER_VEHICLE} fotografias.` };
  let stored;
  try {
    stored = await processVehiclePhoto(file, vehicleId);
  } catch (err) {
    return failure(err);
  }
  onProgress(90);
  const position = Math.max(-1, ...existing.map((p) => p.position as number)) + 1;
  const { error: insertError } = await adminDb.from("vehicle_photos").insert({
    vehicle_id: vehicleId,
    storage_key: stored.key,
    width: stored.width,
    height: stored.height,
    bytes: stored.bytes,
    variants: stored.variants,
    position,
    is_primary: !existing.some((p) => p.is_primary),
  });
  if (insertError) {
    await removeFiles([{ storageKey: stored.key, variants: stored.variants }]);
    return { ok: false, error: "Não foi possível registar a fotografia." };
  }
  const user = currentAdmin()!;
  await adminDb.from("vehicles").update({ updated_by: user.id }).eq("id", vehicleId);
  await logActivity({ action: "fotografias", entityType: "viatura", entityId: vehicleId, summary: `Carregou a fotografia "${file.name.slice(0, 80)}"` });
  onProgress(100);
  notifyChange();
  return { ok: true };
}

export async function replaceVehiclePhoto(photoId: string, file: File): Promise<UploadResult> {
  const blocked = denied();
  if (blocked) return blocked;
  const { data: photo } = await adminDb.from("vehicle_photos").select("vehicle_id,storage_key,variants").eq("id", photoId).maybeSingle();
  if (!photo) return { ok: false, error: "Fotografia não encontrada." };
  let stored;
  try {
    stored = await processVehiclePhoto(file, photo.vehicle_id);
  } catch (err) {
    return failure(err);
  }
  const { error } = await adminDb
    .from("vehicle_photos")
    .update({ storage_key: stored.key, width: stored.width, height: stored.height, bytes: stored.bytes, variants: stored.variants })
    .eq("id", photoId);
  if (error) {
    await removeFiles([{ storageKey: stored.key, variants: stored.variants }]);
    return { ok: false, error: "Não foi possível substituir a fotografia." };
  }
  await removeFiles([{ storageKey: photo.storage_key, variants: photo.variants }]);
  await adminDb.from("vehicles").update({ updated_by: currentAdmin()!.id }).eq("id", photo.vehicle_id);
  notifyChange();
  return { ok: true };
}
