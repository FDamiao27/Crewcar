import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { EDITOR_STATE, TEST_DATABASE_URL } from "./helpers";

test.describe("Segurança e proteção de dados", () => {
  test("cabeçalhos de segurança e CSP", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("rotas e APIs administrativas recusam pedidos sem sessão", async ({ request }) => {
    expect((await request.get("/api/admin/vehicles/export")).status()).toBe(401);
    const upload = await request.post("/api/admin/vehicles/00000000-0000-0000-0000-000000000000/photos", {
      headers: { origin: "http://localhost:3100" },
      multipart: { files: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } },
    });
    expect(upload.status()).toBe(401);
    const csrf = await request.post("/api/admin/photos/00000000-0000-0000-0000-000000000000", {
      headers: { origin: "https://site-malicioso.example" },
      multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } },
    });
    expect(csrf.status()).toBe(403);
    expect((await request.get("/media/../../etc/passwd")).status()).toBe(404);
  });

  test("a base de dados impede a role pública de ler dados privados", async () => {
    const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    try {
      const attempt = (q: (tx: postgres.TransactionSql) => Promise<unknown>) =>
        sql.begin(async (tx) => {
          await tx`set local role crewcar_web`;
          return q(tx);
        });
      await expect(attempt((tx) => tx`select vin from vehicles`)).rejects.toThrow(/permission denied/);
      await expect(attempt((tx) => tx`select purchase_price_cents from vehicles`)).rejects.toThrow(/permission denied/);
      await expect(attempt((tx) => tx`select internal_notes from vehicles`)).rejects.toThrow(/permission denied/);
      await expect(attempt((tx) => tx`select email from leads`)).rejects.toThrow(/permission denied/);
      await expect(attempt((tx) => tx`select email from admin_users`)).rejects.toThrow(/permission denied/);
      await expect(attempt((tx) => tx`select draft from site_content`)).rejects.toThrow(/permission denied/);
      const visible = (await attempt((tx) => tx`select reference from vehicles`)) as { reference: string }[];
      expect(visible.map((v) => v.reference)).not.toContain("DEMO-09"); // não publicada
    } finally {
      await sql.end();
    }
  });

  test.describe("perfil editor", () => {
    test.use({ storageState: EDITOR_STATE });

    test("não acede a utilizadores nem vê custos de aquisição", async ({ page }) => {
      await page.goto("/admin/utilizadores");
      await expect(page).toHaveURL(/\/admin\?erro=permissao/);
      await expect(page.getByText("Não tem permissão para aceder a essa área.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Utilizadores" })).toHaveCount(0);

      await page.goto("/admin/viaturas");
      await expect(page.getByRole("columnheader", { name: "Aquisição" })).toHaveCount(0);
      await page.getByRole("link", { name: "Peugeot 308" }).click();
      await page.getByRole("tab", { name: "Preços" }).click();
      await expect(page.getByLabel(/Preço de aquisição/)).toHaveCount(0);
      const html = await page.content();
      expect(html).not.toMatch(/purchasePrice\w*\\?"?:\\?"?20000/);
      expect(html).not.toContain("purchasePriceCents");
      expect(html).not.toContain("Margem estimada");

      const exp = await page.request.get("/api/admin/vehicles/export");
      expect(exp.status()).toBe(200);
      expect(await exp.text()).not.toContain("preco_aquisicao");
    });
  });
});
