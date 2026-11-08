import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  testIgnore: /tests\/e2e\/pwa\.spec\.ts/,
  timeout: 90000,
  workers: 1,
  reporter: "list",
  use: {
    actionTimeout: 15000,
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/tmp/chromium", args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
