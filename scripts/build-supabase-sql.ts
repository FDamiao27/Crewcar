import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_CONTENT, DEFAULT_SETTINGS } from "../src/lib/site-schema";
import { LEGAL_TEMPLATES } from "./legal-templates";

// Gera db/supabase-setup.sql: um único ficheiro para colar no SQL Editor do Supabase
// (migrações + dados iniciais), para quem não pode executar `npm run db:migrate` localmente.
const dir = path.join(process.cwd(), "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const lit = (s: string, tag = "crewcar") => `$${tag}$${s}$${tag}$`;

let out = `-- CREW CAR — instalação completa para Supabase (gerado por scripts/build-supabase-sql.ts)
-- Cole este ficheiro inteiro no Supabase: SQL Editor → New query → Run.
-- Pode ser executado numa base de dados vazia. Não cria viaturas nem utilizadores.

begin;

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;
`;

for (const f of files) {
  out += `\n-- ───────────── ${f} ─────────────\n${readFileSync(path.join(dir, f), "utf8")}\ninsert into schema_migrations (name) values ('${f}') on conflict do nothing;\n`;
}

out += `
-- ───────────── Dados iniciais ─────────────
insert into site_content (key, draft, published, published_at) values
  ('settings', ${lit(JSON.stringify(DEFAULT_SETTINGS), "json")}::jsonb, ${lit(JSON.stringify(DEFAULT_SETTINGS), "json")}::jsonb, now()),
  ('content', ${lit(JSON.stringify(DEFAULT_CONTENT), "json")}::jsonb, ${lit(JSON.stringify(DEFAULT_CONTENT), "json")}::jsonb, now())
on conflict (key) do nothing;
`;
for (const p of LEGAL_TEMPLATES) {
  out += `insert into pages (slug, title, body, is_published) values ('${p.slug}', ${lit(p.title)}, ${lit(p.body)}, false) on conflict (slug) do nothing;\n`;
}

out += `
commit;

-- ───────────── Primeiro administrador (opcional) ─────────────
-- Prefira: DATABASE_URL="…" npm run admin:create -- --email o.seu@email.pt --name "O seu nome"
-- Em alternativa, substitua os valores abaixo, remova os "--" e execute (pgcrypto gera um hash bcrypt):
-- insert into admin_users (email, name, password_hash, role)
-- values ('o.seu@email.pt', 'O seu nome', extensions.crypt('PalavraPasseForte123', extensions.gen_salt('bf', 12)), 'owner');
`;

writeFileSync(path.join(process.cwd(), "db", "supabase-setup.sql"), out);
console.log("✔ db/supabase-setup.sql gerado.");
