import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    testIdAttribute: "data-testid",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command:
        "UV_CACHE_DIR=/tmp/uv-cache BETALAB_EXPERIMENTS_DB_PATH=/tmp/betalab-playwright.sqlite3 BETALAB_CORS_ALLOWED_ORIGINS=http://127.0.0.1:3001,http://localhost:3001,http://127.0.0.1:3000,http://localhost:3000 uv run uvicorn app.main:app --host 127.0.0.1 --port 8010",
      cwd: "../backend",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      url: "http://127.0.0.1:8010/health",
    },
    {
      command:
        "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010 pnpm dev --hostname 127.0.0.1 --port 3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      url: "http://127.0.0.1:3001",
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
