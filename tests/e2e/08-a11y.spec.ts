import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./helpers";

// Verificação automática de acessibilidade (WCAG 2.1 AA): contraste, etiquetas, estrutura.
const PUBLIC = ["/", "/viaturas", "/viaturas/volkswagen-golf-1-0-tsi-life-2021-demo-01", "/contactos", "/o-stand"];

test.describe("Acessibilidade", () => {
  for (const path of PUBLIC) {
    test(`showroom ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} — ${v.nodes[0]?.target.join(" ")}`);
      expect(summary).toEqual([]);
    });
  }

  test.describe("back office", () => {
    test.use({ storageState: OWNER_STATE });
    for (const path of ["/admin", "/admin/viaturas", "/admin/contactos"]) {
      test(`admin ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} — ${v.nodes[0]?.target.join(" ")}`);
        expect(summary).toEqual([]);
      });
    }
  });
});
