// Validação dos pedidos de contacto (partilhada pelo site Next.js e pelo showroom estático).
import { z } from "zod";
import { LEAD_SUBJECTS } from "./constants";

export const leadSchema = z
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

export type LeadInput = z.output<typeof leadSchema>;

export function leadFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
