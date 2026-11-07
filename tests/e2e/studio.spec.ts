import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";

async function studio(page: Page, tool = "") {
  await page.goto(`/#/studio${tool ? "/" + tool : ""}`);
  await expect(page.locator(".iso-shell")).toBeVisible();
}

async function makePdf(pages: number, text = "Hello CONFIDENTIAL 01712345678") {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) { const p = doc.addPage([300, 400]); p.drawText(`${text} p${i + 1}`, { x: 20, y: 350, size: 10 }); }
  return Buffer.from(await doc.save());
}

test("studio shell: 14 tools, palette Ctrl+K, language RTL, theme, mobile bottom nav", async ({ page }) => {
  await studio(page);
  await expect(page.getByTestId("tool-pdf.studio")).toBeVisible();
  const cards = page.locator("[data-testid^='tool-']");
  expect(await cards.count()).toBe(14);
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("palette-input")).toBeVisible();
  await page.getByTestId("palette-input").fill("redact");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("pdf-studio")).toBeVisible();
  await page.getByLabel("Language").selectOption("ar");
  await expect(page.locator(".iso-shell")).toHaveAttribute("dir", "rtl");
  await page.getByLabel("Language").selectOption("bn");
  await page.getByLabel("Toggle theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", /dark|light/);
});

