import type { Doc, Page, PdfTextItem, Seal, Stamp } from "../types";

export type PositionedTextItem = { str?: string; tx: number[]; width?: number; height?: number; fontName?: string };
export type TextAlign = "left" | "center" | "right";
export type TextFont = "sans" | "serif" | "mono";
export type TextEdit = {
  itemId: string;
  text: string;
  sizeMultiplier: number;
  color: string;
  background: string;
  bold: boolean;
  font?: TextFont;
  align?: TextAlign;
  padding?: number;
};
export type TextIssue = { itemId: string; message: string; kind: "text" | "size" | "contrast" | "punctuation" };

export const TEXT_FONTS: Record<TextFont, { label: string; css: string }> = {
  sans: { label: "পরিষ্কার (Sans)", css: '"Hind Siliguri", "Inter", system-ui, sans-serif' },
  serif: { label: "দাপ্তরিক (Serif)", css: '"Noto Serif Bengali", Georgia, "Times New Roman", serif' },
  mono: { label: "সমমাপ (Mono)", css: 'ui-monospace, "Courier New", monospace' },
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const looksBold = (fontName?: string) => !!fontName && /bold|black|heavy|demi|semi|700|800|900/i.test(fontName);
const inferFont = (fontName?: string): TextFont => fontName && /times|serif|georgia|roman|garamond/i.test(fontName)
  ? "serif"
  : fontName && /courier|mono|consol/i.test(fontName) ? "mono" : "sans";

/**
 * Converts PDF.js text runs into editable lines in rendered-page coordinates.
 * Widths are scaled into viewport space, and small descender/ascender padding is included
 * so the replacement patch covers the original glyphs cleanly without looking oversized.
 */
export function groupTextItems(items: PositionedTextItem[], viewport: { width: number; height: number; scale: number }, page: number): PdfTextItem[] {
  const raw: Array<{ text: string; x: number; y: number; w: number; h: number; fontSize: number; fontName?: string }> = [];
  for (const value of items) {
    const text = value.str?.replace(/\s+/g, " ").trim();
    if (!text || !Array.isArray(value.tx) || !isFiniteNumber(value.tx[4]) || !isFiniteNumber(value.tx[5])) continue;
    const fontSize = Math.max(6, value.height && value.height > 0 ? value.height : Math.hypot(value.tx[2], value.tx[3]) || 12);
    const scaledWidth = Math.abs(value.width ?? 0) * viewport.scale;
    const estimated = text.length * fontSize * 0.5;
    const width = Math.max(6, Math.min(scaledWidth > 1 ? scaledWidth : estimated, viewport.width * 0.94));
    // PDF.js tx[5] is the text baseline in canvas coordinates (top-left origin).
    // Reserve ~82% above the baseline for ascenders and ~26% below for descenders/matras.
    const top = value.tx[5] - fontSize * 0.84;
    const boxHeight = fontSize * 1.14;
    raw.push({ text, x: value.tx[4], y: top, w: width, h: boxHeight, fontSize, fontName: value.fontName });
  }
  raw.sort((one, two) => (Math.abs(one.y - two.y) < Math.min(one.h, two.h) * 0.55 ? one.x - two.x : one.y - two.y));

  const lines: Array<{ texts: string[]; x1: number; x2: number; y1: number; y2: number; fontSize: number; fontName?: string }> = [];
  for (const part of raw) {
    const previous = lines[lines.length - 1];
    const sameLine = previous && Math.abs(part.y - previous.y1) < Math.max(previous.fontSize * 1.14, part.h) * 0.58;
    const gap = previous ? part.x - previous.x2 : 0;
    const near = previous && gap >= -part.fontSize * 0.6 && gap <= Math.max(previous.fontSize, part.fontSize) * 2.2;
    if (previous && sameLine && near) {
      const joiner = gap > Math.max(previous.fontSize, part.fontSize) * 0.16 && !previous.texts[previous.texts.length - 1].endsWith(" ") ? " " : "";
      previous.texts.push(`${joiner}${part.text}`);
      previous.x1 = Math.min(previous.x1, part.x);
      previous.x2 = Math.max(previous.x2, part.x + part.w);
      previous.y1 = Math.min(previous.y1, part.y);
      previous.y2 = Math.max(previous.y2, part.y + part.h);
      previous.fontSize = Math.max(previous.fontSize, part.fontSize);
      if (!previous.fontName && part.fontName) previous.fontName = part.fontName;
    } else {
      lines.push({ texts: [part.text], x1: part.x, x2: part.x + part.w, y1: part.y, y2: part.y + part.h, fontSize: part.fontSize, fontName: part.fontName });
    }
  }

  return lines
    .map((line, index) => {
      const text = line.texts.join("").replace(/\s{2,}/g, " ").trim();
      const padX = Math.max(2, line.fontSize * 0.12);
      const padY = Math.max(1.5, line.fontSize * 0.08);
      const x1 = Math.max(0, line.x1 - padX);
      const y1 = Math.max(0, line.y1 - padY);
      const width = Math.min(viewport.width - x1, Math.max(8, line.x2 - line.x1 + padX * 2));
      const height = Math.min(viewport.height - y1, Math.max(8, line.y2 - line.y1 + padY * 2));
      return {
        id: `text-${page}-${index}`,
        page,
        text,
        x: Math.min(1, Math.max(0, (x1 + width / 2) / viewport.width)),
        y: Math.min(1, Math.max(0, (y1 + height / 2) / viewport.height)),
        w: Math.min(1, width / viewport.width),
        h: Math.min(1, height / viewport.height),
        size: Math.min(0.25, line.fontSize / viewport.height),
        fontName: line.fontName,
        bold: looksBold(line.fontName),
      };
    })
    .filter((item) => item.text.length > 0)
    .slice(0, 220);
}

export function defaultTextEdit(item: PdfTextItem): TextEdit {
  return {
    itemId: item.id,
    text: item.text,
    sizeMultiplier: 1,
    color: "#111827",
    background: "#ffffff",
    bold: item.bold ?? false,
    font: inferFont(item.fontName),
    align: "left",
    padding: 1,
  };
}

const contrast = (foreground: string, background: string) => {
  const channel = (hex: string, index: number) => {
    const clean = hex.replace("#", "").padEnd(6, "0");
    const value = parseInt(clean.slice(index * 2, index * 2 + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const one = luminance(foreground);
  const two = luminance(background);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
};

let measuring: CanvasRenderingContext2D | undefined;
function measureText(value: string, font: string) {
  if (!measuring) measuring = document.createElement("canvas").getContext("2d")!;
  measuring.font = font;
  return measuring.measureText(value).width;
}

export function layoutEditedLines(text: string, maxWidth: number, font: string): { lines: string[]; widest: number } {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  let widest = 0;
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let row = "";
    for (const word of words) {
      const candidate = row ? `${row} ${word}` : word;
      if (measureText(candidate, font) > maxWidth && row) {
        widest = Math.max(widest, measureText(row, font));
        lines.push(row);
        row = word;
      } else {
        row = candidate;
      }
    }
    if (row) {
      widest = Math.max(widest, measureText(row, font));
      lines.push(row);
    }
  }
  return { lines: lines.length ? lines : [""], widest };
}

/** Validation runs on the live draft, so mistakes are visible in red before they are applied. */
export function validateTextEdit(item: PdfTextItem, edit: TextEdit, page: Page): TextIssue[] {
  const issues: TextIssue[] = [];
  const raw = edit.text ?? "";
  const text = raw.trim();
  if (!text) issues.push({ itemId: item.id, message: "নতুন লেখাটি খালি আছে। মূল লেখা ফেরাতে চাইলে “মূল অবস্থায় ফেরান” চাপুন।", kind: "text" });
  if (text && !/[\p{L}\p{N}]/u.test(text)) issues.push({ itemId: item.id, message: "লেখায় কোনো অক্ষর বা সংখ্যা নেই।", kind: "text" });
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"], ["“", "”"]]) {
    const opens = text.split(open).length - 1;
    const closes = text.split(close).length - 1;
    if (opens !== closes) issues.push({ itemId: item.id, message: `বন্ধনী বা কোটেশন মেলেনি: ${open}${close}`, kind: "punctuation" });
  }
  if (/\b(\p{L}+)\s+\1\b/iu.test(text)) issues.push({ itemId: item.id, message: "একই শব্দ পরপর দুবার লেখা হয়েছে।", kind: "text" });
  if (/[^\S\n]{2,}/.test(raw)) issues.push({ itemId: item.id, message: "শব্দের মাঝে অতিরিক্ত ফাঁকা জায়গা আছে।", kind: "text" });
  if (contrast(edit.color, edit.background) < 3.2) issues.push({ itemId: item.id, message: "লেখার রঙ ব্যাকগ্রাউন্ডের সঙ্গে মিশে যাচ্ছে — পড়া কঠিন হবে।", kind: "contrast" });

  const basePxW = Math.max(16, item.w * page.width);
  // Single-line edits can safely expand up to 45% wider (staying inside page margins) before wrapping.
  const maxExpandW = Math.min(page.width * 0.9, basePxW * 1.45);
  const pxHeight = Math.max(10, item.h * page.height);
  const fontSize = Math.max(6, item.size * page.height * 0.9 * edit.sizeMultiplier);
  const family = TEXT_FONTS[edit.font ?? "sans"].css;
  const font = `${edit.bold ? 700 : 500} ${fontSize}px ${family}`;
  const { lines, widest } = layoutEditedLines(text, maxExpandW, font);
  const neededHeight = lines.length * fontSize * 1.15;
  if (widest > maxExpandW * 1.01) issues.push({ itemId: item.id, message: "লেখাটি বক্সের ডান দিকে বেরিয়ে যাচ্ছে। আকার কমান বা লাইন ভাঙুন।", kind: "size" });
  if (neededHeight > pxHeight * 1.18) issues.push({ itemId: item.id, message: "লেখা বক্সের নিচে কেটে যাবে। “বক্সে ফিট” চাপুন বা আকার কমান।", kind: "size" });
  return issues;
}

/** Calculates a size multiplier that fits the edited text comfortably inside its original box. */
export function fitSizeMultiplier(item: PdfTextItem, edit: TextEdit, page: Page): number {
  const text = edit.text.trim();
  if (!text) return 1;
  const pxWidth = Math.max(16, item.w * page.width * 0.95);
  const pxHeight = Math.max(10, item.h * page.height * 0.96);
  const base = Math.max(6, item.size * page.height * 0.92);
  const family = TEXT_FONTS[edit.font ?? "sans"].css;
  for (let mult = 1.15; mult >= 0.45; mult -= 0.03) {
    const size = base * mult;
    const font = `${edit.bold ? 700 : 500} ${size}px ${family}`;
    const { lines, widest } = layoutEditedLines(text, pxWidth, font);
    if (widest <= pxWidth && lines.length * size * 1.15 <= pxHeight) {
      return Math.round(mult * 100) / 100;
    }
  }
  return 0.5;
}

export function validateStamps(doc: Doc, pageIndex: number, stamps: Stamp[]) {
  const issues: Array<{ id: string; message: string }> = [];
  const layers = stamps.filter((s) => s.page === pageIndex && !s.hidden);
  for (const stamp of layers) {
    const width = stamp.w;
    const height = stamp.h ?? width;
    if (stamp.origin === "pdf-text" && !stamp.edit?.text.trim()) continue;
    if (stamp.x - width / 2 < -0.005 || stamp.x + width / 2 > 1.005 || stamp.y - height / 2 < -0.005 || stamp.y + height / 2 > 1.005) {
      issues.push({ id: stamp.id, message: "স্তরটি নথির সীমানার বাইরে যাচ্ছে। টেনে ভেতরে আনুন।" });
    }
    if (width * doc.pages[pageIndex].width < 24) issues.push({ id: stamp.id, message: "স্তরটি খুব ছোট, ডাউনলোডে স্পষ্ট দেখা যাবে না।" });
    if (stamp.opacity < 0.18) issues.push({ id: stamp.id, message: "কালি প্রায় অদৃশ্য; প্রয়োজন না হলে গাঢ় করুন।" });
  }
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      const one = layers[i];
      const two = layers[j];
      if (Math.abs(one.x - two.x) < 0.015 && Math.abs(one.y - two.y) < 0.015) {
        issues.push({ id: two.id, message: "একই জায়গায় দুটি স্তর বসে আছে। একটি সরান বা মুছুন।" });
      }
    }
  }
  return issues;
}

