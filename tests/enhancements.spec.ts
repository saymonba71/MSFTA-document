import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";

async function makeImage(page: Page, width: number, height: number, color: string) {
  const base64 = await page.evaluate(({ width, height, color }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { width, height, color });
  return Buffer.from(base64, "base64");
}

test("image-to-PDF can reorder photos, preserve aspect and open in editor", async ({ page }, info) => {
  await page.goto("/");
  const landscape = await makeImage(page, 320, 160, "#d33139");
  const portrait = await makeImage(page, 120, 240, "#3175cf");
  await page.getByRole("button", { name: /ছবি থেকে PDF/ }).click();
  const dialog = page.getByRole("dialog", { name: "ছবি থেকে PDF" });
  await dialog.getByTestId("image-pdf-input").setInputFiles([
    { name: "landscape.png", mimeType: "image/png", buffer: landscape },
    { name: "portrait.png", mimeType: "image/png", buffer: portrait },
  ]);
  await expect(dialog.locator("[data-image-pdf-item]")).toHaveCount(2);
  await dialog.getByRole("button", { name: "landscape.png পরে সরান" }).click();
  await expect(dialog.locator("[data-image-pdf-item]").first()).toHaveAttribute("data-image-pdf-item", "portrait.png");
  await dialog.getByRole("radio", { name: /ছবির অনুপাতে/ }).check();
  await dialog.getByLabel("ছবির PDF-এর নাম").fill("photo-set");
  await dialog.getByRole("button", { name: "PDF তৈরি করুন", exact: true }).click();
  const link = dialog.getByTestId("download-file");
  await expect(link).toBeVisible();
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("photo-set.pdf");
  const file = info.outputPath("photos.pdf");
  await download.saveAs(file);
  const pdf = await PDFDocument.load(await fs.readFile(file));
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([[90, 180], [240, 120]]);
  const colors = await page.evaluate(async (bytes) => {
    const path = "/src/lib/doc.ts";
    const { loadDocument } = await import(path);
    const loadedDoc = await loadDocument([new File([new Uint8Array(bytes)], "test.pdf", { type: "application/pdf" })]);
    return Promise.all(loadedDoc.pages.map(async (page: { src: string }) => {
      const image = new Image(); image.src = page.src; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    }));
  }, Array.from(await fs.readFile(file)));
  expect(colors[0][2]).toBeGreaterThan(colors[0][0]);
  expect(colors[1][0]).toBeGreaterThan(colors[1][2]);
  await dialog.getByRole("button", { name: "এই PDF-এ সিল বসান" }).click();
  await expect(page.getByTestId("page-surface")).toBeVisible();
  await expect(page.getByText("পেজ 1 / 2", { exact: true }).first()).toBeVisible();
});

test("image-to-PDF A4 layout follows each photo orientation", async ({ page }, info) => {
  await page.goto("/");
  const wide = await makeImage(page, 240, 120, "#d33139");
  const tall = await makeImage(page, 120, 240, "#3175cf");
  await page.getByRole("button", { name: /ছবি থেকে PDF/ }).click();
  const dialog = page.getByRole("dialog", { name: "ছবি থেকে PDF" });
  await dialog.getByTestId("image-pdf-input").setInputFiles([
    { name: "wide.png", mimeType: "image/png", buffer: wide },
    { name: "tall.png", mimeType: "image/png", buffer: tall },
  ]);
  await dialog.getByRole("button", { name: "PDF তৈরি করুন", exact: true }).click();
  const pending = page.waitForEvent("download");
  await dialog.getByTestId("download-file").click();
  const download = await pending;
  const file = info.outputPath("a4.pdf");
  await download.saveAs(file);
  const pdf = await PDFDocument.load(await fs.readFile(file));
  expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
  expect(pdf.getPage(1).getHeight()).toBeGreaterThan(pdf.getPage(1).getWidth());
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(841.89, 2);
});

test("invalid image selections report an error without discarding previous images", async ({ page }) => {
  await page.goto("/");
  const image = await makeImage(page, 100, 100, "#b45a60");
  await page.getByRole("button", { name: /ছবি থেকে PDF/ }).click();
  const dialog = page.getByRole("dialog", { name: "ছবি থেকে PDF" });
  await dialog.getByTestId("image-pdf-input").setInputFiles({ name: "good.png", mimeType: "image/png", buffer: image });
  await expect(dialog.locator("[data-image-pdf-item]")).toHaveCount(1);
  await dialog.getByTestId("image-pdf-input").setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await expect(dialog.getByRole("alert")).toContainText("শুধু JPG");
  await expect(dialog.locator("[data-image-pdf-item]")).toHaveCount(1);
  await expect(dialog.locator("[data-image-pdf-item]").first()).toHaveAttribute("data-image-pdf-item", "good.png");
});

test("selected seal downloads as a transparent, correctly sized PNG", async ({ page }, info) => {
  await page.goto("/");
  await page.getByTitle("স্বচ্ছ PNG হিসেবে সিল ডাউনলোড করুন").click();
  const dialog = page.getByRole("dialog", { name: "সিল ডাউনলোড" });
  await dialog.getByLabel("সিলের ছবির আকার").selectOption("512");
  await dialog.getByRole("button", { name: "স্বচ্ছ PNG তৈরি করুন" }).click();
  const link = dialog.getByTestId("download-file");
  await expect(link).toBeVisible();
  const alpha = await page.evaluate(async (url) => {
    const image = new Image(); image.src = url!; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, corner: ctx.getImageData(0, 0, 1, 1).data[3] };
  }, await link.getAttribute("href"));
  expect(Math.max(alpha.width, alpha.height)).toBe(512);
  expect(alpha.corner).toBe(0);
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("seal-transparent.png");
  const file = info.outputPath("seal.png");
  await download.saveAs(file);
  expect((await fs.readFile(file)).subarray(1, 4).toString()).toBe("PNG");
});

