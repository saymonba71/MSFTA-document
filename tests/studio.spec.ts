import { test, expect, type Page, type Locator } from "@playwright/test";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import JSZip from "jszip";
import fs from "node:fs/promises";

async function start(page: Page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "নমুনা দিয়ে চেষ্টা", exact: true }).click();
  await expect(page.getByTestId("page-surface")).toBeVisible();
}

async function setRange(locator: Locator, value: string) {
  await locator.evaluate((el: HTMLInputElement, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function prepare(page: Page, format = "png", name = "stamp-result") {
  await page.getByRole("button", { name: "সেভ", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "সেভ ও ডাউনলোড" });
  await expect(modal.getByAltText("ডাউনলোড প্রিভিউ")).toBeVisible();
  await modal.getByLabel("ফাইলের নাম", { exact: false }).fill(name);
  await modal.getByLabel("ফাইলের ধরন", { exact: true }).selectOption(format);
  await modal.getByRole("button", { name: "ফাইল তৈরি করুন", exact: true }).click();
  await expect(modal.getByTestId("download-file")).toBeVisible();
  return modal;
}

async function download(page: Page, file: string) {
  const pending = page.waitForEvent("download");
  await page.getByTestId("download-file").click();
  const result = await pending;
  await result.saveAs(file);
  expect(await result.failure()).toBeNull();
  return result;
}

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const angle of [0, 90, 180, 270]) {
    const p = pdf.addPage([330, 460]);
    p.setCropBox(15, 20, 300, 420); p.setRotation(degrees(angle));
    p.drawRectangle({ x: 15, y: 20, width: 300, height: 420, color: rgb(.86, .9, .93) });
    p.drawText(`Original text ${angle}`, { x: 45, y: 390, size: 16, font });
  }
  return Array.from(await pdf.save());
}

test("ink presets, brightness, contrast, reset and history work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const ink = page.getByRole("group", { name: "সিলের আলো ও কালি", exact: true });
  await ink.getByRole("button", { name: "হালকা", exact: true }).click();
  await expect(ink.getByRole("slider", { name: "কালির গাঢ়তা", exact: true })).toHaveValue("45");
  await expect(page.locator("[data-painted]").first()).toHaveCSS("opacity", "0.45");
  await ink.getByRole("button", { name: "গাঢ়", exact: true }).click();
  await expect(ink.getByRole("slider", { name: "উজ্জ্বলতা", exact: true })).toHaveValue("70");
  await expect(page.locator("[data-painted]").first()).toHaveCSS("filter", "brightness(0.7) contrast(1.2)");
  await page.keyboard.press("Control+z");
  await expect(ink.getByRole("slider", { name: "কালির গাঢ়তা", exact: true })).toHaveValue("45");
  await page.keyboard.press("Control+Shift+z");
  await expect(ink.getByRole("slider", { name: "উজ্জ্বলতা", exact: true })).toHaveValue("70");
  await setRange(ink.getByRole("slider", { name: "উজ্জ্বলতা", exact: true }), "134");
  await expect(page.locator("[data-painted]").first()).toHaveCSS("filter", "brightness(1.34) contrast(1.2)");
  await ink.getByRole("button", { name: "সাধারণ", exact: true }).click();
  await expect(page.locator("[data-painted]").first()).toHaveCSS("mix-blend-mode", "normal");
  await ink.getByRole("button", { name: "রিসেট", exact: true }).click();
  await expect(page.locator("[data-painted]").first()).toHaveCSS("filter", "brightness(1) contrast(1)");
  await expect(page.locator("[data-painted]").first()).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});

test("comparison does not modify layers or remove them from export", async ({ page }, info) => {
  await start(page);
  await page.getByTitle("মূল ছবি দেখুন").click();
  await expect(page.locator("[data-painted]")).toHaveCount(0);
  const modal = await prepare(page, "project");
  const file = info.outputPath("result.sealproject");
  const result = await download(page, file);
  expect(result.suggestedFilename()).toBe("stamp-result.sealproject");
  const project = JSON.parse(await fs.readFile(file, "utf8"));
  expect(project.stamps).toHaveLength(1);
  await modal.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  await page.getByTitle("মূল ছবি দেখুন").click();
  await expect(page.locator("[data-painted]")).toHaveCount(1);
});

