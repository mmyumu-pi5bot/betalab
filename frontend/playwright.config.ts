import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.PW_FRONTEND_PORT ?? "3001";
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  retries: process.env.CI ? 2 : 0,
  timeout: Number(process.env.PW_TEST_TIMEOUT) || 30_000,
  expect: { timeout: Number(process.env.PW_EXPECT_TIMEOUT) || 5_000 },
  use: {
    baseURL: frontendOrigin,
    headless: true,
    testIdAttribute: "data-testid",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command:
        `UV_CACHE_DIR=/tmp/uv-cache BETALAB_EXPERIMENTS_DB_PATH=/tmp/betalab-playwright.sqlite3 BETALAB_CORS_ALLOWED_ORIGINS=${frontendOrigin},http://localhost:${frontendPort},http://127.0.0.1:3000,http://localhost:3000 uv run uvicorn app.main:app --host 127.0.0.1 --port 8010 --log-level warning`,
      cwd: "../backend",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      url: "http://127.0.0.1:8010/health",
    },
    {
      command:
        `NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY=true NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010 pnpm exec next dev --hostname 127.0.0.1 --port ${frontendPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      url: frontendOrigin,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
