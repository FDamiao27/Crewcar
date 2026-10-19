import { expect, test } from "@playwright/test";
import { nb } from "./helpers";

test.describe("Showroom público", () => {
  test("página inicial com secção principal, destaques e contactos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "ENCONTRA O TEU PRÓXIMO DESTINO." })).toBeVisible();
    await expect(page.getByText("Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Explorar viaturas" })).toHaveAttribute("href", "/viaturas");
    await expect(page.getByRole("link", { name: "Falar com a Crew Car" }).first()).toHaveAttribute("href", "/contactos");
    await expect(page.getByRole("heading", { name: "Em destaque" })).toBeVisible();
    // Viatura vendida e viatura não publicada nunca aparecem como disponíveis
    const html = await page.content();
    expect(html).not.toContain("Classe A");
    expect(html).not.toContain("A4 Avant");
    // Menu e navegação
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Viaturas" }).click();
    await expect(page).toHaveURL(/\/viaturas$/);
  });

  test("catálogo: pesquisa, filtros, ordenação e limpeza de filtros", async ({ page }) => {
    await page.goto("/viaturas");
    await expect(page.getByRole("heading", { name: /viaturas encontradas/ })).toBeVisible();

    await page.getByLabel("Marca", { exact: true }).selectOption("Volkswagen");
    await expect(page).toHaveURL(/marca=Volkswagen/);
    await expect(page.getByRole("heading", { name: /viaturas encontradas/ })).toContainText("2");
    await page.getByLabel("Modelo", { exact: true }).selectOption("Golf");
    await expect(page.getByRole("heading", { name: /encontrada/ })).toContainText("1");
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/viaturas$/);

    await page.getByLabel("Combustível").selectOption("gasoleo");
    await expect(page.getByRole("heading", { name: /viaturas encontradas/ })).toContainText("2");
    await page.getByLabel("Preço máx.").selectOption("30000");
    await expect(page.getByRole("heading", { name: /encontrada/ })).toContainText("1");
    await expect(page.getByRole("heading", { name: "Peugeot 3008" })).toBeVisible();
    await page.getByRole("link", { name: "Remover filtro Gasóleo" }).click();
    await expect(page).not.toHaveURL(/combustivel/);

    await page.goto("/viaturas?q=tesla");
    await expect(page.getByRole("heading", { name: "Tesla Model 3" })).toBeVisible();
    await expect(page.getByText("Reservado").first()).toBeVisible();

    await page.goto("/viaturas?anoMin=2023");
    const titles = await page.locator("article h3").allTextContents();
    expect(titles).toEqual(["Renault Clio"]);

    await page.goto("/viaturas");
    await page.getByLabel("Ordenar").selectOption("preco_asc");
    await expect(page).toHaveURL(/ordem=preco_asc/);
    const prices = (await page.locator("article p.price").allTextContents()).map((t) => Number(nb(t).replace(/\D/g, "")));
    expect(prices.length).toBeGreaterThan(3);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);

    await page.goto("/viaturas?q=nao-existe-xyz");
    await expect(page.getByText("Nenhuma viatura corresponde à pesquisa")).toBeVisible();
  });

  test("cada viatura tem uma página própria e partilhável", async ({ page }) => {
    await page.goto("/viaturas?q=clio");
    await page.getByRole("link", { name: "Renault Clio" }).click();
    await expect(page).toHaveURL(/\/viaturas\/renault-clio-1-0-tce-evolution-2023-demo-04$/);
    await expect(page.getByRole("heading", { level: 1, name: "Renault Clio" })).toBeVisible();
    await expect(page.getByText("Conteúdo de demonstração")).toBeVisible();
    const html = nb(await page.content());
    expect(html).toContain("16 530 €");
    expect(html).toContain("17 400 €");
    expect(html).toContain('"@type":"Car"');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Renault Clio/);
    await expect(page.getByRole("button", { name: "Copiar ligação" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Viaturas semelhantes" })).toBeVisible();
    await expect(page.getByText("Fotografias brevemente disponíveis")).toBeVisible();
  });

  test("viaturas vendidas e não publicadas não são anunciadas como disponíveis", async ({ page }) => {
    await page.goto("/viaturas/mercedes-benz-classe-a-a-180-d-style-2019-demo-07");
    await expect(page.getByText("Viatura vendida")).toBeVisible();
    const res = await page.goto("/viaturas/audi-a4-avant-35-tdi-s-tronic-2020-demo-09");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada." })).toBeVisible();
  });

  test("páginas de erro, sitemap e robots", async ({ page, request }) => {
    const res = await page.goto("/pagina-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada." })).toBeVisible();

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/viaturas/volkswagen-golf-1-0-tsi-life-2021-demo-01");
    expect(sitemap).not.toContain("demo-09");
    expect(sitemap).not.toContain("demo-07");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
  });

  test("aviso de cookies permite aceitar ou rejeitar", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Consentimento de cookies" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Rejeitar" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(banner).toBeHidden();
    expect((await ctx.cookies()).find((c) => c.name === "cc_consent")?.value).toBe("rejected");
    await page.getByRole("button", { name: "Preferências de cookies" }).click();
    await banner.getByRole("button", { name: "Aceitar" }).click();
    expect((await ctx.cookies()).find((c) => c.name === "cc_consent")?.value).toBe("accepted");
    await ctx.close();
  });

  test("O Stand e contactos sem dados inventados", async ({ page }) => {
    await page.goto("/o-stand");
    await expect(page.getByRole("heading", { level: 1, name: "O Stand" })).toBeVisible();
    await page.goto("/contactos");
    await expect(page.getByRole("heading", { level: 1, name: "Fale connosco" })).toBeVisible();
    // Sem contactos configurados, não são apresentados telefones ou moradas fictícios
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  });
});
