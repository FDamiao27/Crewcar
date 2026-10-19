import { getCurrentAdmin } from "@/lib/auth/session";
import { asPublic } from "@/lib/db";
import { assertValidKey, storage } from "@/lib/storage";

// Serve os ficheiros carregados. As fotografias de viaturas só são entregues ao público
// quando a viatura está publicada (verificação feita com a role restrita da base de dados);
// administradores autenticados podem ver todas.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  try {
    assertValidKey(key);
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }

  let cacheControl = "public, max-age=31536000, immutable";
  if (parts[0] === "vehicles") {
    const vehicleId = parts[1];
    if (!/^[0-9a-f-]{36}$/.test(vehicleId)) return new Response("Não encontrado", { status: 404 });
    const visible = await asPublic(async (tx) => (await tx`select 1 from vehicles where id = ${vehicleId}`).length > 0);
    if (visible) {
      cacheControl = "public, max-age=86400, stale-while-revalidate=604800";
    } else if (await getCurrentAdmin()) {
      cacheControl = "private, no-store";
    } else {
      return new Response("Não encontrado", { status: 404 });
    }
  }

  const file = await storage().get(key);
  if (!file) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.body.length),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
