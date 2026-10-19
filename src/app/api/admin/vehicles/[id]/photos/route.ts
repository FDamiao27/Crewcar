import { logActivity } from "@/lib/activity";
import { json, sameOrigin } from "@/lib/admin/request";
import { getCurrentAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { sql } from "@/lib/db";
import { ImageError, MAX_FILES_PER_UPLOAD, processVehiclePhoto } from "@/lib/images";

const MAX_PHOTOS_PER_VEHICLE = 80;

// Carregamento de várias fotografias de uma viatura (multipart/form-data, campo "files").
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ error: "Pedido inválido." }, 403);
  const user = await getCurrentAdmin();
  if (!user || !can(user.role, "vehicles.manage")) return json({ error: "Sem permissão." }, 401);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Viatura inválida." }, 400);

  const [vehicle] = await sql<{ reference: string; count: number; maxPos: number | null; hasPrimary: boolean }[]>`
    select v.reference,
           (select count(*)::int from vehicle_photos where vehicle_id = v.id) as count,
           (select max(position) from vehicle_photos where vehicle_id = v.id) as max_pos,
           exists (select 1 from vehicle_photos where vehicle_id = v.id and is_primary) as has_primary
    from vehicles v where v.id = ${id}`;
  if (!vehicle) return json({ error: "Viatura não encontrada." }, 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Não foi possível ler os ficheiros enviados." }, 400);
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return json({ error: "Nenhum ficheiro recebido." }, 400);
  if (files.length > MAX_FILES_PER_UPLOAD) return json({ error: `Envie no máximo ${MAX_FILES_PER_UPLOAD} fotografias de cada vez.` }, 400);
  if (vehicle.count + files.length > MAX_PHOTOS_PER_VEHICLE)
    return json({ error: `Cada viatura pode ter no máximo ${MAX_PHOTOS_PER_VEHICLE} fotografias.` }, 400);

  const errors: string[] = [];
  const created: string[] = [];
  let position = (vehicle.maxPos ?? -1) + 1;
  let hasPrimary = vehicle.hasPrimary;
  for (const file of files) {
    try {
      const img = await processVehiclePhoto(file, id);
      const [row] = await sql<{ id: string }[]>`
        insert into vehicle_photos (vehicle_id, storage_key, width, height, bytes, variants, position, is_primary)
        values (${id}, ${img.key}, ${img.width}, ${img.height}, ${img.bytes}, ${img.variants}, ${position++}, ${!hasPrimary})
        returning id`;
      hasPrimary = true;
      created.push(row.id);
    } catch (err) {
      errors.push(err instanceof ImageError ? err.message : `"${file.name}": não foi possível processar a imagem.`);
      if (!(err instanceof ImageError)) console.error(err);
    }
  }
  if (created.length) {
    await sql`update vehicles set updated_by = ${user.id}, updated_at = now() where id = ${id}`;
    await logActivity({ actorId: user.id, action: "fotografias", entityType: "viatura", entityId: id, summary: `Carregou ${created.length} fotografia(s) para ${vehicle.reference}` });
  }
  return json({ created: created.length, errors }, created.length ? 200 : 400);
}
