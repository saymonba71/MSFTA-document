import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function ready(page: Page) {
  await page.goto("/#/studio");
  await expect(page.locator(".iso-shell")).toBeVisible();
  await page.evaluate(async () => { if ("serviceWorker" in navigator) { await navigator.serviceWorker.ready; } });
}

test("offline: shell + seal + prompt work with zero network after cache warm", async ({ page, context }) => {
  const external: string[] = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (u.origin !== "http://localhost:4173" && u.protocol !== "blob:" && u.protocol !== "data:") external.push(r.url()); });
  await ready(page);
  // warm lazy chunks + fonts
  await page.goto("/#/studio/seal.studio"); await expect(page.getByTestId("seal-studio")).toBeVisible();
  await page.getByTestId("seal-export-png").click(); await expect(page.getByTestId("studio-download")).toBeVisible({ timeout: 60000 });
  await page.goto("/#/studio/prompt.studio"); await expect(page.getByTestId("prompt-studio")).toBeVisible();
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.goto("/#/studio"); await expect(page.locator(".iso-shell")).toBeVisible({ timeout: 30000 });
  await page.goto("/#/studio/seal.studio"); await expect(page.getByTestId("seal-studio")).toBeVisible();
  await page.getByTestId("seal-export-png").click(); await expect(page.getByTestId("studio-download")).toBeVisible({ timeout: 60000 });
  await page.goto("/#/studio/prompt.studio"); await expect(page.getByTestId("prompt-studio")).toBeVisible();
  await page.getByTestId("prompt-generate").click(); await expect(page.getByTestId("prompt-adapted")).not.toBeEmpty();
  expect(external).toEqual([]);
  await context.setOffline(false);
});

test("accessibility: axe critical violations = 0 on home, settings, seal", async ({ page }) => {
  for (const route of ["", "/settings", "/seal.studio"]) {
    await page.goto("/#/studio" + route);
    await expect(page.locator(".iso-shell")).toBeVisible();
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical, JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
  }
});

test("memory: 50 open/close cycles stay within heap budget", async ({ page }) => {
  await ready(page);
  const heap = () => page.evaluate(() => { (window as unknown as { gc?: () => void }).gc?.(); return (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0; });
  const before = await heap();
  expect(before, "performance.memory must expose a real heap baseline (run with --enable-precise-memory-info)").toBeGreaterThan(0);
  for (let i = 0; i < 50; i++) {
    // In-app hash navigation keeps a single JS realm so heap growth is measurable.
    await page.evaluate(() => { location.hash = "#/studio/seal.studio"; });
    await expect(page.getByTestId("seal-studio")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/studio"; });
    await expect(page.locator(".iso-home")).toBeVisible();
  }
  await page.waitForTimeout(1000);
  const after = await heap();
  const growthMB = (after - before) / 1048576;
  console.log(`heap growth after 50 cycles: ${growthMB.toFixed(1)} MB`);
  expect(growthMB).toBeLessThan(150);
});

test("manifest + icons + share target are installable-shaped", async ({ page }) => {
  await ready(page);
  const manifest = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  expect(manifest.share_target.action).toBe("/share-target");
  for (const icon of manifest.icons) { const res = await page.request.get(icon.src); expect(res.status()).toBe(200); }
});
