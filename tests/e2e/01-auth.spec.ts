import { expect, test } from "@playwright/test";
import { OWNER } from "./global-setup";
import { login } from "./helpers";

test.describe("Autenticação", () => {
  test("o back office exige sessão iniciada", async ({ page }) => {
    for (const path of ["/admin", "/admin/viaturas", "/admin/contactos", "/admin/definicoes"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
  });

  test("credenciais inválidas são rejeitadas com mensagem clara", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(OWNER.email);
    await page.getByLabel("Palavra-passe").fill("palavra-passe-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou palavra-passe incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("o administrador inicia e termina sessão", async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await expect(page.getByRole("heading", { name: /Olá, Dono/ })).toBeVisible();
    await expect(page.getByText("Total de viaturas")).toBeVisible();
    // A sessão persiste após atualizar a página
    await page.reload();
    await expect(page.getByRole("heading", { name: /Olá, Dono/ })).toBeVisible();
    await page.getByRole("button", { name: "Terminar sessão" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("não existe registo público de administradores", async ({ request }) => {
    for (const path of ["/admin/registo", "/admin/register", "/api/admin/users", "/signup"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([307, 308, 404]).toContain(res.status());
    }
  });
});
