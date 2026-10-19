// Cálculo de preços, descontos e preço de referência para anúncios de redução de preço.
//
// Regras:
//  • O desconto é sempre aplicado sobre o preço de venda base — nunca sobre um preço
//    já descontado — e só pode existir uma promoção ativa por viatura (garantido também
//    por uma restrição de exclusão na base de dados). Assim é impossível acumular descontos.
//  • Diretiva Omnibus (Diretiva (UE) 2019/2161; em Portugal, DL n.º 70/2007 na redação do
//    DL n.º 109-G/2021): ao anunciar uma redução, o "preço anterior" é o preço mais baixo
//    praticado nos 30 dias anteriores à aplicação da redução. Calculamo-lo a partir do
//    histórico de preços e das promoções anteriores. Se não for possível demonstrar um preço
//    anterior superior ao atual, a redução NÃO é anunciada.

import type { DiscountType } from "./constants";

export const REFERENCE_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export type PromotionLike = {
  id?: string;
  discountType: DiscountType;
  amountCents: number | null;
  percentBp: number | null;
  startsAt: Date | string;
  endsAt: Date | string | null;
  cancelledAt?: Date | string | null;
  label?: string | null;
};

export type PriceHistoryLike = { priceCents: number; createdAt: Date | string };

export type Pricing = {
  basePriceCents: number | null;
  finalPriceCents: number | null;
  referencePriceCents: number | null; // preço anterior legalmente anunciável
  savingsCents: number;
  savingsPercent: number; // 0–100, uma casa decimal
  hasDiscount: boolean;
  activePromotion: PromotionLike | null;
  promotionEndsAt: Date | null;
};

const t = (d: Date | string) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

/** Aplica uma promoção a um preço base. Nunca devolve valores negativos nem superiores ao base. */
export function applyDiscount(baseCents: number, promo: PromotionLike): number {
  let result = baseCents;
  switch (promo.discountType) {
    case "valor":
      result = baseCents - (promo.amountCents ?? 0);
      break;
    case "percentagem":
      result = Math.round((baseCents * (10_000 - (promo.percentBp ?? 0))) / 10_000);
      break;
    case "preco_final":
      result = promo.amountCents ?? baseCents;
      break;
  }
  return Math.min(baseCents, Math.max(0, result));
}

export function isPromotionActiveAt(promo: PromotionLike, at: number): boolean {
  if (promo.cancelledAt) return false;
  const start = t(promo.startsAt);
  const end = promo.endsAt ? t(promo.endsAt) : Infinity;
  return start <= at && at < end;
}

export function findActivePromotion<P extends PromotionLike>(promos: P[], at: number): P | null {
  return promos.find((p) => isPromotionActiveAt(p, at)) ?? null;
}

/** Preço base em vigor num instante, segundo o histórico (ordenado ou não). */
export function basePriceAt(history: PriceHistoryLike[], at: number): number | null {
  let best: PriceHistoryLike | null = null;
  for (const h of history) {
    const ht = t(h.createdAt);
    if (ht <= at && (!best || ht >= t(best.createdAt))) best = h;
  }
  return best ? best.priceCents : null;
}

/** Preço efetivamente praticado num instante (base + eventual promoção). */
export function effectivePriceAt(history: PriceHistoryLike[], promos: PromotionLike[], at: number): number | null {
  const base = basePriceAt(history, at);
  if (base === null) return null;
  const promo = findActivePromotion(promos, at);
  return promo ? applyDiscount(base, promo) : base;
}

/**
 * Preço mais baixo praticado nos 30 dias anteriores a `reductionStart`.
 * Devolve null se a viatura não tinha preço praticado antes da redução.
 */
export function lowestPriorPrice(
  history: PriceHistoryLike[],
  promos: PromotionLike[],
  reductionStart: number,
  windowDays = REFERENCE_WINDOW_DAYS,
): number | null {
  const windowStart = reductionStart - windowDays * DAY_MS;
  const points = new Set<number>([windowStart]);
  for (const h of history) {
    const ht = t(h.createdAt);
    if (ht > windowStart && ht < reductionStart) points.add(ht);
  }
  for (const p of promos) {
    if (p.cancelledAt) continue;
    const s = t(p.startsAt);
    const e = p.endsAt ? t(p.endsAt) : Infinity;
    if (s > windowStart && s < reductionStart) points.add(s);
    if (e > windowStart && e < reductionStart) points.add(e);
  }
  let min: number | null = null;
  for (const point of points) {
    const price = effectivePriceAt(history, promos, point);
    if (price !== null && (min === null || price < min)) min = price;
  }
  return min;
}

export function computePricing(input: {
  basePriceCents: number | null;
  history: PriceHistoryLike[];
  promotions: PromotionLike[];
  now?: Date;
}): Pricing {
  const now = (input.now ?? new Date()).getTime();
  const base = input.basePriceCents;
  const empty: Pricing = {
    basePriceCents: base,
    finalPriceCents: base,
    referencePriceCents: null,
    savingsCents: 0,
    savingsPercent: 0,
    hasDiscount: false,
    activePromotion: null,
    promotionEndsAt: null,
  };
  if (base === null || base <= 0) return empty;

  const active = findActivePromotion(input.promotions, now);
  if (!active) return empty;

  const final = applyDiscount(base, active);
  const others = input.promotions.filter((p) => p !== active);
  const reference = lowestPriorPrice(input.history, others, t(active.startsAt));
  const result: Pricing = {
    ...empty,
    finalPriceCents: final,
    activePromotion: active,
    promotionEndsAt: active.endsAt ? new Date(t(active.endsAt)) : null,
  };
  if (reference === null || reference <= final) return result;

  const savings = reference - final;
  return {
    ...result,
    referencePriceCents: reference,
    savingsCents: savings,
    savingsPercent: Math.round((savings / reference) * 1000) / 10,
    hasDiscount: true,
  };
}

/** Simulação de uma promoção (para pré-visualização no back office). */
export function previewPromotion(baseCents: number, promo: PromotionLike) {
  const final = applyDiscount(baseCents, promo);
  const savings = baseCents - final;
  return {
    finalPriceCents: final,
    savingsCents: savings,
    savingsPercent: baseCents > 0 ? Math.round((savings / baseCents) * 1000) / 10 : 0,
  };
}

export function describePromotion(p: PromotionLike, formatPrice: (c: number) => string): string {
  switch (p.discountType) {
    case "valor":
      return `Desconto de ${formatPrice(p.amountCents ?? 0)}`;
    case "percentagem":
      return `Desconto de ${((p.percentBp ?? 0) / 100).toLocaleString("pt-PT")}%`;
    case "preco_final":
      return `Preço promocional de ${formatPrice(p.amountCents ?? 0)}`;
  }
}