/**
 * Renders an ultra-crisp 4× supersampled text replacement patch.
 * Font size is calibrated to the actual PDF text height so unchanged text matches the original weight and scale.
 */
export async function makeTextPatch(item: PdfTextItem, page: Page, edit: TextEdit): Promise<{ seal: Seal; w: number; h: number }> {
  const family = TEXT_FONTS[edit.font ?? "sans"].css;
  const weight = edit.bold ? 700 : 500;
  try {
    await document.fonts?.load(`${weight} 36px ${family}`);
    await document.fonts?.ready;
  } catch {
    /* continue with available fonts */
  }

  const basePxW = Math.max(18, item.w * page.width);
  const baseFontPx = Math.max(7, item.size * page.height * 0.9 * edit.sizeMultiplier);
  const probeFont = `${weight} ${baseFontPx}px ${family}`;
  const initial = layoutEditedLines(edit.text.trim(), basePxW * 0.96, probeFont);
  const fullLineW = measureText(edit.text.trim().replace(/\s+/g, " "), probeFont);
  // If a replacement word/name is wider than the original word, expand the patch box up to 45%
  // (within page margins) before shrinking the font, so edited names stay sharp at full size.
  const neededW = Math.min(page.width * 0.9, Math.max(basePxW, Math.min(basePxW * 1.45, Math.max(initial.widest, fullLineW) + baseFontPx * 0.5)));
  const finalWFrac = Math.min(0.96, neededW / page.width);
  const finalHFrac = item.h;

  const supersample = 4;
  const width = Math.min(3600, Math.max(360, Math.round(finalWFrac * page.width * supersample)));
  const height = Math.min(1800, Math.max(96, Math.round(finalHFrac * page.height * supersample)));
  const scaleY = height / (finalHFrac * page.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Cover the original PDF text completely with the sampled paper colour.
  ctx.fillStyle = edit.background;
  ctx.fillRect(0, 0, width, height);

  const padX = Math.max(4, width * 0.012);
  let fontSize = Math.max(10, item.size * page.height * 0.9 * edit.sizeMultiplier * scaleY);
  let lineHeight = fontSize * 1.15;
  let lines = layoutEditedLines(edit.text.trim(), width - padX * 2, `${weight} ${fontSize}px ${family}`).lines;
  for (let step = 0; step < 22 && (lines.length * lineHeight > height * 0.96 || lines.some((l) => measureText(l, `${weight} ${fontSize}px ${family}`) > width - padX * 2)); step++) {
    fontSize = Math.max(9, fontSize * 0.92);
    lineHeight = fontSize * 1.15;
    lines = layoutEditedLines(edit.text.trim(), width - padX * 2, `${weight} ${fontSize}px ${family}`).lines;
  }

  ctx.font = `${weight} ${fontSize}px ${family}`;
  ctx.fillStyle = edit.color;
  ctx.textBaseline = "middle";
  const align = edit.align ?? "left";
  ctx.textAlign = align;
  const anchorX = align === "center" ? width / 2 : align === "right" ? width - padX : padX;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, anchorX, startY + index * lineHeight, width - padX * 2);
  });

  return {
    seal: {
      id: `patch-${item.id}-${Date.now()}`,
      name: `টেক্সট: ${edit.text.trim().slice(0, 22) || "এডিট"}`,
      src: canvas.toDataURL("image/png"),
      aspect: width / height,
      kind: "text",
      text: edit.text,
      color: edit.color,
      background: edit.background,
    },
    w: finalWFrac,
    h: finalHFrac,
  };
}

