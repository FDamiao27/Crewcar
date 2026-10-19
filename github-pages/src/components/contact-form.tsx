import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { LEAD_SUBJECTS } from "@/lib/constants";
import { leadFieldErrors, leadSchema } from "@/lib/lead-schema";
import { insertLead } from "../data";

const MIN_SECONDS = 3;

/** Formulário de contacto do showroom estático: grava o pedido diretamente no Supabase. */
export function ContactForm({
  vehicle,
  vehicles,
  source,
  privacyPage,
  defaultMessage,
}: {
  vehicle?: { id: string; label: string };
  vehicles?: { id: string; label: string }[];
  source: "pagina_contactos" | "pagina_viatura" | "pagina_inicial";
  privacyPage: boolean;
  defaultMessage?: string;
}) {
  const openedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "success" || status === "error") statusRef.current?.focus();
  }, [status]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Campo isco: preenchido apenas por robôs
    if (String(fd.get("website") ?? "") !== "") {
      setStatus("success");
      return;
    }
    if ((Date.now() - openedAt.current) / 1000 < MIN_SECONDS) {
      setStatus("error");
      setMessage("Envio demasiado rápido. Aguarde um momento e tente novamente.");
      return;
    }
    const raw = Object.fromEntries(
      ["name", "email", "phone", "subject", "message", "vehicleId", "consent", "source"].map((k) => [k, String(fd.get(k) ?? "")]),
    );
    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = leadFieldErrors(parsed.error);
      setErrors(fieldErrors);
      setStatus("error");
      setMessage("Verifique os campos assinalados.");
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(fieldErrors)[0]}"]`)?.focus();
      return;
    }
    if ((parsed.data.message.match(/https?:\/\//gi) ?? []).length > 2) {
      setErrors({ message: "Remova as ligações da mensagem." });
      setStatus("error");
      setMessage("A mensagem contém demasiadas ligações.");
      return;
    }
    setErrors({});
    setStatus("sending");
    const d = parsed.data;
    const r = await insertLead({
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      vehicleId: d.vehicleId || null,
      subject: d.subject || null,
      message: d.message,
      source: d.source,
      referrer: document.referrer.slice(0, 500) || null,
    });
    if (r.ok) {
      setStatus("success");
    } else {
      setStatus("error");
      setMessage(r.message);
    }
  };

  if (status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-4 rounded-sm border border-ok/30 bg-ok/[0.05] p-8 focus:outline-none">
        <CheckCircle2 className="size-7 text-ok" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-lg font-semibold text-white">Mensagem enviada</p>
        <p className="text-sm text-soft/85">Obrigado pelo contacto — responderemos com a maior brevidade.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="source" value={source} />
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {status === "error" && message && <Notice tone="danger">{message}</Notice>}
      </div>

      <Input label="Nome" name="name" autoComplete="name" required error={errors.name} maxLength={120} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" error={errors.email} maxLength={254} />
        <Input label="Telefone" name="phone" type="tel" autoComplete="tel" inputMode="tel" error={errors.phone} maxLength={30} hint="Indique pelo menos um contacto." />
      </div>

      {vehicle ? (
        <>
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <div className="rounded-sm border border-line bg-white/[0.02] px-4 py-3 text-sm">
            <span className="eyebrow mr-2 !text-[0.6rem]">Viatura</span>
            <span className="text-white">{vehicle.label}</span>
          </div>
        </>
      ) : (
        vehicles &&
        vehicles.length > 0 && (
          <Select
            label="Viatura de interesse (opcional)"
            name="vehicleId"
            defaultValue=""
            options={vehicles.map((x) => ({ value: x.id, label: x.label }))}
            placeholder="Nenhuma em particular"
            error={errors.vehicleId}
          />
        )
      )}

      <Select label="Assunto" name="subject" defaultValue={LEAD_SUBJECTS[0]} options={LEAD_SUBJECTS.map((s) => ({ value: s, label: s }))} error={errors.subject} />
      <Textarea label="Mensagem" name="message" required rows={5} defaultValue={defaultMessage} error={errors.message} maxLength={5000} />

      <div>
        <Checkbox
          name="consent"
          required
          aria-invalid={errors.consent ? true : undefined}
          label={
            <>
              Autorizo o tratamento dos meus dados para resposta a este pedido
              {privacyPage && (
                <>
                  , nos termos da{" "}
                  <Link href="/privacidade" className="underline underline-offset-2" target="_blank">
                    Política de privacidade
                  </Link>
                </>
              )}
              .
            </>
          }
        />
        {errors.consent && (
          <p className="mt-1.5 text-xs text-danger" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={status === "sending"} icon={<Send className="size-4" />} className="w-full sm:w-auto">
        {status === "sending" ? "A enviar…" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
