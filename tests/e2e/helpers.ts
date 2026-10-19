import { expect, type Page } from "@playwright/test";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://crewcar:crewcar_dev@localhost:5432/crewcar_test";
export const ANON_STATE = "tests/e2e/.auth/anon.json";
export const OWNER_STATE = "tests/e2e/.auth/owner.json";
export const EDITOR_STATE = "tests/e2e/.auth/editor.json";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Palavra-passe").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[role=status], [role=alert]").filter({ hasText: text }).first()).toBeVisible();
}

/** Normaliza espaços inseparáveis usados na formatação portuguesa de números. */
export function nb(s: string) {
  return s.replace(/[  ]/g, " ");
}
