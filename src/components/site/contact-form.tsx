"use client";

import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { submitLead, type LeadFormState } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { LEAD_SUBJECTS } from "@/lib/constants";

export function ContactForm({
  token,
  vehicle,
  vehicles,
  source,
  privacyPage,
  defaultMessage,
}: {
  token: string;
  vehicle?: { id: string; label: string };
  vehicles?: { id: string; label: string }[];
  source: "pagina_contactos" | "pagina_viatura" | "pagina_inicial";
  privacyPage: boolean;
  defaultMessage?: string;
}) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(submitLead, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const referrerRef = useRef<HTMLInputElement>(null);
  const v = state.values ?? {};
  const e = state.errors ?? {};

  useEffect(() => {
    if (referrerRef.current) referrerRef.current.value = document.referrer.slice(0, 500);
  });

  useEffect(() => {
    if (state.status !== "idle") statusRef.current?.focus();
    if (state.status === "error" && state.errors) {
      const first = Object.keys(state.errors)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-4 rounded-sm border border-ok/30 bg-ok/[0.05] p-8 focus:outline-none">
        <CheckCircle2 className="size-7 text-ok" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-lg font-semibold text-white">Mensagem enviada</p>
        <p className="text-sm text-soft/85">{state.message}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5" aria-describedby="form-estado">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="referrer" ref={referrerRef} defaultValue="" />
      {/* Campo isco anti-spam: invisível para pessoas */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div id="form-estado" ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {state.status === "error" && state.message && <Notice tone="danger">{state.message}</Notice>}
      </div>

      <Input label="Nome" name="name" autoComplete="name" required defaultValue={v.name} error={e.name} maxLength={120} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={v.email} error={e.email} maxLength={254} />
        <Input label="Telefone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={v.phone} error={e.phone} maxLength={30} hint="Indique pelo menos um contacto." />
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
            defaultValue={v.vehicleId ?? ""}
            options={vehicles.map((x) => ({ value: x.id, label: x.label }))}
            placeholder="Nenhuma em particular"
            error={e.vehicleId}
          />
        )
      )}

      <Select
        label="Assunto"
        name="subject"
        defaultValue={v.subject ?? LEAD_SUBJECTS[0]}
        options={LEAD_SUBJECTS.map((s) => ({ value: s, label: s }))}
        error={e.subject}
      />
      <Textarea
        label="Mensagem"
        name="message"
        required
        rows={5}
        defaultValue={v.message ?? defaultMessage}
        error={e.message}
        maxLength={5000}
      />

      <div>
        <Checkbox
          name="consent"
          required
          defaultChecked={v.consent === "on"}
          aria-invalid={e.consent ? true : undefined}
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
        {e.consent && (
          <p className="mt-1.5 text-xs text-danger" role="alert">
            {e.consent}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={pending} icon={<Send className="size-4" />} className="w-full sm:w-auto">
        {pending ? "A enviar…" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
