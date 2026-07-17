import { defineConfig, devices } from "@playwright/test";

const fixtureRoot = process.env.E2E_FIXTURE_ROOT;
if (!fixtureRoot) {
  throw new Error(
    "E2E must run through `pnpm test:e2e` so SHITATE_ROOT uses a temporary workspace.",
  );
}

const apiPort = process.env.STUDIO_PORT ?? "5179";
const clientPort = process.env.STUDIO_CLIENT_PORT ?? "5180";
const host = process.env.STUDIO_HOST ?? "127.0.0.1";
const baseURL = `http://${host}:${clientPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command: "pnpm exec tsx studio/server/main.ts",
      url: `http://${host}:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm exec vite --config studio/client/vite.config.ts --host 127.0.0.1",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
