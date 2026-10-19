import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { requireEnv } from "./_env";

async function main() {
  const sql = postgres(requireEnv("DATABASE_URL"), { max: 1, onnotice: () => {} });
  try {
    await sql`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )`;
    await sql`alter table schema_migrations enable row level security`;
    const applied = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const body = await readFile(path.join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      console.log(`✔ ${file}`);
      count++;
    }
    console.log(count ? `${count} migração(ões) aplicada(s).` : "Base de dados atualizada — nada a aplicar.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Falha na migração:", err);
  process.exit(1);
});
