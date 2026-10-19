import { deletePhotoFiles } from "@/lib/admin/vehicles";
import { json, sameOrigin } from "@/lib/admin/request";
import { getCurrentAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { sql } from "@/lib/db";
import { ImageError, processVehiclePhoto } from "@/lib/images";

// Substituição de uma fotografia (mantém posição, legenda e estado de fotografia principal).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ error: "Pedido inválido." }, 403);
  const user = await getCurrentAdmin();
  if (!user || !can(user.role, "vehicles.manage")) return json({ error: "Sem permissão." }, 401);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Fotografia inválida." }, 400);
  const [photo] = await sql<{ vehicleId: string; storageKey: string; variants: number[] }[]>`
    select vehicle_id, storage_key, variants from vehicle_photos where id = ${id}`;
  if (!photo) return json({ error: "Fotografia não encontrada." }, 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Nenhum ficheiro recebido." }, 400);
  try {
    const img = await processVehiclePhoto(file, photo.vehicleId);
    await sql`
      update vehicle_photos set storage_key = ${img.key}, width = ${img.width}, height = ${img.height},
        bytes = ${img.bytes}, variants = ${img.variants}
      where id = ${id}`;
    await deletePhotoFiles([photo]);
    await sql`update vehicles set updated_by = ${user.id}, updated_at = now() where id = ${photo.vehicleId}`;
    return json({ ok: true });
  } catch (err) {
    if (!(err instanceof ImageError)) console.error(err);
    return json({ error: err instanceof ImageError ? err.message : "Não foi possível processar a imagem." }, 400);
  }
}
