import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: /tests\/e2e\/pwa\.spec\.ts/,
  testIgnore: [],
  timeout: 180000,
  use: { ...base.use, baseURL: "http://localhost:4173", launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/tmp/chromium", args: ["--no-sandbox", "--js-flags=--expose-gc", "--enable-precise-memory-info"] } },
  webServer: { command: "npm run build && npm run preview -- --host 0.0.0.0 --port 4173", url: "http://localhost:4173", reuseExistingServer: true, timeout: 240000 },
});
