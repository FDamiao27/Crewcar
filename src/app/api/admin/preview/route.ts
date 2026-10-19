import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";

// Ativa a pré-visualização dos conteúdos em rascunho (apenas administradores).
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });
  const target = new URL(request.url).searchParams.get("destino") ?? "/";
  const safe = /^\/(?!\/)[\w\-/?=&%.]*$/.test(target) && !target.startsWith("/admin") ? target : "/";
  (await draftMode()).enable();
  redirect(safe);
}
