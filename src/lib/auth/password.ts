import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Política mínima: 10+ caracteres, com letras e números. Devolve mensagem de erro ou null. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "A palavra-passe deve ter pelo menos 10 caracteres.";
  if (password.length > 128) return "A palavra-passe não pode exceder 128 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password))
    return "A palavra-passe deve conter letras e números.";
  return null;
}

// Hash fictício para equalizar o tempo de resposta quando o utilizador não existe.
let dummyHash: string | null = null;
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= await bcrypt.hash("crewcar-dummy-password", COST);
  await bcrypt.compare(password, dummyHash);
}