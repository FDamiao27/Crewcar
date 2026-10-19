"use client";

import { ExternalLink, Lock, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createVehicle, updateVehicle } from "@/app/admin/actions/vehicles";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { ActionMenu } from "@/components/ui/menu";
import { Badge, Notice } from "@/components/ui/misc";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { CATEGORIES, CONDITIONS, FUELS, LINK_KINDS, TRANSMISSIONS, VEHICLE_STATUSES, type LinkKind } from "@/lib/constants";
import { formatDateTime, formatPercent, formatPrice, parseEurosToCents } from "@/lib/format";
import type { Pricing } from "@/lib/pricing";
import { buildVehicleSlug, type VehicleFormState } from "@/lib/vehicle-schema";
import { ListEditor } from "./list-editor";
import { PhotoManager, type ManagedPhoto } from "./photo-manager";
import { PricingPanel, type PanelHistory, type PanelPromotion } from "./pricing-panel";
import { PublicationBadge, VehicleStatusBadge } from "./ui";
import { useUnsavedChanges } from "./use-unsaved";
import { useVehicleActions } from "./vehicle-actions";

type TabId = "dados" | "preco" | "descricao" | "fotografias" | "ligacoes" | "publicacao";

const FIELD_TABS: Record<string, TabId> = {
  brand: "dados", model: "dados", version: "dados", category: "dados", reference: "dados", registrationYear: "dados",
  firstRegistrationDate: "dados", mileageKm: "dados", fuel: "dados", transmission: "dados", engineCc: "dados", powerHp: "dados",
  exteriorColor: "dados", interiorColor: "dados", doors: "dados", seats: "dados", condition: "dados", vin: "dados",
  price: "preco", purchasePrice: "preco",
  shortDescription: "descricao", description: "descricao", equipment: "descricao", extras: "descricao", warrantyInfo: "descricao",
  commercialInfo: "descricao", internalNotes: "descricao",
  videoUrl: "ligacoes", links: "ligacoes",
  status: "publicacao", isPublished: "publicacao", isFeatured: "publicacao", seoTitle: "publicacao", seoDescription: "publicacao", slug: "publicacao",
};

export type EditorVehicle = {
  id: string;
  slug: string;
  reference: string;
  status: keyof typeof VEHICLE_STATUSES;
  isPublished: boolean;
  isFeatured: boolean;
  isDemo: boolean;
  archived: boolean;
  priceCents: number | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  soldAt: Date | null;
  createdByName: string | null;
  updatedByName: string | null;
  leadCount: number;
};

