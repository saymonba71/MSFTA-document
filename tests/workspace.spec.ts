import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import jsQR from "jsqr";
import JSZip from "jszip";
import fs from "node:fs/promises";

async function documentWithPages(widths: number[], rotatedIndex = -1) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  widths.forEach((width, index) => {
    const page = pdf.addPage([width, 600]);
    page.drawText(`Source page ${index + 1}`, { x: 30, y: 540, size: 18, font });
    if (index === rotatedIndex) page.setRotation(degrees(90));
  });
  return Buffer.from(await pdf.save());
}

test("merge, select, reorder, rotate and download real PDF pages", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /PDF পেজ সাজান/ }).click();
  const dialog = page.getByRole("dialog", { name: "PDF পেজ সাজান" });
  await dialog.getByTestId("organizer-input").setInputFiles([
    { name: "alpha.pdf", mimeType: "application/pdf", buffer: await documentWithPages([300, 310, 320], 1) },
    { name: "beta.pdf", mimeType: "application/pdf", buffer: await documentWithPages([410, 420]) },
  ]);
  await expect(dialog.locator(".organizer-page")).toHaveCount(5, { timeout: 25000 });
  await dialog.getByRole("button", { name: "alpha.pdf পেজ 2 আগে সরান" }).click();
  await dialog.getByRole("checkbox", { name: "alpha.pdf পেজ 1 অন্তর্ভুক্ত" }).uncheck();
  await dialog.getByRole("button", { name: "alpha.pdf পেজ 2 ঘোরান" }).click();
  await expect(dialog.getByText("4টি পেজ নির্বাচিত")).toBeVisible();
  await dialog.getByRole("button", { name: "সাজানো PDF তৈরি করুন" }).click();
  await expect(dialog.getByTestId("download-file")).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog.getByTestId("download-file").click();
  const download = await pending;
  const filename = info.outputPath("organized.pdf");
  await download.saveAs(filename);
  expect(download.suggestedFilename()).toBe("organized-document.pdf");
  const result = await PDFDocument.load(await fs.readFile(filename));
  expect(result.getPages().map((p) => p.getWidth())).toEqual([310, 320, 410, 420]);
  expect(result.getPages().map((p) => p.getRotation().angle)).toEqual([180, 0, 0, 0]);
  expect(errors).toEqual([]);
});

test("page organizer operates on the current edited PDF without closing the editor", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("document-input").setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: await documentWithPages([300, 320]) });
  await expect(page.getByTestId("page-surface")).toBeVisible();
  await page.getByRole("complementary", { name: "এডিটর সেটিংস" }).getByRole("button", { name: "পেজ", exact: true }).click();
  await page.getByRole("button", { name: /বর্তমান সিলসহ পেজ বাছাই/ }).click();
  const dialog = page.getByRole("dialog", { name: "PDF পেজ সাজান" });
  await expect(dialog.locator(".organizer-page")).toHaveCount(2, { timeout: 25000 });
  await dialog.getByRole("checkbox", { name: /পেজ 2 অন্তর্ভুক্ত/ }).uncheck();
  await dialog.getByRole("button", { name: "সাজানো PDF তৈরি করুন" }).click();
  await expect(dialog.getByTestId("download-file")).toBeVisible();
  await dialog.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  await expect(page.getByTestId("page-surface")).toBeVisible();
  await expect(page.locator("[data-stamp]")).toHaveCount(1);
});

test("page organizer can append files and undo individual changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /PDF পেজ সাজান/ }).click();
  const dialog = page.getByRole("dialog", { name: "PDF পেজ সাজান" });
  const input = dialog.getByTestId("organizer-input");
  await input.setInputFiles({ name: "first.pdf", mimeType: "application/pdf", buffer: await documentWithPages([300, 320]) });
  await expect(dialog.locator(".organizer-page")).toHaveCount(2);
  await input.setInputFiles({ name: "more.pdf", mimeType: "application/pdf", buffer: await documentWithPages([400]) });
  await expect(dialog.locator(".organizer-page")).toHaveCount(3);
  const check = dialog.getByRole("checkbox", { name: "first.pdf পেজ 2 অন্তর্ভুক্ত" });
  await check.uncheck();
  await expect(dialog.getByText("2টি পেজ নির্বাচিত")).toBeVisible();
  await dialog.getByRole("button", { name: "ফিরুন", exact: true }).click();
  await expect(check).toBeChecked();
  await expect(dialog.getByText("3টি পেজ নির্বাচিত")).toBeVisible();
});