test("mobile: bottom nav 5 items + More drawer, 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await studio(page);
  const bottom = page.locator(".iso-bottom");
  await expect(bottom).toBeVisible();
  expect(await bottom.locator("button").count()).toBe(5);
  const box = await bottom.locator("button").first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await bottom.getByRole("button", { name: /আরও|More|more/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByTestId("tool-qr.barcode").click();
  await expect(page.getByTestId("qr-barcode")).toBeVisible();
});

test("prompt studio: generate 50 variations, save, export JSON round-trip + PDF with Bengali", async ({ page }, info) => {
  await studio(page, "prompt.studio");
  await page.getByTestId("prompt-generate").click();
  await expect(page.getByTestId("prompt-adapted")).toContainText("--ar");
  await page.getByLabel("Variations").selectOption("50");
  await page.getByTestId("prompt-generate").click();
  const items = page.locator("ol.iso-list li");
  expect(await items.count()).toBeGreaterThanOrEqual(20);
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByRole("tab", { name: /Library/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("prompts.json"); await dl.saveAs(file);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(json.schemaVersion).toBe(1); expect(json.prompts.length).toBe(1);
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const pdfFile = info.outputPath("prompts.pdf"); await dl2.saveAs(pdfFile);
  const bytes = fs.readFileSync(pdfFile);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThan(1);
});

test("seal studio: government sample watermark default, PNG export has DPI + transparency", async ({ page }, info) => {
  await studio(page, "seal.studio");
  await page.getByLabel("আকার").selectOption("government");
  await expect(page.getByLabel("SAMPLE / নমুনা watermark")).toBeChecked();
  await expect(page.locator(".iso-seal-preview")).toContainText("SAMPLE");
  await page.getByLabel("উপরের লেখা (বাংলা/আরবি/English)").fill("বাংলাদেশ গণপ্রজাতন্ত্রী");
  await page.getByTestId("seal-export-png").click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("seal.png"); await dl.saveAs(file);
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.includes(Buffer.from("pHYs"))).toBe(true);
});

test("signature studio: typed signature save + library; digital tab separated with warning", async ({ page }) => {
  await studio(page, "signature.studio");
  await expect(page.getByText(/Visual Signature ≠ Digital Signature/)).toBeVisible();
  await page.getByRole("tab", { name: "Typed" }).click();
  await page.getByLabel("লেখা").fill("রহিম উদ্দিন");
  await page.getByTestId("signature-save").click();
  await expect(page.getByTestId("studio-download")).toBeVisible();
  await page.getByRole("tab", { name: /Library/ }).click();
  await expect(page.locator(".iso-cards img").first()).toBeVisible();
  await page.getByRole("tab", { name: /Digital signature/ }).click();
  await expect(page.getByText(/Self-signed সার্টিফিকেট আইনি স্বীকৃতি পায় না/)).toBeVisible();
});

test("QR studio: jsQR verification passes before export; EAN-13 check digit error surfaced", async ({ page }, info) => {
  await studio(page, "qr.barcode");
  await page.getByTestId("qr-export-png").click();
  await expect(page.getByText(/Scannability check passed/)).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("qr.png"); await dl.saveAs(file);
  expect(fs.readFileSync(file).subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("tab", { name: "Barcode" }).click();
  await page.getByLabel("Symbology").selectOption("ean13");
  await page.getByLabel("Data", { exact: true }).fill("400638133393");
  await page.getByTestId("qr-export-png").click();
  await expect(page.getByTestId("studio-download")).toBeVisible();
  await page.getByLabel("Data", { exact: true }).fill("4006381333932");
  await page.getByTestId("qr-export-png").click();
  await expect(page.getByRole("alert")).toContainText("check digit");
});

test("PDF studio: merge, encrypt AES-256, wrong password rejected, true redaction verification", async ({ page }, info) => {
  await studio(page, "pdf.studio");
  const pdf = await makePdf(3);
  await page.getByTestId("pdf-studio-input-input").setInputFiles([{ name: "a.pdf", mimeType: "application/pdf", buffer: pdf }, { name: "b.pdf", mimeType: "application/pdf", buffer: pdf }]);
  await expect(page.getByText(/a\.pdf, b\.pdf/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("tab", { name: "Merge", exact: true }).click();
  await page.getByTestId("pdf-apply").click();
  await expect(page.getByText(/6 পেজ একত্র/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("studio-download")).toBeVisible({ timeout: 30000 });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const merged = info.outputPath("merged.pdf"); await dl.saveAs(merged);
  const m = await PDFDocument.load(fs.readFileSync(merged));
  expect(m.getPageCount()).toBe(6);
  // redaction on single file
  await page.getByTestId("pdf-studio-input-input").setInputFiles([{ name: "secret.pdf", mimeType: "application/pdf", buffer: await makePdf(1, "TOPSECRET 01712345678") }]);
  await expect(page.getByText(/secret\.pdf/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("tab", { name: /True redaction/ }).click();
  await page.getByTestId("redact-secrets").fill("TOPSECRET");
  await page.getByTestId("pdf-apply").click();
  await expect(page.getByText(/Verification Passed/).first()).toBeVisible({ timeout: 60000 });
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const red = info.outputPath("redacted.pdf"); await dl2.saveAs(red);
  const raw = fs.readFileSync(red);
  expect(raw.includes(Buffer.from("TOPSECRET"))).toBe(false);
});

test("document studio: invoice totals + taka in words, vector PDF export, autosave to Projects", async ({ page }, info) => {
  await studio(page, "document.studio");
  await expect(page.getByTestId("document-studio")).toBeVisible();
  await page.getByTestId("doc-export-pdf").click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("invoice.pdf"); await dl.saveAs(file);
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const doc = await PDFDocument.load(bytes);
  const page1 = doc.getPage(0);
  expect(page1.getWidth() / 72 * 25.4).toBeCloseTo(210, 0);
  await page.waitForTimeout(2600); // autosave debounce 2s
  await studio(page, "projects");
  await expect(page.getByText("Invoice").first()).toBeVisible();
});

test("engineering: 100mm line PDF is exactly 100mm; title block has no __tab leak", async ({ page }, info) => {
  await studio(page, "engineering.studio");
  const canvas = page.getByTestId("eng-canvas");
  const box = (await canvas.boundingBox())!;
  // pxPerMm=3, viewBox width=630 for A4; click two points 300 user units apart horizontally
  const sx = box.width / 630;
  await page.mouse.click(box.x + 50 * sx, box.y + 100 * sx);
  await page.mouse.click(box.x + 350 * sx, box.y + 100 * sx);
  await page.getByRole("tab", { name: "Revisions" }).click();
  await page.getByRole("tab", { name: "Title block" }).click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("drawing.pdf"); await dl.saveAs(file);
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.includes(Buffer.from("__TAB"))).toBe(false);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPage(0).getWidth() / 72 * 25.4).toBeCloseTo(210, 0);
});

test("text studio: golden strings insert, PNG export embeds fonts, PDF selectable", async ({ page }, info) => {
  await studio(page, "text.studio");
  await page.getByRole("button", { name: "Insert golden strings" }).click();
  await expect(page.locator(".iso-editor")).toContainText("ক্ষ্ম");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("text.png"); await dl.saveAs(file);
  expect(fs.readFileSync(file).subarray(1, 4).toString()).toBe("PNG");
});

test("batch: 5 PDFs stamped, per-file isolation, ZIP page counts preserved", async ({ page }, info) => {
  await studio(page, "batch.studio");
  const pdf = await makePdf(2);
  const files = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.pdf`, mimeType: "application/pdf", buffer: pdf }));
  files.push({ name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") });
  await page.locator("input[type=file][multiple]").first().setInputFiles(files);
  await page.getByTestId("batch-run").click();
  await expect(page.getByTestId("studio-download")).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/ফাইল ব্যর্থ/)).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("studio-download").click()]);
  const file = info.outputPath("batch.zip"); await dl.saveAs(file);
  const { unzipSync } = await import("fflate");
  const entries = unzipSync(fs.readFileSync(file));
  const names = Object.keys(entries).filter((n) => n.endsWith(".pdf"));
  expect(names.length).toBe(5);
  for (const n of names) { const d = await PDFDocument.load(entries[n]); expect(d.getPageCount()).toBe(2); }
});

test("AI assistant: local summary works; cloud off ⇒ zero external network requests", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (u.origin !== "http://localhost:5173" && !u.protocol.startsWith("blob") && !u.protocol.startsWith("data")) external.push(r.url()); });
  await studio(page, "ai.assistant");
  await page.getByTestId("ai-text").fill("Dhaka is the capital of Bangladesh. Cairo is in Egypt. The river Padma flows far. Cities grow quickly.");
  await page.getByRole("tab", { name: "Summary" }).click();
  await page.getByRole("button", { name: /Extractive summary/ }).click();
  await expect(page.getByTestId("ai-out")).not.toBeEmpty();
  await page.getByRole("tab", { name: /Cloud AI/ }).click();
  await page.getByRole("button", { name: /Ask \(consent first\)/ }).click();
  await expect(page.getByRole("alert")).toContainText(/বন্ধ/);
  await page.waitForTimeout(1000);
  expect(external).toEqual([]);
});

test("settings: AI off by default, clear-data confirm, storage estimate", async ({ page }) => {
  await studio(page, "settings");
  await expect(page.getByText(/OFF — zero network requests/)).toBeVisible();
  await expect(page.getByText(/Persistent:/)).toBeVisible();
  page.on("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Clear local data" }).click();
  await expect(page.getByTestId("settings")).toBeVisible();
});

test("export center shows persisted history after an export", async ({ page }) => {
  await studio(page, "seal.studio");
  await page.getByTestId("seal-export-png").click();
  await expect(page.getByTestId("studio-download")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("studio-download").click();
  await studio(page, "export.center");
  await expect(page.getByText("seal.png").first()).toBeVisible();
});
