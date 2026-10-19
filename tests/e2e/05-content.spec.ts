import { expect, test } from "@playwright/test";
import { ANON_STATE, OWNER_STATE, expectToast } from "./helpers";

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

test.describe("Conteúdos e definições", () => {
  test("definições de contacto aplicam-se ao website", async ({ page, browser }) => {
    await page.goto("/admin/definicoes");
    await page.getByLabel("Telefone", { exact: true }).fill("+351 210 000 000");
    await page.getByLabel("E-mail", { exact: true }).fill("geral@crewcar.example");
    await page.getByLabel("WhatsApp", { exact: true }).fill("+351 910 000 000");
    await page.getByLabel("Código postal", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Guardar definições" }).click();
    await expectToast(page, /Existem campos por corrigir/);
    await expect(page.getByText("Código postal no formato 0000-000.").first()).toBeVisible();
    await page.getByLabel("Código postal", { exact: true }).fill("");
    await page.getByRole("button", { name: "Guardar definições" }).click();
    await expectToast(page, "Definições guardadas e aplicadas ao website.");

    await page.reload();
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("geral@crewcar.example");

    const anon = await browser.newPage({ storageState: ANON_STATE });
    await anon.goto("/contactos");
    await expect(anon.locator('main a[href="tel:+351210000000"]').first()).toBeVisible();
    await expect(anon.locator('main a[href^="https://wa.me/351910000000"]').first()).toBeVisible();
    await expect(anon.getByRole("contentinfo").getByText("+351 210 000 000")).toBeVisible();
    await anon.goto("/viaturas/volkswagen-golf-1-0-tsi-life-2021-demo-01");
    await expect(anon.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute("href", /wa\.me\/351910000000\?text=/);
    await anon.close();
  });

  test("rascunho, pré-visualização e publicação da página inicial", async ({ page, browser }) => {
    await page.goto("/admin/conteudos");
    await page.getByRole("textbox", { name: "Título principal" }).fill("TÍTULO EM RASCUNHO.");
    await page.getByRole("button", { name: "Guardar rascunho" }).click();
    await expectToast(page, /Rascunho guardado/);

    const anon = await browser.newPage({ storageState: ANON_STATE });
    await anon.goto("/");
    await expect(anon.getByRole("heading", { level: 1 })).toHaveText("ENCONTRA O TEU PRÓXIMO DESTINO.");

    // Pré-visualização apenas para o administrador
    await page.goto("/api/admin/preview?destino=/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("TÍTULO EM RASCUNHO.");
    await expect(page.getByText(/Pré-visualização do rascunho/)).toBeVisible();
    const denied = await anon.request.get("/api/admin/preview?destino=/", { maxRedirects: 0 });
    expect(denied.status()).toBe(401);
    await page.getByRole("link", { name: "Sair" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ENCONTRA O TEU PRÓXIMO DESTINO.");

    // Publicar
    await page.goto("/admin/conteudos");
    await expect(page.getByRole("textbox", { name: "Título principal" })).toHaveValue("TÍTULO EM RASCUNHO.");
    await page.getByRole("tab", { name: /Perguntas frequentes/ }).click();
    await page.getByRole("button", { name: "Adicionar pergunta" }).click();
    await page.getByLabel("Pergunta 1", { exact: true }).fill("Aceitam retomas?");
    await page.getByLabel("Resposta", { exact: true }).fill("Avaliamos cada caso individualmente.");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expectToast(page, "Conteúdos publicados no website.");
    await anon.reload();
    await expect(anon.getByRole("heading", { level: 1 })).toHaveText("TÍTULO EM RASCUNHO.");
    await expect(anon.getByText("Aceitam retomas?")).toBeVisible();

    // Repor o título original
    await page.getByRole("tab", { name: "Página inicial" }).click();
    await page.getByRole("textbox", { name: "Título principal" }).fill("ENCONTRA O TEU PRÓXIMO DESTINO.");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expectToast(page, "Conteúdos publicados no website.");
    await anon.close();
  });

  test("páginas legais só ficam públicas depois de publicadas", async ({ page, browser }) => {
    const anon = await browser.newPage({ storageState: ANON_STATE });
    expect((await anon.goto("/privacidade"))?.status()).toBe(404);
    await page.goto("/admin/conteudos/paginas/privacidade");
    await page.getByRole("switch", { name: "Publicada" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Página guardada e publicada.");
    expect((await anon.goto("/privacidade"))?.status()).toBe(200);
    await expect(anon.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
    await expect(anon.getByRole("contentinfo").getByRole("link", { name: "Política de privacidade" })).toBeVisible();
    await anon.close();
  });
});