test("selected PDF pages can be split into individual PDFs in a ZIP", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: /PDF পেজ সাজান/ }).click();
  const dialog = page.getByRole("dialog", { name: "PDF পেজ সাজান" });
  await dialog.getByTestId("organizer-input").setInputFiles({ name: "pages.pdf", mimeType: "application/pdf", buffer: await documentWithPages([300, 320, 340], 1) });
  await expect(dialog.locator(".organizer-page")).toHaveCount(3);
  await dialog.getByRole("checkbox", { name: "pages.pdf পেজ 1 অন্তর্ভুক্ত" }).uncheck();
  await dialog.getByRole("button", { name: "pages.pdf পেজ 2 ঘোরান" }).click();
  await dialog.getByLabel("PDF আউটপুটের ধরন").selectOption("zip");
  await dialog.getByRole("button", { name: "আলাদা পেজের ZIP তৈরি করুন" }).click();
  await expect(dialog.getByTestId("download-file")).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog.getByTestId("download-file").click();
  const download = await pending;
  const path = info.outputPath("pages.zip");
  await download.saveAs(path);
  expect(download.suggestedFilename()).toBe("organized-document.zip");
  const zip = await JSZip.loadAsync(await fs.readFile(path));
  expect(Object.keys(zip.files)).toEqual(["page-001.pdf", "page-002.pdf"]);
  const first = await PDFDocument.load(await zip.file("page-001.pdf")!.async("uint8array"));
  const secondBytes = await zip.file("page-002.pdf")!.async("uint8array");
  const second = await PDFDocument.load(secondBytes);
  expect(first.getPageCount()).toBe(1);
  expect(first.getPage(0).getWidth()).toBe(320);
  expect(first.getPage(0).getRotation().angle).toBe(180);
  expect(second.getPage(0).getWidth()).toBe(340);
  const preservedText = await page.evaluate(async (bytes) => {
    const path = "/src/lib/doc.ts";
    const { loadDocument } = await import(path);
    const document = await loadDocument([new File([new Uint8Array(bytes)], "split.pdf", { type: "application/pdf" })]);
    return document.textItems.map((item: { text: string }) => item.text).join(" ");
  }, Array.from(secondBytes));
  expect(preservedText).toContain("Source page 3");
});

test("QR is truly scannable and encodes the user's exact URL", async ({ page }) => {
  const content = "https://example.org/document?id=789";
  await page.goto("/");
  await page.getByTestId("nav-tools").click();
  await page.getByRole("button", { name: /QR কোড তৈরি/ }).click();
  const dialog = page.getByRole("dialog", { name: "ইঞ্জিনিয়ারিং ও ডকুমেন্ট টুলস" });
  await expect(dialog.getByText(/QR কোড নিজে নথির সত্যতা প্রমাণ করে না/)).toBeVisible();
  await dialog.getByLabel("QR-এ থাকা লিংক বা লেখা").fill(content);
  await dialog.getByRole("button", { name: "স্ক্যানযোগ্য QR বসান" }).click();
  const chosen = page.locator('[data-seal-id][aria-pressed="true"] img');
  await expect(chosen).toBeVisible();
  const pixels = await chosen.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 384; canvas.height = 384;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
  const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  expect(decoded?.data).toBe(content);
  // The white quiet zone must also survive when the QR is added to an actual document.
  await page.getByTestId("nav-home").click();
  await page.getByRole("button", { name: "নমুনা দিয়ে চেষ্টা", exact: true }).click();
  await expect(page.getByTestId("page-surface")).toBeVisible();
  await expect(page.getByText(/QR পড়ার জন্য সাদা ব্যাকগ্রাউন্ড/)).toBeVisible();
  await page.getByRole("button", { name: "সেভ", exact: true }).click();
  await page.getByRole("button", { name: "ফাইল তৈরি করুন", exact: true }).click();
  const link = page.getByTestId("download-file");
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const exported = await page.evaluate(async (url) => {
    const image = new Image(); image.src = url!; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 360; canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 1005, 620, 360, 360, 0, 0, 360, 360);
    return Array.from(ctx.getImageData(0, 0, 360, 360).data);
  }, href);
  expect(jsQR(new Uint8ClampedArray(exported), 360, 360)?.data).toBe(content);
});

test("cover boxes clearly explain they are not secure redaction", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-tools").click();
  await page.getByRole("button", { name: /ইঞ্জিনিয়ারিং ব্লক/ }).click();
  const dialog = page.getByRole("dialog", { name: "ইঞ্জিনিয়ারিং ও ডকুমেন্ট টুলস" });
  await dialog.getByRole("tab", { name: "ঢাকনা ও মার্কআপ" }).click();
  await expect(dialog.getByRole("note")).toContainText("গোপন তথ্য সরানোর জন্য এটি ব্যবহার করবেন না");
});

test("QR requires actual content and reports oversized UTF-8 data", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-tools").click();
  await page.getByRole("button", { name: /QR কোড তৈরি/ }).click();
  const dialog = page.getByRole("dialog", { name: "ইঞ্জিনিয়ারিং ও ডকুমেন্ট টুলস" });
  const submit = dialog.getByRole("button", { name: "স্ক্যানযোগ্য QR বসান" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("QR-এ থাকা লিংক বা লেখা").fill("ক".repeat(300));
  await submit.click();
  await expect(dialog.getByRole("alert")).toContainText("৬০০ বাইট");
  await expect(dialog).toBeVisible();
});

test("image-only PDFs explain why text editing is unavailable", async ({ page }) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  await page.goto("/");
  await page.getByTestId("pdf-input").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
  const dialog = page.getByRole("dialog", { name: "PDF লেখা এডিট" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/স্ক্যান করা ছবি/)).toBeVisible();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("workspace navigation and page tools are usable without overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-home")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId("nav-tools").tap();
    await page.getByRole("button", { name: /PDF পেজ সাজান ও একত্র করুন/ }).tap();
    const dialog = page.getByRole("dialog", { name: "PDF পেজ সাজান" });
    await dialog.getByTestId("organizer-input").setInputFiles({ name: "mobile.pdf", mimeType: "application/pdf", buffer: await documentWithPages([300, 310]) });
    await expect(dialog.locator(".organizer-page")).toHaveCount(2, { timeout: 25000 });
    await dialog.getByRole("button", { name: "mobile.pdf পেজ 2 ঘোরান" }).tap();
    await dialog.getByRole("button", { name: "সাজানো PDF তৈরি করুন" }).tap();
    await expect(dialog.getByTestId("download-file")).toBeVisible();
  });
});