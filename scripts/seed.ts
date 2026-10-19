import postgres from "postgres";
import { DEFAULT_CONTENT, DEFAULT_SETTINGS } from "../src/lib/site-schema";
import { requireEnv } from "./_env";
import { LEGAL_TEMPLATES } from "./legal-templates";

// Dados iniciais obrigatórios: definições e conteúdos por omissão e modelos das páginas
// legais (em rascunho). Não cria viaturas nem contactos. Pode ser executado várias vezes.
async function main() {
  const sql = postgres(requireEnv("DATABASE_URL"), { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into site_content (key, draft, published, published_at)
      values ('settings', ${sql.json(DEFAULT_SETTINGS)}, ${sql.json(DEFAULT_SETTINGS)}, now()),
             ('content', ${sql.json(DEFAULT_CONTENT)}, ${sql.json(DEFAULT_CONTENT)}, now())
      on conflict (key) do nothing`;
    for (const page of LEGAL_TEMPLATES) {
      await sql`
        insert into pages (slug, title, body, is_published)
        values (${page.slug}, ${page.title}, ${page.body}, false)
        on conflict (slug) do nothing`;
    }
    console.log("✔ Definições, conteúdos e modelos de páginas legais prontos.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
