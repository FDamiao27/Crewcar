"use server";

import { clientIp } from "@/lib/auth/session";
import { asPublic } from "@/lib/db";
import { verifyFormToken } from "@/lib/form-token";
import { hashIp, rateLimit } from "@/lib/rate-limit";
import { leadSchema } from "@/lib/lead-schema";

export type LeadFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

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
