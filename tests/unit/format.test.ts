import { describe, expect, it } from "vitest";
import { centsToInput, formatDate, formatKm, formatPrice, parseEurosToCents } from "@/lib/format";
import { dateToLocalInput, localInputToDate } from "@/lib/time";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("formatação pt-PT", () => {
  it("formata preços em euros", () => {
    expect(nbsp(formatPrice(2_190_000))).toBe("21 900 €");
    expect(nbsp(formatPrice(1_234_550))).toBe("12 345,50 €");
    expect(formatPrice(null)).toBe("—");
  });
  it("formata quilómetros e datas DD/MM/AAAA", () => {
    expect(nbsp(formatKm(48200))).toBe("48 200 km");
    expect(formatDate("2021-03-09")).toBe("09/03/2021");
    expect(formatDate(new Date("2026-10-19T23:30:00Z"))).toBe("20/10/2026"); // Lisboa: UTC+1 em outubro
  });
});

describe("parseEurosToCents", () => {
  it.each([
    ["21900", 2_190_000],
    ["21 900", 2_190_000],
    ["21.900", 2_190_000],
    ["21.900,50", 2_190_050],
    ["21900,5", 2_190_050],
    ["1.250.000", 125_000_000],
    ["21900.99", 2_190_099],
    ["21 900 €", 2_190_000],
  ])("%s → %d", (input, expected) => {
    expect(parseEurosToCents(input)).toBe(expected);
  });
  it.each(["", "-100", "abc", "1,2,3", "12.34.5"])("rejeita %s", (input) => {
    expect(parseEurosToCents(input)).toBeNull();
  });
  it("converte de volta para texto editável", () => {
    expect(centsToInput(2_190_050)).toBe("21900,50");
    expect(centsToInput(2_190_000)).toBe("21900");
  });
});

describe("hora de Lisboa", () => {
  it("converte datetime-local de Lisboa para UTC (verão e inverno)", () => {
    expect(localInputToDate("2026-07-01T10:00")!.toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(localInputToDate("2026-12-01T10:00")!.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(localInputToDate("2026-07-01T10:00", "Atlantic/Azores")!.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(dateToLocalInput(new Date("2026-07-01T09:00:00Z"))).toBe("2026-07-01T10:00");
    expect(localInputToDate("lixo")).toBeNull();
  });
});
