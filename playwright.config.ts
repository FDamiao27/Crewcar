import { defineConfig, devices } from "@playwright/test";

// Testes de integração ponta a ponta. Utilizam uma base de dados separada (crewcar_test)
// e um diretório de armazenamento próprio. Requer `npm run build` antes da execução.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://crewcar:crewcar_dev@localhost:5432/crewcar_test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    locale: "pt-PT",
    timezoneId: "Europe/Lisbon",
    trace: "retain-on-failure",
    storageState: "tests/e2e/.auth/anon.json",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, dependencies: ["setup"], testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"], testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE_URL}/robots.txt`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SITE_URL: BASE_URL,
      APP_SECRET: "segredo-de-testes-com-mais-de-trinta-e-dois-caracteres-123",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "./storage-test",
      FORM_MIN_SECONDS: "1",
    },
  },
});
