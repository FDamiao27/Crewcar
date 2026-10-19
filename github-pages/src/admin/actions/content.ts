// Versão no navegador de src/app/admin/actions/content.ts.
import { PUBLIC_PAGES } from "@/lib/constants";
import { contentSchema, settingsSchema, type Asset, type Content, type Settings } from "@/lib/site-schema";
import { fieldErrors } from "@/lib/vehicle-schema";
import { ActionError, adminDb, check, logActivity, runAction, type ActionResult } from "../core";
import { ImageError, processSiteImage } from "../images";

function parseContentInput(input: Content): Content {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) throw new ActionError("Existem campos por corrigir.", fieldErrors(parsed.error));
  return parsed.data;
}

const now = () => new Date().toISOString();

export async function saveContentDraft(input: Content): Promise<ActionResult> {
  return runAction("content.manage", async (user) => {
    const content = parseContentInput(input);
    check(await adminDb.from("site_content").update({ draft: content, updated_by: user.id, updated_at: now() }).eq("key", "content"));
    return { ok: true, message: "Rascunho guardado. Os visitantes continuam a ver a versão publicada." };
  });
}

export async function publishContent(input: Content): Promise<ActionResult> {
  return runAction("content.manage", async (user) => {
    const content = parseContentInput(input);
    check(
      await adminDb
        .from("site_content")
        .update({ draft: content, published: content, updated_by: user.id, updated_at: now(), published_at: now() })
        .eq("key", "content"),
    );
    await logActivity({ action: "publicar", entityType: "conteudo", summary: "Publicou alterações aos conteúdos do website" });
    return { ok: true, message: "Conteúdos publicados no website." };
  });
}

export async function discardContentDraft(): Promise<ActionResult> {
  return runAction("content.manage", async (user) => {
    const row = check(await adminDb.from("site_content").select("published").eq("key", "content").single()) as { published: unknown };
    check(await adminDb.from("site_content").update({ draft: row.published, updated_by: user.id, updated_at: now() }).eq("key", "content"));
    return { ok: true, message: "Rascunho descartado." };
  });
}

export async function saveSettings(input: Settings): Promise<ActionResult> {
  return runAction("settings.manage", async (user) => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Existem campos por corrigir.", fieldErrors(parsed.error));
    const settings = parsed.data;
    check(
      await adminDb
        .from("site_content")
        .update({ draft: settings, published: settings, updated_by: user.id, updated_at: now(), published_at: now() })
        .eq("key", "settings"),
    );
    await logActivity({ action: "definicoes", entityType: "definicoes", summary: "Atualizou as definições gerais" });
    return { ok: true, message: "Definições guardadas e aplicadas ao website." };
  });
}

/** Carregamento de imagens do site (imagem principal, logótipo, favicon, imagem de partilha). */
export async function uploadSiteImage(formData: FormData): Promise<ActionResult<NonNullable<Asset>>> {
  const kind = String(formData.get("kind") ?? "");
  if (!["hero", "logo", "favicon", "og"].includes(kind)) return { ok: false, message: "Tipo de imagem inválido." };
  return runAction(kind === "logo" || kind === "favicon" ? "settings.manage" : "content.manage", async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ActionError("Nenhum ficheiro recebido.");
    try {
      const img = await processSiteImage(file, kind as "hero" | "logo" | "favicon" | "og");
      return { ok: true, data: { key: img.key, width: img.width, height: img.height, variants: img.variants }, message: "Imagem carregada. Guarde para aplicar." };
    } catch (err) {
      if (err instanceof ImageError) throw new ActionError(err.message);
      throw err;
    }
  });
}

export async function savePage(
  slug: string,
  input: { title: string; body: string; seoTitle: string; seoDescription: string; isPublished: boolean },
): Promise<ActionResult> {
  return runAction("content.manage", async (user) => {
    if (!(slug in PUBLIC_PAGES)) throw new ActionError("Página inválida.");
    const title = input.title.trim();
    const errors: Record<string, string> = {};
    if (!title) errors.title = "Indique o título.";
    if (title.length > 150) errors.title = "Máximo de 150 caracteres.";
    if (input.body.length > 100000) errors.body = "Texto demasiado longo.";
    if (input.isPublished && input.body.trim().length < 20) errors.body = "Escreva o conteúdo antes de publicar.";
    if (input.seoTitle.length > 120) errors.seoTitle = "Máximo de 120 caracteres.";
    if (input.seoDescription.length > 300) errors.seoDescription = "Máximo de 300 caracteres.";
    if (Object.keys(errors).length) throw new ActionError("Existem campos por corrigir.", errors);
    check(
      await adminDb
        .from("pages")
        .update({
          title,
          body: input.body,
          seo_title: input.seoTitle.trim() || null,
          seo_description: input.seoDescription.trim() || null,
          is_published: input.isPublished,
          updated_by: user.id,
        })
        .eq("slug", slug),
    );
    await logActivity({ action: "pagina", entityType: "pagina", entityId: slug, summary: `Atualizou a página “${title}”${input.isPublished ? " (publicada)" : " (rascunho)"}` });
    return { ok: true, message: input.isPublished ? "Página guardada e publicada." : "Página guardada como rascunho (não visível no website)." };
  });
}
