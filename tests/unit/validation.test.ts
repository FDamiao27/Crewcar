import { describe, expect, it } from "vitest";
import { validateRows, parseCsv } from "@/lib/admin/csv";
import { Markdown } from "@/lib/markdown";
import { mergeDefaults, parseSettings, DEFAULT_SETTINGS } from "@/lib/site-schema";
import { EMPTY_VEHICLE_FORM, buildVehicleSlug, vehicleSchema } from "@/lib/vehicle-schema";
import { renderToStaticMarkup } from "react-dom/server";

const base = { ...EMPTY_VEHICLE_FORM, brand: "Peugeot", model: "208", reference: "CC-0001", price: "15900" };

describe("validação de viaturas", () => {
  it("aceita uma viatura válida e converte valores", () => {
    const r = vehicleSchema.parse({ ...base, mileageKm: "48 200", registrationYear: "2021", vin: "vf3abcdef12345678" });
    expect(r.price).toBe(1_590_000);
    expect(r.mileageKm).toBe(48200);
    expect(r.vin).toBe("VF3ABCDEF12345678");
  });
  it("impede publicar sem preço e preços negativos", () => {
    expect(vehicleSchema.safeParse({ ...base, price: "", isPublished: true }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, price: "-10" }).success).toBe(false);
  });
  it("valida VIN, ano e data da 1.ª matrícula", () => {
    expect(vehicleSchema.safeParse({ ...base, vin: "123" }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, vin: "VF3ABCDEFI2345678" }).success).toBe(false); // contém I
    expect(vehicleSchema.safeParse({ ...base, registrationYear: "1800" }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, registrationYear: "2020", firstRegistrationDate: "2021-01-01" }).success).toBe(false);
  });
  it("gera endereços amigáveis", () => {
    expect(buildVehicleSlug({ brand: "Citroën", model: "C5 Aircross", version: "1.5 BlueHDi Feel", registrationYear: 2022 })).toBe(
      "citroen-c5-aircross-1-5-bluehdi-feel-2022",
    );
  });
});

describe("importação CSV", () => {
  const csv = [
    "referencia;marca;modelo;preco_venda;combustivel;caixa;publicada;vin",
    "CC-1;Renault;Clio;12.500;Gasóleo;Manual;sim;",
    "CC-2;Fiat;500;9900;gasolina;manual;não;ZFA12345678901234",
    "cc-1;Renault;Megane;14000;diesel;automática;não;",
    "CC-3;;Sem marca;1000;;;não;",
    "CC-9;Seat;Ibiza;8000;gasolina;manual;não;",
  ].join("\n");

  it("deteta duplicados no ficheiro e na base de dados e erros de validação", () => {
    const { rows } = parseCsv(csv);
    const result = validateRows(rows, { references: new Map([["cc-9", "id-9"]]), vins: new Map() }, "ignorar");
    expect(result.map((r) => r.outcome)).toEqual(["novo", "novo", "erro", "erro", "duplicado"]);
    expect(result[0].data?.price).toBe(1_250_000);
    expect(result[0].data?.fuel).toBe("gasoleo");
    expect(result[0].data?.isPublished).toBe(true);
    expect(result[2].errors.join(" ")).toMatch(/repetida/);
  });
  it("modo atualizar marca referências existentes para atualização", () => {
    const { rows } = parseCsv(csv);
    const result = validateRows(rows, { references: new Map([["cc-9", "id-9"]]), vins: new Map() }, "atualizar");
    expect(result[4].outcome).toBe("atualizar");
  });
});

describe("conteúdos e segurança do texto", () => {
  it("o Markdown não executa HTML nem ligações javascript:", () => {
    const html = renderToStaticMarkup(Markdown({ source: "## Título\n\n<script>alert(1)</script> [x](javascript:alert(1)) **ok**" }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain("<strong>ok</strong>");
  });
  it("definições guardadas incompletas são completadas com os valores por omissão", () => {
    const s = parseSettings({ brandName: "CREW CAR", contact: { phone: "+351 210 000 000" } });
    expect(s.contact.phone).toBe("+351 210 000 000");
    expect(s.regional.timezone).toBe("Europe/Lisbon");
    expect(mergeDefaults(DEFAULT_SETTINGS, undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
