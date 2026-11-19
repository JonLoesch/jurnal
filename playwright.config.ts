import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, channel: process.env.PW_CHANNEL ?? "chrome", trace: "retain-on-failure" },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://jurnal@localhost:54329/jurnal_e2e",
      AUTH_SECRET: "e2e-secret",
      AUTH_DEV_LOGIN: "1",
      APP_URL: `http://localhost:${PORT}`,
      UPLOAD_DIR: "/tmp/jurnal-e2e-uploads",
      CRON_SECRET: "e2e-cron",
    },
  },
});
