import { test as setup } from "@playwright/test";
import { EDITOR, OWNER } from "./global-setup";
import { EDITOR_STATE, OWNER_STATE, login } from "./helpers";

setup("sessão do proprietário", async ({ page }) => {
  await login(page, OWNER.email, OWNER.password);
  await page.context().storageState({ path: OWNER_STATE });
});

setup("sessão do editor", async ({ page }) => {
  await login(page, EDITOR.email, EDITOR.password);
  await page.context().storageState({ path: EDITOR_STATE });
});