test("downloaded PNG has the requested name and real image bytes", async ({ page }, info) => {
  await start(page);
  await prepare(page, "png", "final-certificate");
  const file = info.outputPath("download.png");
  const result = await download(page, file);
  expect(result.suggestedFilename()).toBe("final-certificate.png");
  const bytes = await fs.readFile(file);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(1500);
  expect(bytes.readUInt32BE(20)).toBe(1051);
  expect(bytes.length).toBeGreaterThan(10000);
});

test("Bengali filename retains a safe filename and extension", async ({ page }, info) => {
  await start(page);
  await prepare(page, "jpg", "আমার সনদ");
  const result = await download(page, info.outputPath("document.jpg"));
  expect(result.suggestedFilename()).toBe("document.jpg");
  const bytes = await fs.readFile(info.outputPath("document.jpg"));
  expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
});

test("copy, share and cancelled Save As never start unwanted downloads", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { copies: 0, shares: 0 };
    (window as any).actionState = state;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: async () => { state.copies++; } } });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { state.shares++; } });
    (window as any).showSaveFilePicker = async () => { throw new DOMException("Cancelled", "AbortError"); };
  });
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await start(page);
  const modal = await prepare(page);
  await modal.getByText("না নামলে অন্যভাবে সেভ করুন", { exact: true }).click();
  await modal.getByRole("button", { name: "ছবি কপি", exact: true }).click();
  await modal.getByRole("button", { name: "শেয়ার", exact: true }).click();
  await modal.getByRole("button", { name: "সেভের স্থান বাছুন", exact: true }).click();
  await expect(modal.getByRole("status")).toContainText("সেভ বাতিল");
  expect(await page.evaluate(() => (window as any).actionState)).toEqual({ copies: 1, shares: 1 });
  expect(downloads).toEqual([]);
});

test("opening a generated image keeps the editor in its original tab", async ({ page }) => {
  await start(page);
  const modal = await prepare(page);
  await modal.getByText("না নামলে অন্যভাবে সেভ করুন", { exact: true }).click();
  const url = page.url();
  const popupPromise = page.context().waitForEvent("page");
  await modal.getByTestId("open-result").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(page.url()).toBe(url);
  await expect(page.getByTestId("page-surface")).toBeAttached();
  expect(popup.url()).toMatch(/^blob:/);
  await popup.close();
});

