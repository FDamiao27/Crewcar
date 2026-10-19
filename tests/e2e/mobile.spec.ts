import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./helpers";

test.describe("Telemóvel", () => {
  test("navegação, catálogo e página da viatura", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(await noHorizontalScroll()).toBe(true);

    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.getByRole("navigation", { name: "Navegação móvel" });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Viaturas" }).click();
    await expect(page).toHaveURL(/\/viaturas$/);

    await expect(page.getByLabel("Marca", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByLabel("Marca", { exact: true }).selectOption("Volkswagen");
    await expect(page).toHaveURL(/marca=Volkswagen/);
    expect(await noHorizontalScroll()).toBe(true);

    await page.getByRole("link", { name: "Volkswagen Golf" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Volkswagen Golf" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedir informações" })).toBeVisible();
    expect(await noHorizontalScroll()).toBe(true);
  });

  test.describe("back office", () => {
    test.use({ storageState: OWNER_STATE });
    test("menu lateral e tabela utilizáveis no telemóvel", async ({ page }) => {
      await page.goto("/admin");
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("navigation", { name: "Back office" }).getByRole("link", { name: "Viaturas" }).click();
      await expect(page).toHaveURL(/\/admin\/viaturas$/);
      await expect(page.getByRole("heading", { level: 1, name: "Viaturas" })).toBeVisible();
    });
  });
});
