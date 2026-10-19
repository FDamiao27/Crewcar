"use server";

import { z } from "zod";
import { clientIp } from "@/lib/auth/session";
import { LEAD_SUBJECTS } from "@/lib/constants";
import { asPublic } from "@/lib/db";
import { verifyFormToken } from "@/lib/form-token";
import { hashIp, rateLimit } from "@/lib/rate-limit";

export type LeadFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

const leadSchema = z
  .object({
    name: z.string().trim().min(2, "Indique o seu nome.").max(120, "Nome demasiado longo."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v), "Indique um e-mail válido."),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || (/^[+\d][\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 9), "Indique um telefone válido."),
    subject: z.string().trim().max(150).refine((v) => v === "" || (LEAD_SUBJECTS as readonly string[]).includes(v), "Assunto inválido."),
    message: z.string().trim().min(5, "Escreva uma mensagem (mínimo 5 caracteres).").max(5000, "Mensagem demasiado longa."),
    vehicleId: z.string().trim().refine((v) => v === "" || /^[0-9a-f-]{36}$/i.test(v), "Viatura inválida."),
    consent: z.literal("on", { message: "É necessário aceitar o tratamento dos dados para enviarmos resposta." }),
    source: z.enum(["pagina_contactos", "pagina_viatura", "pagina_inicial"]).catch("pagina_contactos"),
  })
  .refine((v) => v.email !== "" || v.phone !== "", { path: ["email"], message: "Indique um e-mail ou um telefone para o contactarmos." });

export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const raw = Object.fromEntries(
    ["name", "email", "phone", "subject", "message", "vehicleId", "consent", "source"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const values = { ...raw, consent: raw.consent };

  // Proteção anti-spam: campo isco, token temporal e limitação por IP
  if (String(formData.get("website") ?? "") !== "") {
    return { status: "success", message: "Mensagem enviada. Obrigado pelo contacto!" };
  }
  const token = verifyFormToken(String(formData.get("token") ?? ""));
  if (token === "invalid") {
    return { status: "error", message: "O formulário expirou. Atualize a página e tente novamente.", values };
  }
  if (token === "fast") {
    return { status: "error", message: "Envio demasiado rápido. Aguarde um momento e tente novamente.", values };
  }
  const limit = await rateLimit(`lead:${hashIp(await clientIp())}`, 5, 600);
  if (!limit.ok) {
    return {
      status: "error",
      message: `Recebemos demasiados pedidos a partir da sua ligação. Tente novamente dentro de ${Math.ceil(limit.retryAfter / 60)} minuto(s).`,
      values,
    };
  }

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { status: "error", message: "Verifique os campos assinalados.", errors, values };
  }
  const data = parsed.data;
  const linkCount = (data.message.match(/https?:\/\//gi) ?? []).length;
  if (linkCount > 2) {
    return { status: "error", message: "A mensagem contém demasiadas ligações.", errors: { message: "Remova as ligações da mensagem." }, values };
  }

  const referrer = String(formData.get("referrer") ?? "").slice(0, 500) || null;

  try {
    await asPublic(async (tx) => {
      let vehicleId: string | null = null;
      let vehicleLabel: string | null = null;
      if (data.vehicleId) {
        const [v] = await tx<{ id: string; brand: string; model: string; version: string | null; reference: string }[]>`
          select id, brand, model, version, reference from vehicles where id = ${data.vehicleId}`;
        if (v) {
          vehicleId = v.id;
          vehicleLabel = `${v.brand} ${v.model}${v.version ? ` ${v.version}` : ""} (${v.reference})`.slice(0, 200);
        }
      }
      await tx`
        insert into leads (name, email, phone, vehicle_id, vehicle_label, subject, message, source, referrer, consent_at)
        values (${data.name}, ${data.email || null}, ${data.phone || null}, ${vehicleId}, ${vehicleLabel},
                ${data.subject || null}, ${data.message}, ${data.source}, ${referrer}, now())`;
    });
  } catch (err) {
    console.error("Falha ao guardar contacto", err);
    return { status: "error", message: "Não foi possível enviar a mensagem. Tente novamente dentro de instantes.", values };
  }

  return { status: "success", message: "Mensagem enviada. Obrigado pelo contacto — responderemos com a maior brevidade." };
}