test("locked layers do not resize or move, and custom seals activate on save", async ({ page }) => {
  await start(page);
  const layer = page.locator("[data-stamp]").first();
  await page.getByTitle("লক করুন", { exact: true }).click();
  const before = await layer.getAttribute("style");
  await layer.click(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Delete");
  await layer.hover(); await page.mouse.wheel(0, -180);
  await expect(layer).toHaveAttribute("style", before!);
  await page.getByTitle("আনলক", { exact: true }).click();
  await page.locator(".workspace-library > summary").click();
  await page.getByRole("button", { name: "কাস্টমাইজ", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "সিল কাস্টমাইজ করুন" });
  await modal.getByRole("button", { name: /ডিজাইন D/ }).click();
  await modal.getByRole("button", { name: "সেভ করুন", exact: true }).click();
  await expect(page.locator('[data-seal-option="builtin-svg"]')).toHaveAttribute("aria-pressed", "true");
  const rect = (await layer.boundingBox())!;
  expect(rect.width / rect.height).toBeCloseTo(1000 / 620, 1);
});

test("ink settings survive project export and restore", async ({ page }, info) => {
  await start(page);
  const ink = page.getByRole("group", { name: "সিলের আলো ও কালি", exact: true });
  await ink.getByRole("button", { name: "গাঢ়", exact: true }).click();
  const modal = await prepare(page, "project", "edited-document");
  const file = info.outputPath("edited.sealproject");
  await download(page, file);
  const project = JSON.parse(await fs.readFile(file, "utf8"));
  expect(project.stamps[0]).toMatchObject({ brightness: 70, contrast: 120, opacity: 1 });
  await modal.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("ফিরে যান").click();
  await page.getByTestId("project-input").setInputFiles(file);
  await expect(page.locator("[data-painted]").first()).toHaveCSS("filter", "brightness(0.7) contrast(1.2)");
});

test("on-screen blending and PNG export produce matching ink pixels", async ({ page }, info) => {
  await start(page);
  const ink = page.getByRole("group", { name: "সিলের আলো ও কালি", exact: true });
  await setRange(ink.getByRole("slider", { name: "উজ্জ্বলতা", exact: true }), "160");
  await setRange(ink.getByRole("slider", { name: "কনট্রাস্ট", exact: true }), "80");
  await setRange(ink.getByRole("slider", { name: "কালির গাঢ়তা", exact: true }), "67");
  const modal = await prepare(page, "project", "pixel-test");
  const file = info.outputPath("pixels.sealproject");
  await download(page, file);
  const project = JSON.parse(await fs.readFile(file, "utf8"));
  await modal.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  const screenshot = await page.getByTestId("page-paint").screenshot();
  const error = await page.evaluate(async ({ project, screenshot }) => {
    const module = "/src/lib/doc.ts";
    const { composePage } = await import(module);
    const image = new Image(); image.src = `data:image/png;base64,${screenshot}`; await image.decode();
    const reference = await composePage(project.doc.pages[0], project.stamps, project.seals, Math.max(image.naturalWidth, image.naturalHeight));
    const actual = document.createElement("canvas"); actual.width = reference.width; actual.height = reference.height;
    actual.getContext("2d")!.drawImage(image, 0, 0, actual.width, actual.height);
    const a = reference.getContext("2d").getImageData(0, 0, actual.width, actual.height).data;
    const b = actual.getContext("2d")!.getImageData(0, 0, actual.width, actual.height).data;
    const stamp = project.stamps[0];
    const half = stamp.w * actual.width * .4;
    const cx = stamp.x * actual.width, cy = stamp.y * actual.height;
    let sum = 0, count = 0;
    for (let y = Math.ceil(cy - half); y < cy + half; y++) for (let x = Math.ceil(cx - half); x < cx + half; x++) {
      const offset = (y * actual.width + x) * 4;
      for (let c = 0; c < 3; c++) { sum += Math.abs(a[offset + c] - b[offset + c]); count++; }
    }
    return sum / count;
  }, { project, screenshot: screenshot.toString("base64") });
  // The on-screen canvas is ~1050 px while the export is 1500 px; multiply blending
  // over anti-aliased dark text leaves sub-pixel differences below 3% per channel.
  expect(error).toBeLessThan(8);
  await page.screenshot({ path: "artifacts/desktop-ink-final.png" });
});

test("drag and resize remain reversible after tone adjustments", async ({ page }) => {
  await start(page);
  await page.getByRole("group", { name: "সিলের আলো ও কালি", exact: true }).getByRole("button", { name: "হালকা", exact: true }).click();
  const layer = page.locator("[data-stamp]").first();
  const before = await layer.getAttribute("style");
  const bounds = (await layer.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 110, bounds.y + bounds.height / 2 - 70, { steps: 10 });
  await page.mouse.up();
  const moved = await layer.getAttribute("style");
  expect(moved).not.toBe(before);
  await page.keyboard.press("Control+z");
  await expect(layer).toHaveAttribute("style", before!);
  await page.keyboard.press("Control+Shift+z");
  await expect(layer).toHaveAttribute("style", moved!);
  const handle = (await layer.locator('[data-resize="-right-3 -bottom-3"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + 65, handle.y + 55, { steps: 10 }); await page.mouse.up();
  expect((await layer.boundingBox())!.width).toBeGreaterThan(bounds.width + 30);
  await page.keyboard.press("Control+z");
  await expect(layer).toHaveAttribute("style", moved!);
  await expect(page.locator("[data-painted]").first()).toHaveCSS("opacity", "0.45");
});

for (const allowDownloads of [true, false]) {
  test(`sandbox preview ${allowDownloads ? "allows" : "blocks"} downloads without losing the editor`, async ({ page }, info) => {
    await page.route("**/preview-host", (route) => route.fulfill({ contentType: "text/html", body: `<html><body style="margin:0"><iframe style="width:100vw;height:100vh;border:0" src="/" sandbox="allow-scripts allow-same-origin ${allowDownloads ? "allow-downloads" : ""}"></iframe></body></html>` }));
    await page.goto("/preview-host");
    const frame = page.frameLocator("iframe");
    await frame.getByRole("button", { name: "নমুনা দিয়ে চেষ্টা", exact: true }).click();
    await frame.getByRole("button", { name: "সেভ", exact: true }).click();
    await frame.getByRole("button", { name: "ফাইল তৈরি করুন", exact: true }).click();
    const link = frame.getByTestId("download-file");
    await expect(link).toBeVisible();
    await expect(frame.locator(".download-note")).toContainText("প্রিভিউ ফ্রেমে");
    if (allowDownloads) {
      const pending = page.waitForEvent("download");
      await link.click();
      const result = await pending;
      await result.saveAs(info.outputPath("sandbox.png"));
      expect(result.suggestedFilename()).toMatch(/\.png$/);
      expect(await result.failure()).toBeNull();
    } else {
      const downloads: string[] = [];
      page.on("download", (d) => downloads.push(d.url()));
      await link.click(); await page.waitForTimeout(600);
      expect(downloads).toHaveLength(0);
    }
    await expect(frame.getByTestId("page-surface")).toBeAttached();
    expect(page.url()).toContain("/preview-host");
  });
}

test("PDF export matches ink on rotated pages and preserves original text", async ({ page }) => {
  await page.goto("/");
  const bytes = await makePdf();
  const result = await page.evaluate(async (bytes) => {
    const module = "/src/lib/doc.ts";
    const { loadDocument, exportPdf, composePage, exportFlatPdf } = await import(module);
    const doc = await loadDocument([new File([new Uint8Array(bytes)], "rotated.pdf", { type: "application/pdf" })]);
    const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#6868d1"; ctx.fillRect(0, 0, 50, 80); ctx.fillStyle = "#ea6576"; ctx.fillRect(50, 0, 50, 80);
    const seals = [{ id: "sample", name: "Sample", src: canvas.toDataURL(), aspect: 1.25 }];
    const stamps = doc.pages.map((_: unknown, i: number) => ({ id: String(i), page: i, sealId: "sample", x: .65, y: .65, w: .2, rot: 15, opacity: .7, brightness: 65, contrast: 135, blend: "ink" }));
    const pdf = await exportPdf(doc, stamps, seals);
    const actualDoc = await loadDocument([new File([pdf], "result.pdf", { type: "application/pdf" })]);
    const diffs = [];
    for (let i = 0; i < 4; i++) {
      const expected = await composePage(doc.pages[i], [stamps[i]], seals, 800);
      const actual = await composePage(actualDoc.pages[i], [], seals, 800);
      const a = expected.getContext("2d").getImageData(0, 0, expected.width, expected.height).data;
      const b = actual.getContext("2d").getImageData(0, 0, actual.width, actual.height).data;
      let delta = 0; let count = 0;
      for (let y = Math.floor(expected.height * .45); y < expected.height * .85; y++) {
        for (let x = Math.floor(expected.width * .45); x < expected.width * .85; x++) {
          const offset = (y * expected.width + x) * 4;
          for (let c = 0; c < 3; c++) { delta += Math.abs(a[offset + c] - b[offset + c]); count++; }
        }
      }
      diffs.push(delta / count);
    }
    const pdfjsPath = "/node_modules/.vite/deps/pdfjs-dist.js";
    const pdfjs = await import(pdfjsPath);
    pdfjs.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
    const textDoc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
    const page = await textDoc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((item: { str?: string }) => item.str ?? "").join(" ");
    await textDoc.destroy();
    const flat = await exportFlatPdf(doc, stamps, seals);
    return { diffs, text, pdf: Array.from(new Uint8Array(await pdf.arrayBuffer())), flat: Array.from(new Uint8Array(await flat.arrayBuffer())) };
  }, bytes);
  result.diffs.forEach((error: number) => expect(error).toBeLessThan(6));
  expect(result.text).toContain("Original text 0");
  const pdf = await PDFDocument.load(new Uint8Array(result.pdf));
  expect(pdf.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 180, 270]);
  const flat = await PDFDocument.load(new Uint8Array(result.flat));
  expect(flat.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([[300, 420], [420, 300], [300, 420], [420, 300]]);
});

test("original export keeps the current page MIME type and batch keeps duplicate names", async ({ page }, info) => {
  await page.goto("/");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#ddd"; ctx.fillRect(0, 0, 800, 600); return c.toDataURL();
  });
  const image = { name: "same.png", mimeType: "image/png", buffer: Buffer.from(png.split(",")[1], "base64") };
  await page.getByTestId("document-input").setInputFiles([image, image]);
  await page.getByTitle("পরের পেজ").click();
  const modal = await prepare(page, "original", "source");
  const filename = info.outputPath("original.png");
  const result = await download(page, filename);
  expect(result.suggestedFilename()).toBe("source-original-page-2.png");
  expect((await fs.readFile(filename)).equals(image.buffer)).toBe(true);
  await modal.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  const zipBytes = await page.evaluate(async (png) => {
    const module = "/src/lib/doc.ts";
    const { stampMany } = await import(module);
    const image = await (await fetch(png)).blob();
    const stamp = { id: "s", page: 0, sealId: "test", x: .5, y: .5, w: .2, rot: 0, opacity: .7, brightness: 75, contrast: 120 };
    const zip = await stampMany([new File([image], "same.png", { type: "image/png" }), new File([image], "same.png", { type: "image/png" })], [stamp], [{ id: "test", name: "Test", src: png, aspect: 800 / 600 }], false);
    return Array.from(new Uint8Array(await zip.arrayBuffer()));
  }, png);
  const zip = await JSZip.loadAsync(new Uint8Array(zipBytes));
  expect(Object.keys(zip.files)).toEqual(["01-same-sealed.png", "02-same-sealed.png"]);
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("page fits, pinch works, and ink remains editable above the keyboard area", async ({ page }) => {
    await start(page);
    const fits = () => page.evaluate(() => {
      const p = document.querySelector('[data-testid="page-surface"]')!.getBoundingClientRect();
      const v = document.querySelector('[data-testid="viewport"]')!.getBoundingClientRect();
      return p.x >= v.x && p.y >= v.y && p.right <= v.right + 1 && p.bottom <= v.bottom + 1 && Math.abs(p.y + p.height / 2 - (v.y + v.height / 2)) < 2;
    });
    expect(await fits()).toBe(true);
    await page.screenshot({ path: "artifacts/mobile-fit.png" });
    const layer = page.locator("[data-stamp]").first();
    const rect = (await layer.boundingBox())!;
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: x - 12, y }, { id: 2, x: x + 12, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: x - 22, y }, { id: 2, x: x + 22, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await layer.boundingBox())!.width).toBeGreaterThan(rect.width * 1.4);
    await page.getByRole("button", { name: "আলো ও কালি খুলুন", exact: true }).tap();
    await page.waitForTimeout(250);
    expect(await fits()).toBe(true);
    await page.getByRole("group", { name: "সিলের আলো ও কালি", exact: true }).getByRole("button", { name: "হালকা", exact: true }).tap();
    await expect(page.locator("[data-painted]").first()).toHaveCSS("opacity", "0.45");
    await page.screenshot({ path: "artifacts/mobile-ink-panel.png" });
    await page.getByRole("button", { name: "সেটিংস বন্ধ করুন", exact: true }).tap();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(150);
    expect(await fits()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of ["লেখা", "স্বাক্ষর", "তারিখ"]) {
      const bounds = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
  });
});
test("PDF text is detected, red validation appears, and edits are applied and reversible", async ({ page }) => {
  await page.goto("/");
  const pdf = await PDFDocument.create();
  const p = await pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  p.drawText("CERTIFICATE OF RECOGNITION", { x: 80, y: 730, size: 26, font });
  p.drawText("This certificate is awarded to", { x: 95, y: 650, size: 14, font });
  p.drawText("Saymon Hasan", { x: 160, y: 600, size: 24, font });
  await page.getByTestId("pdf-input").setInputFiles({ name: "certificate.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
  const modal = page.getByRole("dialog", { name: "PDF লেখা এডিট" });
  await expect(modal).toBeVisible();
  const lines = modal.locator(".pdftext-line");
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText("CERTIFICATE OF RECOGNITION");
  // Boxes cover the real text, not the whole page.
  const sizes = await modal.locator(".pdftext-box").evaluateAll((elements) => elements.map((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })));
  const preview = (await modal.locator(".pdftext-preview").boundingBox())!;
  sizes.forEach(({ w, h }) => { expect(w).toBeLessThan(preview.width * .9); expect(h).toBeLessThan(preview.height * .08); });
  await lines.nth(1).click();
  const box = modal.locator(".pdftext-field textarea");
  await expect(box).toBeVisible();
  await box.fill("This certificate is awarded to our respected colleague with great pride and honor for an outstanding contribution to the programme");
  await expect(modal.locator(".pdftext-box.has-issue")).toHaveCount(1);
  await expect(modal.locator(".pdftext-errors")).toContainText("ভুল");
  await expect(modal.locator(".pdftext-apply")).toBeEnabled();
  await modal.locator(".pdftext-apply").click();
  await expect(modal.locator(".pdftext-message")).toContainText("লেখা নথিতে বসানো হয়েছে");
  await modal.getByRole("button", { name: "এডিট বন্ধ করুন", exact: true }).click();
  await expect(modal.locator(".pdftext-line.is-edited")).toHaveCount(1);
  await modal.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  await expect(page.getByTestId("page-surface")).toBeVisible();
  // The default seal plus the edited text patch.
  await expect(page.locator("[data-painted]")).toHaveCount(2);
  // Re-open and revert.
  await page.getByTestId("pdf-text-button").click();
  const again = page.getByRole("dialog", { name: "PDF লেখা এডিট" });
  await again.locator(".pdftext-line").nth(1).click();
  await again.getByRole("button", { name: "মূল অবস্থায় ফেরান", exact: true }).click();
  await again.getByRole("button", { name: "বন্ধ করুন", exact: true }).click();
  await expect(page.locator("[data-painted]")).toHaveCount(1);
});

test("the app navigation switches useful workspace sections", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const [id, text] of [["nav-search", "আপনার সিল"], ["nav-tools", "ডকুমেন্ট টুলস"], ["nav-saved", "সংরক্ষিত"], ["nav-home", "নথির কাজ"]] as const) {
    await page.getByTestId(id).click();
    await expect(page.locator("main")).toContainText(text);
    await expect(page.getByTestId(id)).toHaveAttribute("aria-current", "page");
  }
  await page.getByTestId("nav-search").click();
  await page.getByLabel("সিলের নাম খুঁজুন").fill("পতাকা");
  await expect(page.getByRole("heading", { name: /সিল/ })).toContainText("সিল");
  await page.getByLabel("সিলের নাম খুঁজুন").fill("কোনো-নেই");
  await expect(page.locator("main")).toContainText("পাওয়া যায়নি");
});

test("engineering blueprint template, grid overlay, and approval/dimension stamps work", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByTestId("nav-tools").click();
  await page.getByText("নমুনা নথি দিয়ে অনুশীলন করুন").click();
  await page.getByRole("button", { name: /ড্রয়িং শিট/ }).click();
  await expect(page.getByTestId("page-surface")).toBeVisible();
  await page.getByTestId("grid-toggle").click();
  await expect(page.getByTestId("engineering-grid")).toBeVisible();
  await page.getByTestId("eng-tools-button").click();
  const dialog = page.getByRole("dialog", { name: "ইঞ্জিনিয়ারিং ও ডকুমেন্ট টুলস" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /FOR CONSTRUCTION/ }).click();
  await dialog.getByRole("button", { name: /ইঞ্জিনিয়ারিং ব্লক বসান/ }).click();
  await expect(page.locator("[data-stamp]")).toHaveCount(2);
  await page.getByTestId("eng-tools-button").click();
  await dialog.getByRole("tab", { name: "মাপের নোট" }).click();
  await dialog.getByRole("button", { name: /মাপজোক লাইন বসান/ }).click();
  await expect(page.locator("[data-stamp]")).toHaveCount(3);
});
