import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: {
    actionTimeout: 12000,
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});