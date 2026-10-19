import "server-only";
import { draftMode } from "next/headers";
import { cache } from "react";
import { getCurrentAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { parseContent } from "@/lib/site-schema";
import { getPublishedSite } from "./public";

/**
 * Conteúdos para o showroom. Em modo de pré-visualização (ativado por um administrador
 * autenticado) devolve o rascunho dos conteúdos em vez da versão publicada.
 */
export const getSite = cache(async () => {
  const published = await getPublishedSite();
  const draft = await draftMode();
  if (!draft.isEnabled) return { ...published, preview: false };
  const admin = await getCurrentAdmin();
  if (!admin) return { ...published, preview: false };
  const [row] = await sql<{ draft: unknown }[]>`select draft from site_content where key = 'content'`;
  return { settings: published.settings, content: parseContent(row?.draft), preview: true };
});
