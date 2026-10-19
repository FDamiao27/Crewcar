"use client";

import { CalendarClock, Info, Plus, XCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createPromotion, endPromotion } from "@/app/admin/actions/vehicles";
import { PriceBlock } from "@/components/site/price-block";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { Badge, Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { DISCOUNT_TYPES, type DiscountType } from "@/lib/constants";
import { formatDateTime, formatPercent, formatPrice, parseEurosToCents } from "@/lib/format";
import { describePromotion, previewPromotion, type Pricing, type PromotionLike } from "@/lib/pricing";

export type PanelPromotion = PromotionLike & { id: string; createdByName?: string | null };
export type PanelHistory = { id: string; priceCents: number; previousPriceCents: number | null; createdAt: Date; changedByName: string | null };

function promoState(p: PanelPromotion, now: number): { label: string; tone: "light" | "outline" | "neutral" } {
  if (p.cancelledAt) return { label: "Cancelada", tone: "neutral" };
  const s = new Date(p.startsAt).getTime();
  const e = p.endsAt ? new Date(p.endsAt).getTime() : Infinity;
  if (s > now) return { label: "Agendada", tone: "outline" };
  if (e <= now) return { label: "Terminada", tone: "neutral" };
  return { label: "Ativa", tone: "light" };
}

export function PricingPanel({
  vehicleId,
  basePriceCents,
  pricing,
  promotions,
  history,
  timeZone,
  disabled,
  disabledReason,
}: {
  vehicleId: string;
  basePriceCents: number | null;
  pricing: Pricing;
  promotions: PanelPromotion[];
  history: PanelHistory[];
  timeZone: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [type, setType] = useState<DiscountType>("percentagem");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toEnd, setToEnd] = useState<PanelPromotion | null>(null);
  const now = Date.now();

  const preview = useMemo(() => {
    if (!basePriceCents) return null;
    let promo: PromotionLike | null = null;
    if (type === "percentagem") {
      const pct = Number(value.replace(",", ".").replace("%", ""));
      if (pct > 0 && pct <= 90) promo = { discountType: type, percentBp: Math.round(pct * 100), amountCents: null, startsAt: new Date(), endsAt: null };
    } else {
      const cents = parseEurosToCents(value);
      if (cents && cents > 0 && cents < basePriceCents) promo = { discountType: type, amountCents: cents, percentBp: null, startsAt: new Date(), endsAt: null };
    }
    return promo ? previewPromotion(basePriceCents, promo) : null;
  }, [type, value, basePriceCents]);

  const submit = () =>
    start(async () => {
      const r = await createPromotion(vehicleId, { discountType: type, value, label, startsAt, endsAt });
      if (r.ok) {
        toast(r.message ?? "Promoção criada.");
        setValue("");
        setLabel("");
        setStartsAt("");
        setEndsAt("");
        setErrors({});
      } else {
        setErrors(r.fieldErrors ?? {});
        toast(r.message, "error");
      }
    });

  const hasOpen = promotions.some((p) => {
    const st = promoState(p, now).label;
    return st === "Ativa" || st === "Agendada";
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-line p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-metal">Situação atual</p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Preço de venda (base)" v={formatPrice(basePriceCents)} />
            <Row k="Promoção ativa" v={pricing.activePromotion ? describePromotion(pricing.activePromotion, formatPrice) : "Nenhuma"} />
            <Row k="Preço final" v={<strong className="text-white">{formatPrice(pricing.finalPriceCents)}</strong>} />
            <Row
              k="Preço anterior anunciado"
              v={pricing.referencePriceCents !== null ? formatPrice(pricing.referencePriceCents) : "—"}
              hint="Menor preço praticado nos 30 dias anteriores à redução (calculado automaticamente)."
            />
            <Row k="Valor poupado" v={pricing.hasDiscount ? formatPrice(pricing.savingsCents) : "—"} />
            <Row k="Redução" v={pricing.hasDiscount ? formatPercent(pricing.savingsPercent) : "—"} />
            {pricing.promotionEndsAt && <Row k="Termina em" v={formatDateTime(pricing.promotionEndsAt, timeZone)} />}
          </dl>
          {pricing.activePromotion && !pricing.hasDiscount && (
            <Notice tone="warn" className="mt-4">
              O preço promocional está em vigor, mas a redução não é anunciada como desconto porque não existe um preço anterior mais alto praticado nos 30
              dias anteriores.
            </Notice>
          )}
        </div>
        <div className="rounded-sm border border-line p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-metal">Pré-visualização no showroom</p>
          <div className="mt-4 rounded-sm bg-ink p-5">
            <PriceBlock pricing={pricing} size="lg" showEnd timeZone={timeZone} />
          </div>
        </div>
      </div>

      <section aria-labelledby="nova-promo">
        <h3 id="nova-promo" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="size-4" /> Criar ou agendar promoção
        </h3>
        {disabled ? (
          <Notice className="mt-3">{disabledReason}</Notice>
        ) : (
          <div className="mt-4 rounded-sm border border-line p-5">
            {hasOpen && (
              <Notice className="mb-4">
                Só pode existir uma promoção em cada período. Para criar outra em simultâneo, termine ou cancele primeiro a atual. Pode agendar uma nova
                promoção para depois do fim da atual.
              </Notice>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as DiscountType)} options={DISCOUNT_TYPES} />
              <Input
                label={type === "percentagem" ? "Percentagem (%)" : type === "valor" ? "Desconto (€)" : "Preço promocional (€)"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                placeholder={type === "percentagem" ? "Ex.: 5" : "Ex.: 1500"}
                error={errors.value}
              />
              <Input
                label="Início"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                hint="Vazio = imediatamente"
                error={errors.startsAt}
              />
              <Input label="Fim (opcional)" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} error={errors.endsAt} />
              <Input
                label="Designação interna (opcional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
                placeholder="Ex.: Campanha de primavera"
                wrapperClassName="md:col-span-2"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-metal" aria-live="polite">
                {preview ? (
                  <>
                    Preço final: <strong className="text-white tabular">{formatPrice(preview.finalPriceCents)}</strong> · poupança{" "}
                    <span className="tabular">{formatPrice(preview.savingsCents)}</span> ({formatPercent(preview.savingsPercent)})
                  </>
                ) : basePriceCents ? (
                  "Indique um valor para ver o preço final."
                ) : (
                  "Defina primeiro o preço de venda."
                )}
              </p>
              <Button type="button" onClick={submit} loading={pending} disabled={!basePriceCents} icon={<CalendarClock className="size-4" />}>
                {startsAt ? "Agendar promoção" : "Aplicar promoção"}
              </Button>
            </div>
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-metal">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              O desconto é sempre calculado sobre o preço de venda base, nunca sobre um preço já descontado. No showroom, o “preço anterior” corresponde ao preço
              mais baixo praticado nos 30 dias anteriores à redução, conforme as regras de anúncio de reduções de preço (Diretiva (UE) 2019/2161).
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="lista-promos">
        <h3 id="lista-promos" className="text-sm font-semibold text-white">
          Promoções
        </h3>
        {promotions.length ? (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
            {promotions.map((p) => {
              const st = promoState(p, now);
              const open = st.label === "Ativa" || st.label === "Agendada";
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="text-white">{describePromotion(p, formatPrice)}</span>
                      {p.label && <span className="text-metal">· {p.label}</span>}
                    </div>
                    <p className="mt-1 text-xs text-metal">
                      {formatDateTime(p.startsAt, timeZone)} → {p.endsAt ? formatDateTime(p.endsAt, timeZone) : "sem data de fim"}
                      {p.createdByName && ` · por ${p.createdByName}`}
                    </p>
                  </div>
                  {open && !disabled && (
                    <Button type="button" variant="ghost" size="sm" icon={<XCircle className="size-3.5" />} onClick={() => setToEnd(p)}>
                      {st.label === "Ativa" ? "Terminar" : "Cancelar"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-metal">Ainda não foram criadas promoções para esta viatura.</p>
        )}
      </section>

      <section aria-labelledby="historico-precos">
        <h3 id="historico-precos" className="text-sm font-semibold text-white">
          Histórico do preço de venda
        </h3>
        {history.length ? (
          <div className="mt-3 overflow-x-auto rounded-sm border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.66rem] uppercase tracking-[0.14em] text-metal">
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Anterior</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Novo preço</th>
                  <th className="px-4 py-2.5 font-semibold">Alterado por</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-line">
                    <td className="px-4 py-2.5 text-metal tabular">{formatDateTime(h.createdAt, timeZone)}</td>
                    <td className="px-4 py-2.5 text-right text-metal tabular">{h.previousPriceCents !== null ? formatPrice(h.previousPriceCents) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-white tabular">{formatPrice(h.priceCents)}</td>
                    <td className="px-4 py-2.5 text-metal">{h.changedByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-metal">Sem alterações de preço registadas.</p>
        )}
      </section>

      <ConfirmDialog
        open={!!toEnd}
        onClose={() => setToEnd(null)}
        tone="primary"
        title={toEnd && promoState(toEnd, now).label === "Ativa" ? "Terminar promoção?" : "Cancelar promoção agendada?"}
        description="O preço normal volta a estar em vigor no showroom. A promoção fica registada no histórico."
        confirmLabel="Confirmar"
        onConfirm={async () => {
          if (!toEnd) return;
          const r = await endPromotion(toEnd.id);
          setToEnd(null);
          toast(r.ok ? (r.message ?? "Concluído.") : r.message, r.ok ? "success" : "error");
        }}
      />
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2 last:border-0">
      <dt className="text-metal" title={hint}>
        {k}
      </dt>
      <dd className="text-right text-soft tabular">{v}</dd>
    </div>
  );
}
