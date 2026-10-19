import { config } from "dotenv";

// Carrega .env.local e depois .env (os valores já definidos no ambiente têm prioridade).
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente em falta: ${name}`);
    process.exit(1);
  }
  return value;
}
