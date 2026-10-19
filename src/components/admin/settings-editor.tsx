"use client";

import { RotateCcw, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/admin/actions/content";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_COLORS, TIMEZONES, type Settings } from "@/lib/site-schema";
import { AssetUpload } from "./asset-upload";
import { useUnsavedChanges } from "./use-unsaved";

const COLOR_LABELS: Record<keyof Settings["appearance"]["colors"], string> = {
  ink: "Preto principal",
  ink2: "Preto secundário",
  graphite: "Grafite",
  metal: "Cinzento metálico",
  soft: "Branco suave",
  white: "Branco",
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-line py-8 first:pt-0 lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-metal">{description}</p>}
      </div>
      <div className="max-w-3xl space-y-5">{children}</div>
    </section>
  );
}

export function SettingsEditor({ initial }: { initial: Settings }) {
  const toast = useToast();
  const [s, setS] = useState<Settings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(s) !== saved;
  useUnsavedChanges(dirty);
  const err = (k: string) => errors[k] || undefined;

  const setIn = <K extends keyof Settings>(key: K, patch: Partial<Settings[K]>) =>
    setS((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } as Settings[K] }));

  const save = () =>
    start(async () => {
      const r = await saveSettings(s);
      if (r.ok) {
        setErrors({});
        setSaved(JSON.stringify(s));
        toast(r.message ?? "Guardado.");
      } else {
        setErrors(r.fieldErrors ?? {});
        toast(r.message, "error");
      }
    });

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-8 flex items-center justify-between gap-4 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <p className="text-sm text-metal">{dirty ? <span className="text-warn">● Alterações por guardar</span> : "Todas as alterações estão guardadas."}</p>
        <Button onClick={save} loading={pending} disabled={!dirty} icon={<Save className="size-4" />}>
          Guardar definições
        </Button>
      </div>

      {Object.values(errors).some(Boolean) && (
        <Notice tone="danger" className="mb-6" title="Existem campos por corrigir">
          {Object.values(errors).filter(Boolean).slice(0, 3).join(" ")}
        </Notice>
      )}

      <Section title="Marca" description="Nome, logótipo e favicon. Sem logótipo carregado, é usado o logótipo textual.">
        <Input label="Nome da marca" value={s.brandName} onChange={(e) => setS({ ...s, brandName: e.target.value })} maxLength={60} error={err("brandName")} />
        <Input label="Slogan (opcional)" value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} maxLength={140} error={err("tagline")} />
        <div className="rounded-sm border border-line bg-ink p-6">
          <p className="mb-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-metal">Pré-visualização</p>
          <Logo brandName={s.brandName || "CREW CAR"} logo={s.logo} size="lg" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <AssetUpload kind="logo" label="Logótipo (ficheiro)" value={s.logo} onChange={(logo) => setS({ ...s, logo })} hint="PNG ou WebP com fundo transparente, versão clara." />
          <AssetUpload kind="favicon" label="Favicon" value={s.favicon} onChange={(favicon) => setS({ ...s, favicon })} hint="Imagem quadrada (mín. 180 × 180 px)." />
        </div>
      </Section>

      <Section title="Aparência" description="Paleta e tipografia. Os valores por omissão correspondem à identidade CREW CAR.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(COLOR_LABELS) as (keyof typeof COLOR_LABELS)[]).map((k) => (
            <div key={k} className="flex items-center gap-3 rounded-sm border border-line p-3">
              <input
                type="color"
                value={s.appearance.colors[k]}
                onChange={(e) => setIn("appearance", { colors: { ...s.appearance.colors, [k]: e.target.value.toUpperCase() } })}
                className="size-9 cursor-pointer rounded-sm border border-line bg-transparent"
                aria-label={COLOR_LABELS[k]}
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{COLOR_LABELS[k]}</p>
                <p className="font-mono text-xs text-metal">{s.appearance.colors[k]}</p>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setIn("appearance", { colors: { ...DEFAULT_COLORS } })}>
          Repor paleta original
        </Button>
        <Select
          label="Tipografia"
          value={s.appearance.font}
          onChange={(e) => setIn("appearance", { font: e.target.value as Settings["appearance"]["font"] })}
          options={{ inter: "Inter", manrope: "Manrope" }}
        />
      </Section>

      <Section title="Contactos" description="Apenas os dados preenchidos são apresentados no website.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone" type="tel" value={s.contact.phone} onChange={(e) => setIn("contact", { phone: e.target.value })} error={err("contact.phone")} placeholder="+351 …" />
          <Input
            label="Nota do telefone"
            value={s.contact.phoneNote}
            onChange={(e) => setIn("contact", { phoneNote: e.target.value })}
            maxLength={120}
            hint="Ex.: Chamada para a rede fixa nacional"
          />
          <Input label="E-mail" type="email" value={s.contact.email} onChange={(e) => setIn("contact", { email: e.target.value })} error={err("contact.email")} />
          <Input label="WhatsApp" type="tel" value={s.contact.whatsapp} onChange={(e) => setIn("contact", { whatsapp: e.target.value })} error={err("contact.whatsapp")} placeholder="+351 9…" />
        </div>
        <Input label="Morada" value={s.contact.address.street} onChange={(e) => setIn("contact", { address: { ...s.contact.address, street: e.target.value } })} maxLength={160} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Código postal"
            value={s.contact.address.postalCode}
            onChange={(e) => setIn("contact", { address: { ...s.contact.address, postalCode: e.target.value } })}
            error={err("contact.address.postalCode")}
            placeholder="0000-000"
          />
          <Input label="Localidade" value={s.contact.address.city} onChange={(e) => setIn("contact", { address: { ...s.contact.address, city: e.target.value } })} maxLength={80} />
          <Input label="País" value={s.contact.address.country} onChange={(e) => setIn("contact", { address: { ...s.contact.address, country: e.target.value } })} maxLength={60} />
        </div>
        <Input label="Ligação para o mapa" type="url" value={s.contact.mapUrl} onChange={(e) => setIn("contact", { mapUrl: e.target.value })} error={err("contact.mapUrl")} placeholder="https://maps.google.com/…" />
        <Textarea label="Horário" value={s.contact.openingHours} onChange={(e) => setIn("contact", { openingHours: e.target.value })} rows={3} maxLength={500} placeholder={"Segunda a sexta: 9h00–19h00\nSábado: 10h00–13h00"} />
      </Section>

      <Section title="Redes sociais">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["facebook", "instagram", "youtube", "tiktok", "linkedin"] as const).map((k) => (
            <Input
              key={k}
              label={k === "tiktok" ? "TikTok" : k === "youtube" ? "YouTube" : k === "linkedin" ? "LinkedIn" : k[0].toUpperCase() + k.slice(1)}
              type="url"
              value={s.social[k]}
              onChange={(e) => setIn("social", { [k]: e.target.value })}
              error={err(`social.${k}`)}
              placeholder="https://"
            />
          ))}
        </div>
      </Section>

      <Section title="Informação legal" description="Identificação da empresa apresentada no rodapé. Preencha apenas com dados oficiais.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Denominação social" value={s.company.legalName} onChange={(e) => setIn("company", { legalName: e.target.value })} maxLength={160} />
          <Input label="NIF" value={s.company.nif} onChange={(e) => setIn("company", { nif: e.target.value })} error={err("company.nif")} maxLength={20} />
          <Input label="Sede" value={s.company.registeredOffice} onChange={(e) => setIn("company", { registeredOffice: e.target.value })} maxLength={250} wrapperClassName="sm:col-span-2" />
          <Input label="Licença / registo de atividade" value={s.company.licence} onChange={(e) => setIn("company", { licence: e.target.value })} maxLength={120} wrapperClassName="sm:col-span-2" />
        </div>
        <Switch checked={s.company.complaintsBook} onChange={(v) => setIn("company", { complaintsBook: v })} label="Ligação para o Livro de Reclamações Eletrónico" description="Mostra a ligação para www.livroreclamacoes.pt no rodapé." />
      </Section>

      <Section title="Regionalização" description="Moeda, idioma, fuso horário e formato de data usados no website e no back office.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Moeda" value={s.regional.currency} onChange={() => {}} options={{ EUR: "Euro (EUR, €)" }} />
          <Select label="Idioma" value={s.regional.language} onChange={() => {}} options={{ "pt-PT": "Português (Portugal)" }} />
          <Select label="Fuso horário" value={s.regional.timezone} onChange={(e) => setIn("regional", { timezone: e.target.value as Settings["regional"]["timezone"] })} options={TIMEZONES} />
          <Select label="Formato de data" value={s.regional.dateFormat} onChange={() => {}} options={{ "DD/MM/AAAA": "DD/MM/AAAA" }} />
        </div>
      </Section>

      <Section title="Cookies e análise" description="As ferramentas de análise só são carregadas depois de o visitante aceitar cookies.">
        <Switch checked={s.cookies.bannerEnabled} onChange={(v) => setIn("cookies", { bannerEnabled: v })} label="Mostrar aviso de consentimento de cookies" />
        <Textarea label="Texto do aviso" value={s.cookies.message} onChange={(e) => setIn("cookies", { message: e.target.value })} maxLength={400} rows={3} error={err("cookies.message")} />
        <Select
          label="Ferramenta de análise"
          value={s.analytics.provider}
          onChange={(e) => setIn("analytics", { provider: e.target.value as Settings["analytics"]["provider"] })}
          options={{ none: "Nenhuma", plausible: "Plausible Analytics", ga4: "Google Analytics 4" }}
        />
        {s.analytics.provider === "plausible" && (
          <Input label="Domínio no Plausible" value={s.analytics.plausibleDomain} onChange={(e) => setIn("analytics", { plausibleDomain: e.target.value })} error={err("analytics.plausibleDomain")} placeholder="crewcar.pt" />
        )}
        {s.analytics.provider === "ga4" && (
          <Input label="ID de medição GA4" value={s.analytics.ga4Id} onChange={(e) => setIn("analytics", { ga4Id: e.target.value.toUpperCase() })} error={err("analytics.ga4Id")} placeholder="G-XXXXXXXXXX" />
        )}
        {s.analytics.provider !== "none" && !s.cookies.bannerEnabled && (
          <Notice tone="warn">Com o aviso de cookies desativado, a ferramenta de análise é carregada sem consentimento prévio. Confirme que isso é permitido no seu caso.</Notice>
        )}
      </Section>

      <Section title="Publicação" description="Comportamento do catálogo e das páginas das viaturas.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Viaturas por página"
            type="number"
            min={6}
            max={48}
            value={s.publishing.perPage}
            onChange={(e) => setIn("publishing", { perPage: Number(e.target.value) })}
            error={err("publishing.perPage")}
          />
          <Input
            label="Viaturas semelhantes a sugerir"
            type="number"
            min={0}
            max={8}
            value={s.publishing.similarCount}
            onChange={(e) => setIn("publishing", { similarCount: Number(e.target.value) })}
            error={err("publishing.similarCount")}
          />
        </div>
        <Input label="Mensagem inicial do WhatsApp" value={s.publishing.whatsappMessage} onChange={(e) => setIn("publishing", { whatsappMessage: e.target.value })} maxLength={300} />
        <div className="space-y-4 rounded-sm border border-line p-5">
          <Switch checked={s.publishing.showReserved} onChange={(v) => setIn("publishing", { showReserved: v })} label="Mostrar viaturas reservadas no catálogo" description="Aparecem com a indicação “Reservado”." />
          <Switch
            checked={s.publishing.keepSoldPages}
            onChange={(v) => setIn("publishing", { keepSoldPages: v })}
            label="Manter acessível a página de viaturas vendidas"
            description="As ligações partilhadas mostram “Vendido” em vez de erro. As vendidas nunca aparecem no catálogo."
          />
          <Switch
            checked={s.publishing.allowIndexing}
            onChange={(v) => setIn("publishing", { allowIndexing: v })}
            label="Permitir indexação pelos motores de pesquisa"
            description="Desative enquanto o site estiver em preparação."
          />
        </div>
      </Section>
    </div>
  );
}
