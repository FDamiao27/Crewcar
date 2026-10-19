import { expect, test } from "@playwright/test";
import { OWNER_STATE, expectToast } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Pedidos de contacto e CRM", () => {
  test("o formulário valida os dados e apresenta erros", async ({ page }) => {
    await page.goto("/contactos");
    await page.waitForTimeout(1200);
    await page.getByRole("textbox", { name: "Nome", exact: true }).fill("A");
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("email-invalido");
    await page.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Oi");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByText("Verifique os campos assinalados.")).toBeVisible();
    await expect(page.getByText("Indique o seu nome.")).toBeVisible();
    await expect(page.getByText("Indique um e-mail válido.")).toBeVisible();
    await expect(page.getByText(/É necessário aceitar/)).toBeVisible();
  });

  test("um pedido válido é guardado na base de dados", async ({ page }) => {
    await page.goto("/contactos");
    await page.waitForTimeout(1200);
    await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Maria Teste");
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("maria.teste@example.pt");
    await page.getByRole("textbox", { name: "Telefone", exact: true }).fill("912 345 678");
    await page.getByLabel("Viatura de interesse (opcional)").selectOption({ label: "Toyota C-HR 1.8 Hybrid Comfort (DEMO-06)" });
    await page.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Gostaria de agendar um test drive no sábado.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByText("Mensagem enviada", { exact: true })).toBeVisible();
  });

  test("pedido a partir da página da viatura", async ({ page }) => {
    await page.goto("/viaturas/volkswagen-polo-1-0-tsi-comfortline-2019-demo-08");
    await page.waitForTimeout(1200);
    const form = page.locator("#contacto");
    await form.getByRole("textbox", { name: "Nome", exact: true }).fill("João Viatura");
    await form.getByRole("textbox", { name: "Telefone", exact: true }).fill("+351 913 000 000");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(form.getByText("Mensagem enviada", { exact: true })).toBeVisible();
  });

  test.describe("CRM", () => {
    test.use({ storageState: OWNER_STATE });

    test("lista, altera estado, adiciona notas e mantém histórico", async ({ page }) => {
      await page.goto("/admin/contactos");
      await expect(page.getByRole("link", { name: "Maria Teste" })).toBeVisible();
      await expect(page.getByRole("link", { name: "João Viatura" })).toBeVisible();
      await page.goto("/admin/contactos?q=maria");
      await expect(page.getByRole("link", { name: "João Viatura" })).toHaveCount(0);
      await page.getByRole("link", { name: "Maria Teste" }).click();
      await expect(page.getByText("Gostaria de agendar um test drive no sábado.")).toBeVisible();
      await expect(page.getByRole("link", { name: /Toyota C-HR/ })).toBeVisible();

      await page.getByRole("radio", { name: "Em negociação" }).click();
      await expectToast(page, "Estado alterado para “Em negociação”.");
      await page.getByLabel("Adicionar nota interna").fill("Cliente prefere contacto por WhatsApp.");
      await page.getByRole("button", { name: "Guardar nota" }).click();
      await expectToast(page, "Nota adicionada.");

      await page.reload();
      await expect(page.getByRole("radio", { name: "Em negociação" })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByText("Cliente prefere contacto por WhatsApp.")).toBeVisible();
      await expect(page.getByText("Estado alterado de “Novo” para “Em negociação”.")).toBeVisible();

      await page.goto("/admin/contactos?estado=em_negociacao");
      await expect(page.getByRole("link", { name: "Maria Teste" })).toBeVisible();
      await page.goto("/admin");
      await expect(page.getByRole("link", { name: /Contactos/ }).first()).toBeVisible();
    });
  });
});
