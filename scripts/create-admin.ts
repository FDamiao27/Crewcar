import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { hashPassword, passwordProblem } from "../src/lib/auth/password";
import { requireEnv } from "./_env";

// Cria (ou atualiza) um utilizador administrativo. Não existe registo público de contas.
//
//   npm run admin:create -- --email nome@empresa.pt --name "Nome" [--role owner] [--password "..."]
//
// Sem --password, é gerada uma palavra-passe aleatória e apresentada uma única vez.
async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "owner" },
      password: { type: "string" },
    },
  });
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Indique um e-mail válido: --email nome@empresa.pt');
    process.exit(1);
  }
  const role = values.role ?? "owner";
  if (!["owner", "admin", "editor"].includes(role)) {
    console.error("Perfil inválido. Utilize owner, admin ou editor.");
    process.exit(1);
  }
  const generated = !values.password;
  const password = values.password ?? `${randomBytes(9).toString("base64url")}9a`;
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }

  const sql = postgres(requireEnv("DATABASE_URL"), { max: 1, onnotice: () => {} });
  try {
    const hash = await hashPassword(password);
    const name = values.name?.trim() || email.split("@")[0];
    await sql`
      insert into admin_users (email, name, password_hash, role)
      values (${email}, ${name}, ${hash}, ${role})
      on conflict (email) do update
        set password_hash = excluded.password_hash, role = excluded.role, name = excluded.name,
            is_active = true, failed_login_count = 0, locked_until = null, password_changed_at = now()`;
    console.log(`✔ Utilizador ${email} (${role}) pronto.`);
    if (generated) console.log(`  Palavra-passe temporária: ${password}\n  Altere-a após o primeiro início de sessão (Conta → Palavra-passe).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