export function VehicleEditor({
  vehicle,
  initial,
  photos = [],
  promotions = [],
  history = [],
  pricing,
  seeCosts,
  canDelete,
  timeZone,
  initialTab,
}: {
  vehicle?: EditorVehicle;
  initial: VehicleFormState;
  photos?: ManagedPhoto[];
  promotions?: PanelPromotion[];
  history?: PanelHistory[];
  pricing?: Pricing;
  seeCosts: boolean;
  canDelete: boolean;
  timeZone: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<VehicleFormState>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabId>((["dados", "preco", "descricao", "fotografias", "ligacoes", "publicacao"] as TabId[]).includes(initialTab as TabId) ? (initialTab as TabId) : "dados");
  const [saving, start] = useTransition();
  const slugTouched = useRef(Boolean(initial.slug));
  const dirty = JSON.stringify(form) !== baseline;
  useUnsavedChanges(dirty);

  // Quando o servidor devolve dados novos (ex.: após ação rápida), sincronizar se não houver edição pendente
  useEffect(() => {
    if (!dirty) {
      setForm(initial);
      setBaseline(JSON.stringify(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const set = <K extends keyof VehicleFormState>(key: K, value: VehicleFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const tabErrors = useMemo(() => {
    const out = new Set<TabId>();
    for (const [k, v] of Object.entries(errors)) if (v) out.add(FIELD_TABS[k.split(".")[0]] ?? "dados");
    return out;
  }, [errors]);

  const save = (overrides?: Partial<VehicleFormState>) => {
    const payload = { ...form, ...overrides };
    if (!vehicle && !slugTouched.current) payload.slug = "";
    start(async () => {
      if (!vehicle) {
        const r = await createVehicle(payload);
        if (r.ok && r.data) {
          setBaseline(JSON.stringify(payload));
          setForm(payload);
          toast("Viatura criada. Pode agora carregar as fotografias.");
          router.replace(`/admin/viaturas/${r.data.id}?tab=fotografias`);
        } else if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast(r.message, "error");
          const first = Object.keys(r.fieldErrors ?? {})[0];
          if (first) setTab(FIELD_TABS[first.split(".")[0]] ?? "dados");
        }
        return;
      }
      const r = await updateVehicle(vehicle.id, payload);
      if (r.ok) {
        const next = { ...payload, slug: r.data?.slug ?? payload.slug };
        setForm(next);
        setBaseline(JSON.stringify(next));
        setErrors({});
        toast(r.message ?? "Guardado.");
      } else {
        setErrors(r.fieldErrors ?? {});
        toast(r.message, "error");
        const first = Object.keys(r.fieldErrors ?? {})[0];
        if (first) setTab(FIELD_TABS[first.split(".")[0]] ?? "dados");
      }
    });
  };

  const actions = useVehicleActions(
    {
      id: vehicle?.id ?? "",
      slug: vehicle?.slug ?? "",
      reference: vehicle?.reference ?? "",
      title: `${form.brand} ${form.model}`,
      status: vehicle?.status ?? "disponivel",
      isPublished: vehicle?.isPublished ?? false,
      isFeatured: vehicle?.isFeatured ?? false,
      archived: vehicle?.archived ?? false,
    },
    { canDelete, showEdit: false, onDeleted: () => router.replace("/admin/viaturas") },
  );

  const priceCents = parseEurosToCents(form.price);
  const purchaseCents = parseEurosToCents(form.purchasePrice);
  const finalForMargin = pricing && vehicle && priceCents === vehicle.priceCents ? pricing.finalPriceCents : priceCents;
  const margin = seeCosts && finalForMargin && purchaseCents ? finalForMargin - purchaseCents : null;

  const err = (k: string) => errors[k] || undefined;
  const title = [form.brand, form.model].filter(Boolean).join(" ") || "Nova viatura";
  const autoSlug = buildVehicleSlug({
    brand: form.brand,
    model: form.model,
    version: form.version,
    registrationYear: Number(form.registrationYear) || null,
  });

  return (
    <div>
      {/* Barra de topo */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-line bg-ink/90 px-4 py-4 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <a href="/admin/viaturas" className="text-xs text-metal hover:text-white">
              ← Viaturas
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h1>
              {vehicle && (
                <>
                  <VehicleStatusBadge status={vehicle.status} />
                  <PublicationBadge published={vehicle.isPublished} archived={vehicle.archived} />
                  {vehicle.isFeatured && <Badge tone="warn">Destaque</Badge>}
                  {vehicle.isDemo && <Badge tone="warn">Demonstração</Badge>}
                </>
              )}
              {dirty && (
                <span className="text-xs text-warn" role="status">
                  ● Alterações por guardar
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vehicle && (
              <a
                href={`/viaturas/${vehicle.slug}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("secondary", "md")}
                onClick={(e) => {
                  if (dirty && !window.confirm("A pré-visualização mostra a versão guardada. Abrir mesmo assim?")) e.preventDefault();
                }}
              >
                <ExternalLink className="size-4" /> Pré-visualizar
              </a>
            )}
            <Button onClick={() => save()} loading={saving} disabled={vehicle ? !dirty : false} icon={<Save className="size-4" />}>
              {vehicle ? "Guardar" : "Criar viatura"}
            </Button>
            {vehicle && <ActionMenu items={actions.items} label="Mais ações" />}
          </div>
        </div>
      </div>
      {actions.dialogs}

      {Object.values(errors).some(Boolean) && (
        <Notice tone="danger" className="mb-6" title="Existem campos por corrigir">
          Os separadores com erros estão assinalados com um ponto vermelho.
        </Notice>
      )}

      <Tabs<TabId>
        label="Secções da viatura"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "dados", label: "Dados da viatura", error: tabErrors.has("dados") },
          { id: "preco", label: "Preços", error: tabErrors.has("preco") },
          { id: "descricao", label: "Descrição e equipamento", error: tabErrors.has("descricao") },
          { id: "fotografias", label: `Fotografias${vehicle ? ` (${photos.length})` : ""}` },
          { id: "ligacoes", label: "Ligações", error: tabErrors.has("ligacoes") },
          { id: "publicacao", label: "Publicação", error: tabErrors.has("publicacao") },
        ]}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        <TabPanel id="dados" active={tab === "dados"}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Marca" required value={form.brand} onChange={(e) => set("brand", e.target.value)} error={err("brand")} maxLength={60} autoComplete="off" />
            <Input label="Modelo" required value={form.model} onChange={(e) => set("model", e.target.value)} error={err("model")} maxLength={80} autoComplete="off" />
            <Input label="Versão" value={form.version} onChange={(e) => set("version", e.target.value)} error={err("version")} maxLength={120} />
            <Select label="Categoria" value={form.category} onChange={(e) => set("category", e.target.value)} options={CATEGORIES} placeholder="—" error={err("category")} />
            <Input label="Referência de stock" required value={form.reference} onChange={(e) => set("reference", e.target.value)} error={err("reference")} maxLength={40} hint="Única. Ex.: CC-0123" />
            <Select label="Estado da viatura" value={form.condition} onChange={(e) => set("condition", e.target.value)} options={CONDITIONS} placeholder="—" error={err("condition")} />
            <Input label="Ano de matrícula" inputMode="numeric" value={form.registrationYear} onChange={(e) => set("registrationYear", e.target.value)} error={err("registrationYear")} maxLength={4} />
            <Input label="Data da primeira matrícula" type="date" value={form.firstRegistrationDate} onChange={(e) => set("firstRegistrationDate", e.target.value)} error={err("firstRegistrationDate")} />
            <Input label="Quilometragem (km)" inputMode="numeric" value={form.mileageKm} onChange={(e) => set("mileageKm", e.target.value)} error={err("mileageKm")} />
            <Select label="Combustível" value={form.fuel} onChange={(e) => set("fuel", e.target.value)} options={FUELS} placeholder="—" error={err("fuel")} />
            <Select label="Caixa de velocidades" value={form.transmission} onChange={(e) => set("transmission", e.target.value)} options={TRANSMISSIONS} placeholder="—" error={err("transmission")} />
            <Input label="Cilindrada (cm³)" inputMode="numeric" value={form.engineCc} onChange={(e) => set("engineCc", e.target.value)} error={err("engineCc")} />
            <Input label="Potência (cv)" inputMode="numeric" value={form.powerHp} onChange={(e) => set("powerHp", e.target.value)} error={err("powerHp")} />
            <Input label="Cor exterior" value={form.exteriorColor} onChange={(e) => set("exteriorColor", e.target.value)} error={err("exteriorColor")} maxLength={60} />
            <Input label="Cor interior" value={form.interiorColor} onChange={(e) => set("interiorColor", e.target.value)} error={err("interiorColor")} maxLength={60} />
            <Input label="Número de portas" inputMode="numeric" value={form.doors} onChange={(e) => set("doors", e.target.value)} error={err("doors")} maxLength={1} />
            <Input label="Número de lugares" inputMode="numeric" value={form.seats} onChange={(e) => set("seats", e.target.value)} error={err("seats")} maxLength={2} />
            <Input
              label={
                <span className="inline-flex items-center gap-1.5">
                  VIN <Lock className="size-3" aria-label="privado" />
                </span>
              }
              value={form.vin}
              onChange={(e) => set("vin", e.target.value.toUpperCase())}
              error={err("vin")}
              maxLength={17}
              hint="Opcional e privado — nunca é mostrado no showroom."
              className="font-mono uppercase"
            />
          </div>
          <p className="mt-6 text-xs text-metal">Os campos opcionais só aparecem no showroom quando preenchidos. Não preencha dados que não tenha confirmado.</p>
        </TabPanel>

        <TabPanel id="preco" active={tab === "preco"}>
          <div className="grid gap-5 md:grid-cols-3">
            <Input
              label="Preço de venda (€)"
              required
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              error={err("price")}
              hint={priceCents ? formatPrice(priceCents) : "Preço base, sem descontos. Ex.: 21900"}
            />
            {seeCosts ? (
              <Input
                label={
                  <span className="inline-flex items-center gap-1.5">
                    Preço de aquisição (€) <Lock className="size-3" aria-label="privado" />
                  </span>
                }
                inputMode="decimal"
                value={form.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
                error={err("purchasePrice")}
                hint="Privado — nunca é mostrado no showroom."
              />
            ) : (
              <div />
            )}
            {seeCosts && (
              <div className="rounded-sm border border-line px-4 py-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-metal">Margem estimada</p>
                <p className={cn("mt-1 text-lg font-semibold tabular", margin !== null && margin < 0 ? "text-danger" : "text-white")}>
                  {margin !== null ? formatPrice(margin) : "—"}
                </p>
                {margin !== null && finalForMargin ? <p className="text-xs text-metal">{formatPercent((margin / finalForMargin) * 100)} sobre o preço atual</p> : null}
              </div>
            )}
          </div>
          {vehicle && priceCents !== vehicle.priceCents && (
            <Notice tone="warn" className="mt-5">
              O novo preço de venda só fica em vigor depois de guardar. As promoções são calculadas sobre o preço guardado.
            </Notice>
          )}
          <div className="mt-8 border-t border-line pt-8">
            {vehicle && pricing ? (
              <PricingPanel
                vehicleId={vehicle.id}
                basePriceCents={vehicle.priceCents}
                pricing={pricing}
                promotions={promotions}
                history={history}
                timeZone={timeZone}
                disabled={vehicle.status === "vendido"}
                disabledReason="Não é possível criar promoções para viaturas vendidas."
              />
            ) : (
              <Notice>Depois de criar a viatura poderá definir descontos, agendar promoções e consultar o histórico de preços.</Notice>
            )}
          </div>
        </TabPanel>

        <TabPanel id="descricao" active={tab === "descricao"}>
          <div className="grid gap-8 xl:grid-cols-2">
            <div className="space-y-5">
              <Textarea
                label="Descrição curta"
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                error={err("shortDescription")}
                maxLength={300}
                rows={3}
                hint={`${form.shortDescription.length}/300 — aparece no topo do anúncio e nas partilhas.`}
              />
              <Textarea
                label="Descrição completa"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                error={err("description")}
                maxLength={20000}
                rows={10}
              />
              <Textarea
                label="Informação sobre garantia"
                value={form.warrantyInfo}
                onChange={(e) => set("warrantyInfo", e.target.value)}
                error={err("warrantyInfo")}
                maxLength={2000}
                rows={3}
              />
              <Checkbox
                label="Informação de garantia verificada"
                description="A garantia só é mostrada no showroom quando esta opção estiver ativa."
                checked={form.warrantyVerified}
                onChange={(e) => set("warrantyVerified", e.target.checked)}
              />
              <Textarea
                label="Informação comercial adicional"
                value={form.commercialInfo}
                onChange={(e) => set("commercialInfo", e.target.value)}
                error={err("commercialInfo")}
                maxLength={2000}
                rows={3}
              />
              <Textarea
                label={
                  <span className="inline-flex items-center gap-1.5">
                    Notas internas <Lock className="size-3" aria-label="privado" />
                  </span>
                }
                value={form.internalNotes}
                onChange={(e) => set("internalNotes", e.target.value)}
                error={err("internalNotes")}
                maxLength={10000}
                rows={4}
                hint="Privadas — nunca aparecem no website."
                className="border-dashed"
              />
            </div>
            <div className="space-y-8">
              <ListEditor id="equipamento" label="Equipamento" items={form.equipment} onChange={(v) => set("equipment", v)} placeholder="Ex.: Ar condicionado automático" />
              <ListEditor id="extras" label="Extras" items={form.extras} onChange={(v) => set("extras", v)} placeholder="Ex.: Teto panorâmico" />
            </div>
          </div>
        </TabPanel>

        <TabPanel id="fotografias" active={tab === "fotografias"}>
          {vehicle ? (
            <PhotoManager vehicleId={vehicle.id} photos={photos} title={title} />
          ) : (
            <Notice>Crie primeiro a viatura (botão “Criar viatura”). Depois poderá carregar e organizar as fotografias.</Notice>
          )}
        </TabPanel>

        <TabPanel id="ligacoes" active={tab === "ligacoes"}>
          <div className="max-w-3xl space-y-8">
            <Input
              label="Ligação de vídeo"
              type="url"
              value={form.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
              error={err("videoUrl")}
              placeholder="https://www.youtube.com/watch?v=…"
              hint="Mostrada no anúncio como botão “Ver vídeo”."
            />
            <LinksEditor links={form.links} onChange={(v) => set("links", v)} errors={errors} />
          </div>
        </TabPanel>

        <TabPanel id="publicacao" active={tab === "publicacao"}>
          <div className="grid gap-8 xl:grid-cols-2">
            <div className="space-y-6">
              <Select
                label="Estado comercial"
                value={form.status}
                onChange={(e) => set("status", e.target.value as VehicleFormState["status"])}
                options={VEHICLE_STATUSES}
                error={err("status")}
                hint="Viaturas vendidas deixam de aparecer no catálogo, mas mantêm o registo."
              />
              <div className="space-y-5 rounded-sm border border-line p-5">
                <Switch
                  checked={form.isPublished}
                  onChange={(v) => set("isPublished", v)}
                  label="Visível no showroom"
                  description={vehicle?.archived ? "Restaure a viatura para a poder publicar." : "Quando desativado, a viatura fica em rascunho e só é visível no back office."}
                  disabled={vehicle?.archived}
                />
                <Switch checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} label="Destaque na página inicial" description="Aparece na secção “Em destaque”." />
              </div>
              {err("price") && form.isPublished && <Notice tone="danger">{err("price")}</Notice>}
              {vehicle && (
                <dl className="grid grid-cols-2 gap-4 rounded-sm border border-line p-5 text-sm">
                  <Meta k="Criada em" v={`${formatDateTime(vehicle.createdAt, timeZone)}${vehicle.createdByName ? ` · ${vehicle.createdByName}` : ""}`} />
                  <Meta k="Última alteração" v={`${formatDateTime(vehicle.updatedAt, timeZone)}${vehicle.updatedByName ? ` · ${vehicle.updatedByName}` : ""}`} />
                  <Meta k="Publicada pela 1.ª vez" v={vehicle.publishedAt ? formatDateTime(vehicle.publishedAt, timeZone) : "—"} />
                  <Meta k="Pedidos de contacto" v={String(vehicle.leadCount)} />
                  {vehicle.soldAt && <Meta k="Vendida em" v={formatDateTime(vehicle.soldAt, timeZone)} />}
                </dl>
              )}
            </div>
            <div className="space-y-5">
              <Input
                label="Endereço personalizado"
                value={form.slug}
                onChange={(e) => {
                  slugTouched.current = true;
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
                error={err("slug")}
                placeholder={autoSlug}
                hint={`/viaturas/${form.slug || autoSlug}`}
                maxLength={140}
              />
              <Input
                label="Título para SEO"
                value={form.seoTitle}
                onChange={(e) => set("seoTitle", e.target.value)}
                error={err("seoTitle")}
                maxLength={120}
                placeholder={`${form.brand} ${form.model} ${form.version}`.trim()}
                hint={`${form.seoTitle.length}/60 recomendados`}
              />
              <Textarea
                label="Descrição para SEO"
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                error={err("seoDescription")}
                maxLength={300}
                rows={3}
                placeholder={form.shortDescription || "Gerada automaticamente a partir das características."}
                hint={`${form.seoDescription.length}/160 recomendados`}
              />
              <div className="rounded-sm border border-line bg-white/[0.02] p-4">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-metal">Pré-visualização nos motores de pesquisa</p>
                <p className="mt-3 truncate text-xs text-ok/80">…/viaturas/{form.slug || autoSlug}</p>
                <p className="truncate text-base text-[#8ab4f8]">{form.seoTitle || `${form.brand} ${form.model} ${form.version}`.trim() || "Título da viatura"}</p>
                <p className="line-clamp-2 text-xs text-metal">{form.seoDescription || form.shortDescription || "Descrição gerada automaticamente com ano, quilometragem, combustível e preço."}</p>
              </div>
            </div>
          </div>
        </TabPanel>
      </form>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-metal">{k}</dt>
      <dd className="mt-0.5 text-soft">{v}</dd>
    </div>
  );
}

function LinksEditor({
  links,
  onChange,
  errors,
}: {
  links: VehicleFormState["links"];
  onChange: (l: VehicleFormState["links"]) => void;
  errors: Record<string, string>;
}) {
  const update = (i: number, patch: Partial<VehicleFormState["links"][number]>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">Ligações externas</p>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          icon={<Plus className="size-3.5" />}
          onClick={() => onChange([...links, { kind: "portal", label: "", url: "", isPublic: false }])}
          disabled={links.length >= 20}
        >
          Adicionar ligação
        </Button>
      </div>
      {links.length === 0 ? (
        <p className="mt-3 text-sm text-metal">Anúncio num portal automóvel, relatório de histórico ou outras ligações. Por omissão, as ligações são privadas.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {links.map((l, i) => (
            <li key={i} className="rounded-sm border border-line p-4">
              <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
                <Select
                  label="Tipo"
                  value={l.kind}
                  onChange={(e) => update(i, { kind: e.target.value as LinkKind })}
                  options={LINK_KINDS}
                />
                <Input label="Texto do botão (opcional)" value={l.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={120} placeholder={LINK_KINDS[l.kind]} />
                <Input
                  label="Endereço"
                  type="url"
                  value={l.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  error={errors[`links.${i}.url`]}
                  placeholder="https://"
                  wrapperClassName="md:col-span-2"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Checkbox label="Visível publicamente no anúncio" checked={l.isPublic} onChange={(e) => update(i, { isPublic: e.target.checked })} />
                <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} className="inline-flex items-center gap-1.5 text-xs text-metal hover:text-danger">
                  <Trash2 className="size-3.5" /> Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
