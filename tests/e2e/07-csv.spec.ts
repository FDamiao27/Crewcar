import { expect, test } from "@playwright/test";
import { OWNER_STATE, expectToast } from "./helpers";

test.use({ storageState: OWNER_STATE });

test.describe("Importação e exportação CSV", () => {
  test("exporta o stock em CSV", async ({ page }) => {
    const res = await page.request.get("/api/admin/vehicles/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("referencia;marca;modelo");
    expect(text).toContain("preco_aquisicao");
    expect(text).toContain("E2E-001;Peugeot;308");
  });

  test("analisa, deteta duplicados e importa", async ({ page }) => {
    await page.goto("/admin/viaturas/importar");
    await page.waitForLoadState("networkidle");
    const csv = [
      "referencia;marca;modelo;versao;ano;quilometros;combustivel;caixa;preco_venda;publicada",
      "E2E-CSV-1;Skoda;Octavia;2.0 TDI;2021;52000;Gasóleo;Manual;22.500;sim",
      "E2E-CSV-2;Kia;Ceed;1.0 T-GDi;2022;30000;gasolina;manual;18900;não",
      "E2E-001;Peugeot;308;;2022;16000;gasolina;manual;23900;sim",
      "E2E-CSV-3;Opel;;;2020;;gasolina;manual;-5;não",
    ].join("\n");
    await page.getByTestId("csv-input").setInputFiles({ name: "stock.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText(/4 linha\(s\)/)).toBeVisible();
    await expect(page.getByText("Duplicada", { exact: true })).toBeVisible();
    await expect(page.getByText(/Indique o modelo/)).toBeVisible();
    await page.getByRole("button", { name: "Importar 2 viatura(s)" }).click();
    await expectToast(page, /Importação concluída: 2 criada/);
    await page.goto("/admin/viaturas?q=E2E-CSV");
    await expect(page.getByRole("link", { name: "Skoda Octavia" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kia Ceed" })).toBeVisible();
    await page.goto("/viaturas?q=octavia");
    await expect(page.getByRole("heading", { name: "Skoda Octavia" })).toBeVisible();
  });
});