/** Samples the perimeter around a text box so the cover patch matches the paper, not the dark ink. */
export async function sampleBackground(img: HTMLImageElement, item: PdfTextItem, page: Page): Promise<string> {
  const boxW = Math.max(10, item.w * page.width);
  const boxH = Math.max(8, item.h * page.height);
  const pad = Math.max(4, boxH * 0.35);
  const sx = Math.max(0, item.x * page.width - boxW / 2 - pad);
  const sy = Math.max(0, item.y * page.height - boxH / 2 - pad);
  const sw = Math.min(page.width - sx, boxW + pad * 2);
  const sh = Math.min(page.height - sy, boxH + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 36;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 72, 36);
  const pixels = ctx.getImageData(0, 0, 72, 36).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number; lum: number }>();
  for (let y = 0; y < 36; y++) {
    for (let x = 0; x < 72; x++) {
      // Prefer border ring pixels where paper background is visible instead of glyph strokes.
      const onBorder = x < 9 || x > 62 || y < 6 || y > 29;
      if (!onBorder) continue;
      const index = (y * 72 + x) * 4;
      if (pixels[index + 3] < 200) continue;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const key = `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, lum };
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const best = [...buckets.values()].sort((one, two) => two.count - one.count)[0];
  if (!best) return "#ffffff";
  const hex = (value: number) => Math.round(value / best.count).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

/** Samples the darkest ink pixels inside a PDF text box so replacement text matches the original ink colour. */
export async function sampleInkColor(img: HTMLImageElement, item: PdfTextItem, page: Page): Promise<string> {
  const boxW = Math.max(8, item.w * page.width);
  const boxH = Math.max(6, item.h * page.height);
  const sx = Math.max(0, item.x * page.width - boxW / 2);
  const sy = Math.max(0, item.y * page.height - boxH / 2);
  const sw = Math.min(page.width - sx, boxW);
  const sh = Math.min(page.height - sy, boxH);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 64, 24);
  const pixels = ctx.getImageData(0, 0, 64, 24).data;
  const dark: Array<{ r: number; g: number; b: number; lum: number }> = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 175) dark.push({ r, g, b, lum });
  }
  if (!dark.length) return "#111827";
  dark.sort((a, b) => a.lum - b.lum);
  const sample = dark.slice(0, Math.max(4, Math.floor(dark.length * 0.35)));
  const avg = sample.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), { r: 0, g: 0, b: 0 });
  const hex = (value: number) => Math.round(value / sample.length).toString(16).padStart(2, "0");
  return `#${hex(avg.r)}${hex(avg.g)}${hex(avg.b)}`;
}
