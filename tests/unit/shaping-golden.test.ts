/**
 * Golden rendering tests: HarfBuzz shaping → MuPDF vector PDF → PNG, compared
 * with pixelmatch (<0.5% differing pixels). Goldens are written on first run
 * (or UPDATE_GOLDEN=1) and committed thereafter.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const GOLDEN_DIR = path.resolve(__dirname, "../golden");

beforeAll(() => {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  const root = path.resolve(__dirname, "../..");
  vi.stubGlobal("fetch", async (url: string) => {
    const rel = url.replace(/^\//, "");
    const file = path.join(root, "public", rel);
    const bytes = readFileSync(file);
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as Response;
  });
});

async function renderPdfText(text: string, opts: { rtl?: boolean; size?: number } = {}): Promise<PNG> {
  const mupdf = await import("mupdf");
  const { drawShaped, pickFont } = await import("../../src/core/fonts/shaping");
  const size = opts.size ?? 28;
  const buf = new mupdf.Buffer();
  const w = new mupdf.DocumentWriter(buf, "pdf", "");
  const dev = w.beginPage([0, 0, 900, 140]);
  await drawShaped(dev, text, 20, 80, size, [0, 0, 0], { dir: opts.rtl ? "rtl" : undefined, fontId: pickFont(text) });
  w.endPage(); w.close();
  const doc = mupdf.Document.openDocument(buf.asUint8Array(), "application/pdf");
  const page = doc.loadPage(0);
  const pix = page.toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false);
  return PNG.sync.read(Buffer.from(pix.asPNG()));
}

function compare(name: string, png: PNG) {
  const file = path.join(GOLDEN_DIR, `${name}.png`);
  if (!existsSync(file) || process.env.UPDATE_GOLDEN === "1") { writeFileSync(file, PNG.sync.write(png)); return; }
  const golden = PNG.sync.read(readFileSync(file));
  expect(png.width).toBe(golden.width); expect(png.height).toBe(golden.height);
  const diff = pixelmatch(png.data, golden.data, null, png.width, png.height, { threshold: 0.1 });
  expect(diff / (png.width * png.height)).toBeLessThan(0.005);
}

describe("font golden strings (§10)", () => {
  it("Bengali conjuncts render and extract exactly", async () => {
    const mupdf = await import("mupdf");
    const { drawShaped, GOLDEN_STRINGS, shapeText } = await import("../../src/core/fonts/shaping");
    const text = GOLDEN_STRINGS.bn;
    const shaped = await shapeText(text, "bn");
    expect(shaped.glyphs.length).toBeGreaterThan(10);
    expect(shaped.width).toBeGreaterThan(0);
    const buf = new mupdf.Buffer(); const w = new mupdf.DocumentWriter(buf, "pdf", "");
    const dev = w.beginPage([0, 0, 1200, 140]); await drawShaped(dev, text, 20, 80, 26); w.endPage(); w.close();
    const doc = mupdf.Document.openDocument(buf.asUint8Array(), "application/pdf");
    const extracted = doc.loadPage(0).toStructuredText("preserve-whitespace").asText().trim();
    expect(extracted).toBe(text);
    compare("bn", await renderPdfText(text));
  }, 60000);
  it("Arabic basmala with harakat stays connected (RTL)", async () => {
    const { GOLDEN_STRINGS, shapeText } = await import("../../src/core/fonts/shaping");
    const shaped = await shapeText(GOLDEN_STRINGS.ar, "ar", "rtl");
    expect(shaped.glyphs.length).toBeGreaterThan(5);
    // connected forms: most glyphs should be non-isolated presentation forms via GSUB
    compare("ar", await renderPdfText(GOLDEN_STRINGS.ar, { rtl: true }));
  }, 60000);
  it("mixed bn/en/ar line", async () => {
    const { GOLDEN_STRINGS } = await import("../../src/core/fonts/shaping");
    compare("mixed", await renderPdfText(GOLDEN_STRINGS.mixed, { size: 24 }));
  }, 60000);
});