test("configurable page numbers replace earlier numbers without duplicating them", async ({ page }, info) => {
  await page.goto("/");
  const image = await makeImage(page, 180, 240, "#f3f3f0");
  await page.getByTestId("document-input").setInputFiles([
    { name: "one.png", mimeType: "image/png", buffer: image },
    { name: "two.png", mimeType: "image/png", buffer: image },
  ]);
  await expect(page.getByTestId("page-surface")).toBeVisible();
  const inspector = page.getByRole("complementary", { name: "এডিটর সেটিংস" });
  await inspector.getByRole("button", { name: "পেজ", exact: true }).click();
  await inspector.getByRole("button", { name: /পেজ নম্বর/ }).click();
  const dialog = page.getByRole("dialog", { name: "পেজ নম্বর যোগ করুন" });
  await dialog.getByLabel("শুরুর নম্বর").fill("5");
  await dialog.getByLabel("সংখ্যার ভাষা").selectOption("en");
  await dialog.getByLabel("পেজ নম্বরের অবস্থান").selectOption("top-right");
  await expect(dialog.getByLabel("পেজ নম্বর প্রিভিউ")).toContainText("5 / 6");
  await dialog.getByRole("button", { name: "সব পেজে নম্বর বসান" }).click();
  await expect(dialog).toBeHidden();
  await inspector.getByRole("button", { name: /পেজ নম্বর/ }).click();
  await dialog.getByRole("button", { name: "সব পেজে নম্বর বসান" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "সেভ", exact: true }).click();
  const save = page.getByRole("dialog", { name: "সেভ ও ডাউনলোড" });
  await save.getByLabel("ফাইলের ধরন").selectOption("project");
  await save.getByRole("button", { name: "ফাইল তৈরি করুন" }).click();
  const pending = page.waitForEvent("download");
  await save.getByTestId("download-file").click();
  const file = info.outputPath("numbers.sealproject");
  await (await pending).saveAs(file);
  const project = JSON.parse(await fs.readFile(file, "utf8"));
  const numbers = project.stamps.filter((stamp: { role?: string }) => stamp.role === "page-number");
  expect(numbers).toHaveLength(2);
  expect(numbers.map((stamp: { page: number }) => stamp.page)).toEqual([0, 1]);
  expect(numbers.every((stamp: { x: number; y: number }) => stamp.x > .75 && stamp.y < .1)).toBe(true);
  const names = numbers.map((stamp: { sealId: string }) => project.seals.find((seal: { id: string; text?: string }) => seal.id === stamp.sealId)?.text);
  expect(names).toEqual(["5 / 6", "6 / 6"]);
});

test("reduced-motion users get a stable dashboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".dashboard-primary-grid")).toBeVisible();
  expect(await page.locator(".dashboard-primary-grid").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

test.describe("mobile enhancements", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  test("navigation and conversion controls fit a narrow phone", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId("nav-tools").tap();
    await page.getByRole("button", { name: /ছবি থেকে PDF/ }).tap();
    const dialog = page.getByRole("dialog", { name: "ছবি থেকে PDF" });
    await expect(dialog.getByRole("button", { name: "ছবি বেছে নিন" })).toBeVisible();
    const image = await makeImage(page, 120, 160, "#598a76");
    await dialog.getByTestId("image-pdf-input").setInputFiles({ name: "mobile.png", mimeType: "image/png", buffer: image });
    await expect(dialog.getByRole("button", { name: "PDF তৈরি করুন", exact: true })).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
    await dialog.getByRole("button", { name: "PDF তৈরি করুন", exact: true }).tap();
    await expect(dialog.getByTestId("download-file")).toBeVisible();
  });
  test("page numbering is reachable and editable on a narrow phone", async ({ page }) => {
    await page.goto("/");
    const image = await makeImage(page, 160, 220, "#f6f6f2");
    await page.getByTestId("document-input").setInputFiles([
      { name: "page-1.png", mimeType: "image/png", buffer: image },
      { name: "page-2.png", mimeType: "image/png", buffer: image },
    ]);
    await expect(page.getByTestId("page-surface")).toBeVisible();
    await page.getByTitle("সেটিংস প্যানেল").tap();
    const inspector = page.getByRole("complementary", { name: "এডিটর সেটিংস" });
    await inspector.getByRole("button", { name: "পেজ", exact: true }).tap();
    await inspector.getByRole("button", { name: /পেজ নম্বর/ }).tap();
    const dialog = page.getByRole("dialog", { name: "পেজ নম্বর যোগ করুন" });
    await dialog.getByLabel("পেজ নম্বরের অবস্থান").selectOption("bottom-right");
    await dialog.getByRole("button", { name: "সব পেজে নম্বর বসান" }).tap();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});