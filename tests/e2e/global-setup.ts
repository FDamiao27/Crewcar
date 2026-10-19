import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import postgres from "postgres";

const DB = process.env.TEST_DATABASE_URL ?? "postgres://crewcar:crewcar_dev@localhost:5432/crewcar_test";

export const OWNER = { email: "dono@teste.crewcar", password: "TesteDono2026seguro" };
export const EDITOR = { email: "editor@teste.crewcar", password: "TesteEditor2026seguro" };

// Prepara uma base de dados de testes limpa: migrações, dados iniciais, utilizadores e
// viaturas de demonstração (claramente identificadas como tal).
export default async function globalSetup() {
  const env = { ...process.env, DATABASE_URL: DB };
  const run = (script: string, args: string[] = []) => execFileSync("npx", ["tsx", script, ...args], { env, stdio: "inherit" });
  run("scripts/migrate.ts");
  const sql = postgres(DB, { max: 1, onnotice: () => {} });
  await sql`
    truncate table activity_log, rate_limits, lead_activity, leads, promotions, price_history, vehicle_links,
      vehicle_equipment, vehicle_photos, vehicles, admin_sessions, admin_users, site_content, pages restart identity cascade`;
  await sql.end();
  rmSync("storage-test", { recursive: true, force: true });
  run("scripts/seed.ts");
  run("scripts/create-admin.ts", ["--email", OWNER.email, "--name", "Dono Teste", "--role", "owner", "--password", OWNER.password]);
  run("scripts/create-admin.ts", ["--email", EDITOR.email, "--name", "Editor Teste", "--role", "editor", "--password", EDITOR.password]);
  run("scripts/seed-demo.ts");
  // Estado de navegação "anónimo" com a escolha de cookies já feita (o aviso não cobre os botões)
  mkdirSync("tests/e2e/.auth", { recursive: true });
  writeFileSync(
    "tests/e2e/.auth/anon.json",
    JSON.stringify({
      cookies: [{ name: "cc_consent", value: "rejected", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
      origins: [],
    }),
  );
}
