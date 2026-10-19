import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { ANON_STATE, OWNER_STATE, expectToast, nb } from "./helpers";

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

let vehicleId = "";
let slug = "";
let photoUrl = "";

async function openTab(page: Page, name: string | RegExp) {
  await page.getByRole("tab", { name }).click();
}

test.describe("Gestão de viaturas", () => {
  test("valida o formulário e impede gravar dados inválidos", async ({ page }) => {
    await page.goto("/admin/viaturas/nova");
    await page.getByLabel("Referência de stock").fill("E2E-INVALIDA");
    await page.getByLabel("Ano de matrícula").fill("1800");
    await page.getByRole("button", { name: "Criar viatura" }).click();
    await expectToast(page, /campos por corrigir/);
    await expect(page.getByText("Indique a marca.")).toBeVisible();
    await expect(page.getByText(/Ano entre 1900/)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/viaturas\/nova$/);
  });

  test("cria uma viatura com todos os dados principais", async ({ page }) => {
    await page.goto("/admin/viaturas/nova");
    await page.getByLabel("Marca").fill("Peugeot");
    await page.getByLabel("Modelo").fill("308");
    await page.getByLabel("Versão").fill("1.2 PureTech GT");
    await page.getByLabel("Categoria").selectOption("berlina");
    await page.getByLabel("Referência de stock").fill("E2E-001");
    await page.getByLabel("Ano de matrícula").fill("2022");
    await page.getByLabel("Quilometragem (km)").fill("15000");
    await page.getByLabel("Combustível").selectOption("gasolina");
    await page.getByLabel("Caixa de velocidades").selectOption("manual");
    await page.getByLabel("Potência (cv)").fill("130");
    await page.getByLabel("Cor exterior").fill("Cinzento Artense");
    await page.getByLabel(/VIN/).fill("VF3ABCDEF12345678");

    await openTab(page, "Preços");
    await page.getByLabel(/Preço de venda/).fill("24900");
    await page.getByLabel(/Preço de aquisição/).fill("20000");
    await expect(page.getByText("Margem estimada")).toBeVisible();

    await openTab(page, "Descrição e equipamento");
    await page.getByLabel("Descrição curta").fill("Viatura de teste automático com equipamento completo.");
    await page.getByRole("textbox", { name: /^Equipamento/ }).fill("Ar condicionado automático");
    await page.getByRole("textbox", { name: /^Equipamento/ }).press("Enter");
    await page.getByRole("textbox", { name: /^Equipamento/ }).fill("Câmara de marcha-atrás");
    await page.getByRole("textbox", { name: /^Equipamento/ }).press("Enter");
    await page.getByLabel(/Notas internas/).fill("NOTA-INTERNA-SECRETA");

    await openTab(page, "Publicação");
    await page.getByRole("switch", { name: "Visível no showroom" }).click();

    await page.getByRole("button", { name: "Criar viatura" }).click();
    await expect(page).toHaveURL(/\/admin\/viaturas\/[0-9a-f-]{36}\?tab=fotografias/);
    vehicleId = page.url().match(/viaturas\/([0-9a-f-]{36})/)![1];
    await expect(page.getByRole("heading", { name: "Peugeot 308" })).toBeVisible();
    await expect(page.getByText("Publicada", { exact: true }).first()).toBeVisible();
  });

  test("carrega, valida e organiza fotografias", async ({ page }) => {
    await page.goto(`/admin/viaturas/${vehicleId}?tab=fotografias`);
    await page.waitForLoadState("networkidle"); // garantir que a página está interativa (hidratada)
    const fixtures = path.join(process.cwd(), "tests/fixtures");
    await page.getByTestId("photo-input").setInputFiles([
      path.join(fixtures, "imagem-teste-1.png"),
      path.join(fixtures, "imagem-teste-2.png"),
      path.join(fixtures, "imagem-pequena.jpg"),
    ]);
    await expectToast(page, "2 fotografia(s) carregada(s).");
    await expect(page.getByText(/demasiado pequena/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fotografias (2)" })).toBeVisible();
    const list = page.getByRole("list", { name: /Fotografias de Peugeot 308/ });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").first().getByText("Principal")).toBeVisible();

    // Texto alternativo
    await list.getByRole("listitem").nth(1).getByLabel("Texto alternativo").fill("Vista lateral");
    await list.getByRole("listitem").nth(1).getByRole("button", { name: "Guardar texto" }).click();
    await expectToast(page, "Legenda guardada.");

    // Definir a segunda como principal e reordenar
    await list.getByRole("listitem").nth(1).getByRole("button", { name: "Definir como principal" }).click();
    await expectToast(page, "Fotografia principal definida.");
    await list.getByRole("listitem").nth(1).getByRole("button", { name: "Mover para trás" }).click();
    await expectToast(page, "Ordem das fotografias guardada.");

    // Persistência após atualizar a página
    await page.reload();
    const first = page.getByRole("list", { name: /Fotografias de Peugeot 308/ }).getByRole("listitem").first();
    await expect(first.getByText("Principal")).toBeVisible();
    await expect(first.getByLabel("Texto alternativo")).toHaveValue("Vista lateral");
    photoUrl = (await first.locator("img").getAttribute("src"))!;
    expect(photoUrl).toMatch(/^\/media\/vehicles\//);
  });

  test("edita a viatura e os dados persistem após atualizar", async ({ page }) => {
    await page.goto(`/admin/viaturas/${vehicleId}`);
    await page.getByLabel("Quilometragem (km)").fill("16000");
    await expect(page.getByText("● Alterações por guardar")).toBeVisible();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expectToast(page, "Alterações guardadas.");
    await page.reload();
    await expect(page.getByLabel("Quilometragem (km)")).toHaveValue("16000");
    await openTab(page, "Publicação");
    slug = await page.getByLabel("Endereço personalizado").inputValue();
    expect(slug).toBe("peugeot-308-1-2-puretech-gt-2022");
  });

  test("a viatura publicada aparece no showroom sem dados privados", async ({ page, browser }) => {
    const anon = await browser.newPage({ storageState: ANON_STATE });
    await anon.goto(`/viaturas/${slug}`);
    await expect(anon.getByRole("heading", { level: 1, name: "Peugeot 308" })).toBeVisible();
    const html = nb(await anon.content());
    expect(html).toContain("16 000 km");
    expect(html).toContain("24 900 €");
    expect(html).toContain("Ar condicionado automático");
    expect(html).not.toContain("NOTA-INTERNA-SECRETA");
    expect(html).not.toContain("VF3ABCDEF12345678");
    expect(html).not.toContain("20 000 €");
    await expect(anon.getByRole("img", { name: "Vista lateral" })).toBeVisible();
    // Galeria: miniaturas e ecrã inteiro
    await anon.getByRole("tab", { name: "Ver fotografia 2" }).click();
    await anon.getByRole("button", { name: "Ver em ecrã inteiro" }).click();
    await expect(anon.getByRole("button", { name: "Fechar ecrã inteiro" })).toBeVisible();
    await anon.keyboard.press("Escape");

    await anon.goto("/viaturas?q=308");
    await expect(anon.getByRole("heading", { name: "Peugeot 308" })).toBeVisible();
    await anon.close();
  });

  test("calcula descontos e rejeita promoções inválidas ou sobrepostas", async ({ page, browser }) => {
    await page.goto(`/admin/viaturas/${vehicleId}?tab=preco`);
    // Inválida: percentagem acima do limite
    await page.getByLabel("Tipo").selectOption("percentagem");
    await page.getByLabel("Percentagem (%)").fill("95");
    await page.getByRole("button", { name: "Aplicar promoção" }).click();
    await expectToast(page, /entre 0,01% e 90%/);

    // Válida: 10%
    await page.getByLabel("Percentagem (%)").fill("10");
    await expect(page.getByText(/Preço final:/)).toContainText(/22\s410/);
    await page.getByRole("button", { name: "Aplicar promoção" }).click();
    await expectToast(page, "Promoção ativa no showroom.");

    // Sobreposição: não é possível aplicar um segundo desconto em simultâneo
    await page.getByLabel("Tipo").selectOption("valor");
    await page.getByLabel("Desconto (€)").fill("500");
    await page.getByRole("button", { name: "Aplicar promoção" }).click();
    await expectToast(page, /sobrepõe/);

    const anon = await browser.newPage({ storageState: ANON_STATE });
    await anon.goto(`/viaturas/${slug}`);
    const html = nb(await anon.locator("main").innerText());
    expect(html).toContain("22 410 €");
    expect(html).toContain("24 900 €"); // preço anterior
    expect(html).toContain("−10%");
    expect(html).toContain("Poupa 2490 €");

    // Terminar a promoção repõe o preço normal
    await page.reload();
    await page.getByRole("button", { name: "Terminar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expectToast(page, /Promoção terminada/);
    await anon.reload();
    expect(nb(await anon.content())).not.toContain("22 410 €");
    await anon.close();
  });

  test("alterações de preço e de estado refletem-se no showroom", async ({ page, browser }) => {
    await page.goto("/admin/precos?q=E2E-001");
    await page.getByRole("button", { name: "Alterar preço de Peugeot 308" }).click();
    await page.getByLabel("Novo preço de Peugeot 308").fill("23.900");
    await page.getByRole("button", { name: "Guardar preço" }).click();
    await expectToast(page, /Preço atualizado/);

    const anon = await browser.newPage({ storageState: ANON_STATE });
    await anon.goto(`/viaturas/${slug}`);
    expect(nb(await anon.content())).toContain("23 900 €");

    // Reservada
    await page.goto("/admin/viaturas?q=E2E-001");
    await page.getByRole("button", { name: "Ações para E2E-001" }).click();
    await page.getByRole("menuitem", { name: "Marcar como reservada" }).click();
    await expectToast(page, "Viatura marcada como reservada.");
    await anon.reload();
    await expect(anon.getByText("Reservado").first()).toBeVisible();

    // Vendida: sai do catálogo, a página indica que foi vendida
    await page.getByRole("button", { name: "Ações para E2E-001" }).click();
    await page.getByRole("menuitem", { name: "Marcar como vendida" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Marcar como vendida" }).click();
    await expectToast(page, /vendida/);
    await anon.goto("/viaturas?q=308");
    await expect(anon.getByText("Nenhuma viatura corresponde à pesquisa")).toBeVisible();
    await anon.goto(`/viaturas/${slug}`);
    await expect(anon.getByText("Viatura vendida")).toBeVisible();
    await expect(anon.getByRole("link", { name: "Pedir informações" })).toHaveCount(0);

    // Disponível de novo e retirada de publicação: deixa de ser acessível publicamente
    await page.getByRole("button", { name: "Ações para E2E-001" }).click();
    await page.getByRole("menuitem", { name: "Marcar como disponível" }).click();
    await expectToast(page, "Viatura marcada como disponível.");
    await page.getByRole("button", { name: "Ações para E2E-001" }).click();
    await page.getByRole("menuitem", { name: "Retirar de publicação" }).click();
    await expectToast(page, "Viatura retirada de publicação.");
    const res = await anon.goto(`/viaturas/${slug}`);
    expect(res?.status()).toBe(404);
    const media = await anon.request.get(photoUrl);
    expect(media.status()).toBe(404);
    await anon.close();

    // O administrador continua a poder pré-visualizar
    await page.goto(`/viaturas/${slug}?preview=1`);
    await expect(page.getByText("Pré-visualização", { exact: true })).toBeVisible();
    expect((await page.request.get(photoUrl)).status()).toBe(200);

    // Publicar novamente
    await page.goto("/admin/viaturas?q=E2E-001");
    await page.getByRole("button", { name: "Ações para E2E-001" }).click();
    await page.getByRole("menuitem", { name: "Publicar", exact: true }).click();
    await expectToast(page, "Viatura publicada no showroom.");
  });

  test("duplica, arquiva, restaura e elimina com confirmação", async ({ page }) => {
    await page.goto("/admin/viaturas?q=E2E-001");
    await page.getByRole("button", { name: "Ações para E2E-001" }).click();
    await page.getByRole("menuitem", { name: "Duplicar anúncio" }).click();
    await expect(page).toHaveURL(/\/admin\/viaturas\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Referência de stock")).toHaveValue("E2E-001-COPIA");
    await expect(page.getByRole("tab", { name: "Fotografias (2)" })).toBeVisible();

    await page.goto("/admin/viaturas?q=E2E-001-COPIA");
    await page.getByRole("button", { name: "Ações para E2E-001-COPIA" }).click();
    await page.getByRole("menuitem", { name: "Arquivar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Arquivar" }).click();
    await expectToast(page, "Viatura arquivada.");
    await page.goto("/admin/viaturas?q=E2E-001-COPIA&vista=arquivadas");
    await page.getByRole("button", { name: "Ações para E2E-001-COPIA" }).click();
    await page.getByRole("menuitem", { name: "Restaurar" }).click();
    await expectToast(page, "Viatura restaurada.");

    await page.goto("/admin/viaturas?q=E2E-001-COPIA");
    await page.getByRole("button", { name: "Ações para E2E-001-COPIA" }).click();
    await page.getByRole("menuitem", { name: "Eliminar…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Eliminar" })).toBeDisabled();
    await dialog.getByRole("textbox").fill("E2E-001-COPIA");
    await dialog.getByRole("button", { name: "Eliminar" }).click();
    await expectToast(page, "Viatura eliminada definitivamente.");
    await page.goto("/admin/viaturas?q=E2E-001-COPIA");
    await expect(page.getByText("Nenhuma viatura corresponde aos filtros")).toBeVisible();
  });
});
