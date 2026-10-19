import { describe, expect, it } from "vitest";
import { applyDiscount, computePricing, lowestPriorPrice, previewPromotion, type PromotionLike } from "@/lib/pricing";

const DAY = 86_400_000;
const now = new Date("2026-10-19T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY);
const promo = (p: Partial<PromotionLike>): PromotionLike => ({
  discountType: "valor",
  amountCents: null,
  percentBp: null,
  startsAt: ago(1),
  endsAt: null,
  ...p,
});

describe("applyDiscount", () => {
  it("aplica desconto em valor", () => {
    expect(applyDiscount(2_000_000, promo({ discountType: "valor", amountCents: 150_000 }))).toBe(1_850_000);
  });
  it("aplica percentagem com arredondamento ao cêntimo", () => {
    expect(applyDiscount(1_740_000, promo({ discountType: "percentagem", percentBp: 500 }))).toBe(1_653_000);
    expect(applyDiscount(999, promo({ discountType: "percentagem", percentBp: 333 }))).toBe(966);
  });
  it("aplica preço final promocional", () => {
    expect(applyDiscount(2_000_000, promo({ discountType: "preco_final", amountCents: 1_890_000 }))).toBe(1_890_000);
  });
  it("nunca devolve preços negativos nem superiores ao base", () => {
    expect(applyDiscount(100_000, promo({ discountType: "valor", amountCents: 500_000 }))).toBe(0);
    expect(applyDiscount(100_000, promo({ discountType: "preco_final", amountCents: 900_000 }))).toBe(100_000);
  });
});

describe("computePricing (regras de anúncio de reduções)", () => {
  const history = [{ priceCents: 3_290_000, createdAt: ago(45) }];

  it("sem promoção, o preço final é o preço de venda", () => {
    const p = computePricing({ basePriceCents: 3_290_000, history, promotions: [], now });
    expect(p).toMatchObject({ finalPriceCents: 3_290_000, hasDiscount: false, referencePriceCents: null, savingsCents: 0 });
  });

  it("promoção ativa: preço anterior = preço praticado antes, poupança e percentagem", () => {
    const p = computePricing({
      basePriceCents: 3_290_000,
      history,
      promotions: [promo({ discountType: "valor", amountCents: 150_000, startsAt: ago(3) })],
      now,
    });
    expect(p.finalPriceCents).toBe(3_140_000);
    expect(p.referencePriceCents).toBe(3_290_000);
    expect(p.savingsCents).toBe(150_000);
    expect(p.savingsPercent).toBe(4.6);
    expect(p.hasDiscount).toBe(true);
  });

  it("preço anterior é o mais baixo dos 30 dias anteriores (descida recente de preço)", () => {
    const h = [
      { priceCents: 2_500_000, createdAt: ago(60) },
      { priceCents: 2_000_000, createdAt: ago(10) },
    ];
    const p = computePricing({ basePriceCents: 2_000_000, history: h, promotions: [promo({ discountType: "percentagem", percentBp: 1000, startsAt: ago(2) })], now });
    expect(p.finalPriceCents).toBe(1_800_000);
    expect(p.referencePriceCents).toBe(2_000_000);
    expect(p.savingsPercent).toBe(10);
  });

  it("promoção anterior nos últimos 30 dias reduz o preço de referência", () => {
    const first = promo({ discountType: "valor", amountCents: 300_000, startsAt: ago(20), endsAt: ago(15) });
    const second = promo({ discountType: "valor", amountCents: 100_000, startsAt: ago(5) });
    expect(lowestPriorPrice(history, [first], ago(5).getTime())).toBe(2_990_000);
    const p = computePricing({ basePriceCents: 3_290_000, history, promotions: [first, second], now });
    // 3 190 000 (atual) > 2 990 000 (mínimo dos 30 dias) → não pode ser anunciado como redução
    expect(p.finalPriceCents).toBe(3_190_000);
    expect(p.hasDiscount).toBe(false);
    expect(p.referencePriceCents).toBeNull();
  });

  it("sem preço praticado antes da redução, o desconto não é anunciado", () => {
    const p = computePricing({
      basePriceCents: 2_000_000,
      history: [{ priceCents: 2_000_000, createdAt: ago(1) }],
      promotions: [promo({ discountType: "valor", amountCents: 100_000, startsAt: ago(2) })],
      now,
    });
    expect(p.finalPriceCents).toBe(1_900_000);
    expect(p.hasDiscount).toBe(false);
  });

  it("promoções agendadas, terminadas ou canceladas não se aplicam", () => {
    const scheduled = promo({ amountCents: 100_000, startsAt: new Date(now.getTime() + DAY) });
    const ended = promo({ amountCents: 100_000, startsAt: ago(10), endsAt: ago(1) });
    const cancelled = promo({ amountCents: 100_000, startsAt: ago(3), cancelledAt: ago(2) });
    for (const p of [scheduled, ended, cancelled]) {
      expect(computePricing({ basePriceCents: 3_290_000, history, promotions: [p], now }).finalPriceCents).toBe(3_290_000);
    }
  });

  it("pré-visualização calcula valor e percentagem poupados", () => {
    expect(previewPromotion(2_000_000, promo({ discountType: "percentagem", percentBp: 750 }))).toEqual({
      finalPriceCents: 1_850_000,
      savingsCents: 150_000,
      savingsPercent: 7.5,
    });
  });
});
