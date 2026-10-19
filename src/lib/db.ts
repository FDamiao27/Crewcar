import "server-only";
import postgres from "postgres";

type Sql = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;

function createClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não está definida.");
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 15,
    // Supabase pooler (modo transação) não suporta prepared statements.
    prepare: process.env.DATABASE_PREPARE !== "false",
    transform: postgres.camel,
    onnotice: () => {},
    types: {
      // Manter colunas "date" como texto AAAA-MM-DD (sem conversões de fuso horário).
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  }) as unknown as Sql;
}

const globalForDb = globalThis as unknown as { __crewcarSql?: Sql };
export const sql: Sql = globalForDb.__crewcarSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__crewcarSql = sql;

/**
 * Executa consultas do showroom público com a role restrita "crewcar_web".
 * A base de dados garante que apenas colunas e linhas públicas são acessíveis.
 */
export async function asPublic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`set local role crewcar_web`;
    return fn(tx as unknown as Tx);
  })) as T;
}

/** Erros PostgreSQL conhecidos, para mensagens claras ao utilizador. */
export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
export function pgConstraint(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "constraint_name" in err
    ? String((err as { constraint_name: unknown }).constraint_name)
    : undefined;
}
