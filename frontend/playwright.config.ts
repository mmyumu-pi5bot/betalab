import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.PW_FRONTEND_PORT ?? "3001";
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
// The laboratory runs in real time for a learner: half a minute of grinding, a
// tube that takes as long to chill as a tube does. A suite that waits for those
// in real time spends most of its runtime asleep, so the backend under test is
// told to spend ten simulated seconds per wall second. Every phenomenon still
// happens, in order, with its intermediate states visible — just sooner.
const simulationSpeed = process.env.PW_SIMULATION_SPEED ?? "10";

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
        `UV_CACHE_DIR=/tmp/uv-cache BETALAB_SIMULATION_SPEED=${simulationSpeed} BETALAB_EXPERIMENTS_DB_PATH=/tmp/betalab-playwright.sqlite3 BETALAB_CORS_ALLOWED_ORIGINS=${frontendOrigin},http://localhost:${frontendPort},http://127.0.0.1:3000,http://localhost:3000 uv run uvicorn app.main:app --host 127.0.0.1 --port 8010 --log-level warning`,
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
