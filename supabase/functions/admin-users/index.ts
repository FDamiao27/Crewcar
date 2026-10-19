// CREW CAR — gestão de contas de acesso ao back office (Supabase Edge Function).
//
// Cria contas no Supabase Auth e redefine palavras-passe. Usa a chave de serviço, que só
// existe no ambiente da função (nunca no navegador). Apenas um proprietário ativo
// (admin_users.role = 'owner') pode chamar esta função.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ALLOWED_ORIGINS = ["https://crew-car.pt", "https://www.crew-car.pt", "http://localhost:5173", "http://localhost:4173"];

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}7k`;
}

function passwordProblem(password: string): string | null {
  if (password.length < 10) return "A palavra-passe deve ter pelo menos 10 caracteres.";
  if (password.length > 128) return "A palavra-passe não pode exceder 128 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "A palavra-passe deve conter letras e números.";
  return null;
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("Origin")), "Content-Type": "application/json" };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identificar quem chama através da sessão (JWT) enviada pelo back office
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: me } = await caller.rpc("current_admin").maybeSingle<{ id: string; role: string }>();
  if (!me || me.role !== "owner") return reply({ error: "Não tem permissão para esta operação." }, 403);

  let body: { action?: string; email?: string; password?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Pedido inválido." }, 400);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Só é possível gerir contas de pessoas registadas em admin_users
  const email = String(body.email ?? "").trim().toLowerCase();
  const { data: target } = await admin.from("admin_users").select("id, email, is_active").eq("email", email).maybeSingle();
  if (!target) return reply({ error: "O utilizador não existe no back office." }, 404);

  if (body.action === "create" || body.action === "reset") {
    const generated = !body.password;
    const password = body.password || temporaryPassword();
    const problem = passwordProblem(password);
    if (problem) return reply({ error: problem, field: "password" }, 400);

    // Procurar a conta de autenticação existente com este e-mail
    let authId: string | null = null;
    for (let page = 1; page < 50 && !authId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return reply({ error: "Não foi possível consultar as contas." }, 500);
      authId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (data.users.length < 200) break;
    }
    if (authId) {
      const { error } = await admin.auth.admin.updateUserById(authId, { password, ban_duration: "none" });
      if (error) return reply({ error: "Não foi possível definir a palavra-passe." }, 500);
    } else {
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return reply({ error: "Não foi possível criar a conta de acesso." }, 500);
    }
    await admin.from("admin_users").update({ password_changed_at: new Date().toISOString() }).eq("id", target.id);
    return reply({ ok: true, password: generated ? password : undefined });
  }

  return reply({ error: "Ação desconhecida." }, 400);
});
