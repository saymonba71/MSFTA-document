import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker&inline";
import { BlendMode, PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import type { Doc, Page, Seal, Stamp } from "../types";
import { loadImage } from "./seal";
import { triggerDownload } from "./download";
import { cachedImage, inkSource, inkValues } from "./ink";
import { groupTextItems } from "./pdfText";
import type { PdfTextItem } from "../types";

let workerReady = false;
function ensureWorker() {
  if (!workerReady) {
    pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
    workerReady = true;
  }
}

export async function loadDocument(
  files: File[],
  onProgress?: (msg: string) => void
): Promise<Doc> {
  if (!files.length) throw new Error("একটি ছবি বা PDF বেছে নিন");
  if (files.length > 40 || files.some((f) => f.size > 50 * 1024 * 1024)) throw new Error("সর্বোচ্চ ৪০টি ছবি, প্রতিটি ৫০ MB-এর মধ্যে দিন");
  const pdfFile = files.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  if (pdfFile && files.length !== 1) throw new Error("একটি PDF অথবা একাধিক ছবি দিন। মিশ্র ফাইলের জন্য ব্যাচ টুল ব্যবহার করুন।");
  if (pdfFile) {
    const file = pdfFile;
    ensureWorker();
    const bytes = await file.arrayBuffer();
    let pdf: pdfjsLib.PDFDocumentProxy;
    try { pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise; }
    catch (error) { throw new Error((error as Error).name === "PasswordException" ? "পাসওয়ার্ড সরিয়ে PDF আবার খুলুন" : "PDF পড়া যাচ্ছে না। অন্য ফাইল দিয়ে চেষ্টা করুন।"); }
    if (pdf.numPages > 100) { await pdf.destroy(); throw new Error("একবারে ১০০ পেজের মধ্যে PDF দিন"); }
    const pages: Page[] = [];
    const textItems: PdfTextItem[] = [];
    try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(`পেজ রেন্ডার হচ্ছে ${i} / ${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(3.5, Math.max(2, 2400 / Math.max(vp1.width, vp1.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      try {
        const content = await page.getTextContent();
        const positioned = content.items.flatMap((raw) => {
          const item = raw as { str?: string; transform?: number[]; width?: number; fontName?: string };
          if (!Array.isArray(item.transform)) return [];
          const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform);
          // The replacement editor currently supports horizontal runs; hiding a vertical
          // run is safer than drawing a cover over unrelated content on a rotated page.
          if (Math.abs(transformed[1]) > Math.abs(transformed[0]) * .35) return [];
          const height = Math.hypot(transformed[2], transformed[3]) || Math.abs(transformed[3]);
          return [{ str: item.str, width: item.width, fontName: item.fontName, height, tx: transformed }];
        });
        textItems.push(...groupTextItems(positioned, { width: canvas.width, height: canvas.height, scale }, i - 1));
      } catch {
        /* A PDF without an extractable text layer can still be stamped. */
      }
      pages.push({
        src: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
    } finally { await pdf.destroy(); }
    return { kind: "pdf", name: file.name, mime: "application/pdf", pages, bytes, textItems };
  }

  const imgs = files.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
  if (imgs.length !== files.length) {
    throw new Error("শুধু ছবি (JPG, PNG, WEBP) অথবা PDF ফাইল আপলোড করুন");
  }
  onProgress?.("ছবি লোড হচ্ছে...");
  const pages: Page[] = [];
  const urls: string[] = [];
  try {
    for (const f of imgs) {
      const src = URL.createObjectURL(f);
      urls.push(src);
      const img = await loadImage(src);
      if (img.naturalWidth * img.naturalHeight > 40_000_000 || Math.max(img.naturalWidth, img.naturalHeight) > 16384) throw new Error("ছবিটি খুব বড়। ৪০ মেগাপিক্সেলের মধ্যে ছোট করে দিন।");
      pages.push({ src, width: img.naturalWidth, height: img.naturalHeight, name: f.name, mime: f.type });
    }
  } catch (error) { urls.forEach((url) => URL.revokeObjectURL(url)); throw error; }
  return {
    kind: "image",
    name: imgs.length > 1 ? `${imgs.length}টি ছবি` : imgs[0].name,
    mime: imgs[0].type,
    pages,
  };
}

/** Export every page of an image document as a ZIP of PNG files. */
export async function exportZip(doc: Doc, stamps: Stamp[], seals: Seal[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const base = baseName(doc.name).replace(/\s+/g, "-");
  for (let i = 0; i < doc.pages.length; i++) {
    const cv = await composePage(doc.pages[i], stamps.filter((s) => s.page === i), seals);
    const blob = await canvasToBlob(cv, "image/png");
    zip.file(`${base}-page${i + 1}.png`, blob);
  }
  return zip.generateAsync({ type: "blob" });
}

const findSeal = (seals: Seal[], id: string) => {
  const seal = seals.find((s) => s.id === id);
  if (!seal) throw new Error("ডকুমেন্টের একটি সিল পাওয়া যাচ্ছে না। সিলটি আবার যোগ করুন।");
  return seal;
};

/** Expands watermark tiles into individual draw positions. Hidden stamps are dropped. */
export function expandForPaint(stamps: Stamp[]): Stamp[] {
  const out: Stamp[] = [];
  for (const s of stamps) {
    if (s.hidden) continue;
    if (!s.tile) {
      out.push(s);
      continue;
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        out.push({
          ...s,
          id: `${s.id}-t${r}${c}`,
          tile: false,
          x: Math.min(0.94, Math.max(0.06, (c + 0.5) / 3 + (s.x - 0.5) * 0.18)),
          y: Math.min(0.94, Math.max(0.06, (r + 0.5) / 4 + (s.y - 0.5) * 0.18)),
          rot: -28 + s.rot,
          opacity: Math.min(s.opacity, 0.2),
          blend: s.blend === "normal" ? "normal" : "ink",
        });
      }
    }
  }
  return out;
}

/** Draw the page with all stamps onto a canvas. */
export async function composePage(
  page: Page,
  stamps: Stamp[],
  seals: Seal[],
  maxSize?: number
): Promise<HTMLCanvasElement> {
  const base = await cachedImage(page.src);
  const scale = maxSize ? Math.min(1, maxSize / Math.max(page.width, page.height)) : 1;
  const W = Math.round(page.width * scale);
  const H = Math.round(page.height * scale);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(base, 0, 0, W, H);
  const painted = expandForPaint(stamps);
  for (const s of painted) {
    const seal = findSeal(seals, s.sealId);
    const img = await inkSource(seal.src, s);
    const sw = s.w * W;
    const sh = sw / seal.aspect;
    ctx.save();
    ctx.translate(s.x * W, s.y * H);
    ctx.rotate((s.rot * Math.PI) / 180);
    ctx.globalAlpha = inkValues(s).opacity;
    ctx.globalCompositeOperation = s.blend === "normal" ? "source-over" : "multiply";
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }
  return cv;
}

export function canvasToBlob(cv: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("এক্সপোর্ট ব্যর্থ"))), type, quality)
  );
}

/** Starts a download and returns the blob URL so the UI can offer a manual fallback link. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = triggerDownload(blob, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return url;
}

/** The uploaded file itself, without any stamp. */
export async function originalFileBlob(doc: Doc, pageIndex = 0): Promise<Blob> {
  if (doc.bytes) return new Blob([doc.bytes as BlobPart], { type: "application/pdf" });
  const page = doc.pages[pageIndex];
  const res = await fetch(page.src);
  if (!res.ok) throw new Error("মূল ফাইলটি পড়া যায়নি");
  return res.blob();
}

/** Current page as a full-resolution PNG. */
export async function pagePng(doc: Doc, stamps: Stamp[], seals: Seal[], pageIdx: number): Promise<Blob> {
  const cv = await composePage(doc.pages[pageIdx], stamps.filter((s) => s.page === pageIdx), seals);
  return canvasToBlob(cv, "image/png");
}

/** Rasterize a seal rotated by `angle` into a transparent PNG; returns bounding-box size in pt. */
async function rasterSeal(img: CanvasImageSource, wPt: number, hPt: number, angle: number, opacity: number, crispText = false) {
  const a = (angle * Math.PI) / 180;
  const bw = Math.abs(wPt * Math.cos(a)) + Math.abs(hPt * Math.sin(a));
  const bh = Math.abs(wPt * Math.sin(a)) + Math.abs(hPt * Math.cos(a));
  const pxPerPt = crispText
    ? Math.min(8, Math.max(4, 2400 / Math.max(bw, bh)))
    : Math.min(6, Math.max(2.5, 1800 / Math.max(bw, bh)));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(bw * pxPerPt));
  cv.height = Math.max(1, Math.ceil(bh * pxPerPt));
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.rotate(a);
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, (-wPt * pxPerPt) / 2, (-hPt * pxPerPt) / 2, wPt * pxPerPt, hPt * pxPerPt);
  const blob = await canvasToBlob(cv, "image/png");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), bw, bh };
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0);
}

const isWinAnsiText = (value: string) => /^[\x20-\x7e\n\r\t]+$/.test(value);

/** Embed stamps into the original PDF (keeps the original quality / text). */
export async function exportPdf(doc: Doc, stamps: Stamp[], seals: Seal[]): Promise<Blob> {
  if (!doc.bytes) throw new Error("PDF ডেটা পাওয়া যায়নি");
  const pdf = await PDFDocument.load(doc.bytes.slice(0), { ignoreEncryption: true });
  const pages = pdf.getPages();
  const cache = new Map<string, { img: PDFImage; bw: number; bh: number }>();

  for (const s of expandForPaint(stamps)) {
    const page = pages[s.page];
    if (!page) continue;
    const seal = findSeal(seals, s.sealId);
    const rot = (((page.getRotation().angle || 0) % 360) + 360) % 360;
    const box = page.getCropBox();
    const { x: x0, y: y0, width: W, height: H } = box;
    const sideways = rot === 90 || rot === 270;
    const viewW = sideways ? H : W;
    const sealW = s.w * viewW;
    const sealH = sealW / seal.aspect;

    let cx: number, cy: number;
    const fx = s.x,
      fy = s.y;
    if (rot === 90) {
      cx = x0 + fy * W;
      cy = y0 + fx * H;
    } else if (rot === 180) {
      cx = x0 + (1 - fx) * W;
      cy = y0 + fy * H;
    } else if (rot === 270) {
      cx = x0 + (1 - fy) * W;
      cy = y0 + (1 - fx) * H;
    } else {
      cx = x0 + fx * W;
      cy = y0 + (1 - fy) * H;
    }

    const angle = s.rot - rot;
    const ink = inkValues(s);

    // For unrotated Latin/number PDF text edits on upright pages, draw true vector text
    // over a clean cover rectangle so zoomed-in PDFs remain razor-sharp and searchable.
    if (s.origin === "pdf-text" && s.edit && rot === 0 && Math.abs(s.rot) < 0.1 && isWinAnsiText(s.edit.text)) {
      const edit = s.edit;
      const fontKey = edit.font === "serif"
        ? (edit.bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman)
        : edit.font === "mono"
          ? (edit.bold ? StandardFonts.CourierBold : StandardFonts.Courier)
          : (edit.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
      const pdfFont = await pdf.embedFont(fontKey);
      const rectX = cx - sealW / 2;
      const rectY = cy - sealH / 2;
      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: sealW,
        height: sealH,
        color: hexToRgb(edit.background || "#ffffff"),
        opacity: ink.opacity,
      });
      const text = edit.text.trim();
      const pad = Math.max(1.5, sealW * 0.012);
      const maxTextW = Math.max(8, sealW - pad * 2);
      const item = doc.textItems?.find((t) => t.id === s.itemId);
      const basePt = item ? item.size * H * 0.9 : sealH * 0.78;
      let fontSize = Math.max(5, basePt * (edit.sizeMultiplier || 1));
      const wrap = (size: number) => {
        const lines: string[] = [];
        for (const para of text.replace(/\r/g, "").split("\n")) {
          const words = para.trim().split(/\s+/).filter(Boolean);
          if (!words.length) { lines.push(""); continue; }
          let row = "";
          for (const word of words) {
            const next = row ? `${row} ${word}` : word;
            if (pdfFont.widthOfTextAtSize(next, size) > maxTextW && row) { lines.push(row); row = word; }
            else row = next;
          }
          if (row) lines.push(row);
        }
        return lines.length ? lines : [""];
      };
      let lines = wrap(fontSize);
      for (let i = 0; i < 18 && (lines.length * fontSize * 1.15 > sealH * 0.96 || lines.some((l) => pdfFont.widthOfTextAtSize(l, fontSize) > maxTextW)); i++) {
        fontSize = Math.max(4.5, fontSize * 0.92);
        lines = wrap(fontSize);
      }
      const lineH = fontSize * 1.15;
      const totalH = lines.length * lineH;
      const firstBaseline = cy + totalH / 2 - fontSize * 0.82;
      const textColor = hexToRgb(edit.color || "#111827");
      lines.forEach((line, idx) => {
        const lineW = pdfFont.widthOfTextAtSize(line, fontSize);
        const tx = edit.align === "center"
          ? cx - lineW / 2
          : edit.align === "right"
            ? rectX + sealW - pad - lineW
            : rectX + pad;
        page.drawText(line, {
          x: tx,
          y: firstBaseline - idx * lineH,
          size: fontSize,
          font: pdfFont,
          color: textColor,
          opacity: ink.opacity,
        });
      });
      continue;
    }

    const isTextLayer = seal.kind === "text" || s.origin === "pdf-text";
    const key = [s.sealId, sealW, sealH, angle, ink.opacity, ink.brightness, ink.contrast, isTextLayer ? "txt" : "seal"].join("|");
    let entry = cache.get(key);
    if (!entry) {
      const img = await inkSource(seal.src, s);
      const r = await rasterSeal(img, sealW, sealH, angle, ink.opacity, isTextLayer);
      entry = { img: await pdf.embedPng(r.bytes), bw: r.bw, bh: r.bh };
      cache.set(key, entry);
    }
    page.drawImage(entry.img, {
      x: cx - entry.bw / 2,
      y: cy - entry.bh / 2,
      width: entry.bw,
      height: entry.bh,
      blendMode: s.blend === "normal" ? undefined : BlendMode.Multiply,
    });
  }
  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/** A new PDF that looks exactly like the screen, including ink blend and watermarks. */
export async function exportFlatPdf(doc: Doc, stamps: Stamp[], seals: Seal[]): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const original = doc.bytes ? await PDFDocument.load(doc.bytes.slice(0)) : null;
  for (let i = 0; i < doc.pages.length; i++) {
    const cv = await composePage(doc.pages[i], stamps.filter((s) => s.page === i), seals, 2200);
    const blob = await canvasToBlob(cv, "image/jpeg", 0.9);
    const img = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const source = original?.getPage(i);
    const crop = source?.getCropBox();
    const sideways = !!source && Math.abs(source.getRotation().angle % 180) === 90;
    const width = crop ? (sideways ? crop.height : crop.width) : doc.pages[i].width * 72 / 150;
    const height = crop ? (sideways ? crop.width : crop.height) : doc.pages[i].height * 72 / 150;
    const page = pdf.addPage([width, height]);
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/** Applies one page's stamp layout to many files and returns a ZIP. */
export async function stampMany(
  files: File[],
  pattern: Stamp[],
  seals: Seal[],
  allPages: boolean,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (!pattern.length) throw new Error("আগে একটা পেজে সিল বসান");
  if (files.length > 40) throw new Error("একবারে সর্বোচ্চ ৪০টি ফাইল");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(`${i + 1} / ${files.length} — ${file.name}`);
    const doc = await loadDocument([file]);
    const stamped = doc.pages.flatMap((_, page) =>
      !allPages && page !== 0 ? [] : pattern.map((s) => ({ ...s, id: `${s.id}-${page}-${i}`, page }))
    );
    const base = `${String(i + 1).padStart(2, "0")}-${baseName(doc.name).replace(/[\\/:*?"<>|\s]+/g, "-")}`;
    try {
    if (doc.kind === "pdf") {
      zip.file(`${base}-sealed.pdf`, await exportPdf(doc, stamped, seals));
    } else {
      for (let p = 0; p < doc.pages.length; p++) {
        const cv = await composePage(doc.pages[p], stamped.filter((s) => s.page === p), seals);
        zip.file(`${base}${doc.pages.length > 1 ? `-p${p + 1}` : ""}-sealed.png`, await canvasToBlob(cv, "image/png"));
      }
    }
    } finally { if (doc.kind === "image") doc.pages.forEach((pg) => URL.revokeObjectURL(pg.src)); }
  }
  return zip.generateAsync({ type: "blob" });
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "document";
}

export type TemplateKind = "certificate" | "blueprint" | "invoice" | "noc";

/** Creates an instant document or engineering sheet so the user can work immediately. */
export async function makeSampleDoc(kind: TemplateKind = "certificate"): Promise<Doc> {
  try {
    await Promise.all([
      document.fonts.load('700 58px "Hind Siliguri"'),
      document.fonts.load('600 34px "Hind Siliguri"'),
      document.fonts.load('500 34px "Hind Siliguri"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* older browsers: fall through */
  }
  const W = 1500;
  const H = 1051;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;

  if (kind === "blueprint") {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, W, H);
    // Fine technical engineering grid
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let x = 50; x < W - 50; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, H - 50); ctx.stroke();
    }
    for (let y = 50; y < H - 50; y += 50) {
      ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 50, y); ctx.stroke();
    }
    // Outer sheet border
    ctx.strokeStyle = "#0f2a6b";
    ctx.lineWidth = 6;
    ctx.strokeRect(44, 44, W - 88, H - 88);
    // Architectural plan geometry
    ctx.lineWidth = 4;
    ctx.strokeRect(140, 160, 760, 560);
    ctx.strokeRect(140, 160, 380, 280);
    ctx.strokeRect(520, 160, 380, 280);
    ctx.strokeRect(140, 440, 520, 280);
    // Dimension lines
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(140, 118); ctx.lineTo(900, 118);
    ctx.moveTo(140, 104); ctx.lineTo(140, 132);
    ctx.moveTo(900, 104); ctx.lineTo(900, 132);
    ctx.stroke();
    ctx.fillStyle = "#be123c";
    ctx.font = '700 24px "Inter", monospace';
    ctx.textAlign = "center";
    ctx.fillText("24.00 m (GROUND FLOOR PLAN)", 520, 104);

    ctx.fillStyle = "#0f2a6b";
    ctx.font = '700 20px "Inter", sans-serif';
    ctx.fillText("HALL ROOM A (12m × 8.5m)", 330, 305);
    ctx.fillText("CONTROL BAY B (12m × 8.5m)", 710, 305);
    ctx.fillText("MAIN PRODUCTION FLOOR (16.5m × 8.5m)", 400, 585);

    // Engineering title block on bottom-right
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(940, 580, 516, 427);
    ctx.strokeStyle = "#0f2a6b";
    ctx.lineWidth = 4;
    ctx.strokeRect(940, 580, 516, 427);
    for (const y of [660, 740, 820, 910]) {
      ctx.beginPath(); ctx.moveTo(940, y); ctx.lineTo(1456, y); ctx.stroke();
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#0f2a6b";
    ctx.font = '800 28px "Inter", sans-serif';
    ctx.fillText("BANGLADESH DEV. AUTHORITY", 964, 630);
    ctx.font = '700 21px "Inter", sans-serif';
    ctx.fillText("PROJECT: STRUCTURAL LAYOUT SHEET", 964, 710);
    ctx.fillText("DWG NO: BD-STR-2026-104 · SCALE 1:100", 964, 790);
    ctx.fillText("ENGINEER: SAYMON HASAN", 964, 875);
    ctx.fillText("STAMP & APPROVAL:", 964, 960);

    const src = cv.toDataURL("image/png");
    return {
      kind: "image",
      name: "ইঞ্জিনিয়ারিং-ড্রয়িং",
      mime: "image/png",
      pages: [{ src, width: W, height: H }],
      textItems: [
        { id: "text-0-0", page: 0, text: "BANGLADESH DEV. AUTHORITY", x: 1180 / W, y: 620 / H, w: 450 / W, h: 42 / H, size: 28 / H, bold: true },
        { id: "text-0-1", page: 0, text: "PROJECT: STRUCTURAL LAYOUT SHEET", x: 1185 / W, y: 700 / H, w: 460 / W, h: 36 / H, size: 24 / H, bold: true },
        { id: "text-0-2", page: 0, text: "DWG NO: BD-STR-2026-104   SCALE: 1:100", x: 1190 / W, y: 780 / H, w: 470 / W, h: 36 / H, size: 24 / H, bold: true },
        { id: "text-0-3", page: 0, text: "ENGINEER: SAYMON HASAN", x: 1150 / W, y: 865 / H, w: 390 / W, h: 36 / H, size: 24 / H, bold: true },
      ],
    };
  }

  if (kind === "invoice") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0f2a6b";
    ctx.fillRect(60, 60, W - 120, 120);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.font = '800 44px "Inter", sans-serif';
    ctx.fillText("OFFICIAL INVOICE & WORK VOUCHER", 95, 135);
    ctx.textAlign = "right";
    ctx.font = '700 28px "Inter", monospace';
    ctx.fillText("INV #2026-0892", W - 95, 132);

    ctx.textAlign = "left";
    ctx.fillStyle = "#1e293b";
    ctx.font = '700 30px "Hind Siliguri", sans-serif';
    ctx.fillText("প্রতিষ্ঠান: বাংলাদেশ ডেভেলপমেন্ট প্রজেক্ট", 95, 255);
    ctx.fillText("গ্রাহক / প্রাপক: সায়মন হাসান", 95, 305);

    // Table header
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(85, 360, W - 170, 64);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(85, 360, W - 170, 360);
    ctx.fillStyle = "#0f2a6b";
    ctx.font = '700 26px "Hind Siliguri", sans-serif';
    ctx.fillText("বিবরণ (Description)", 115, 402);
    ctx.fillText("পরিমাণ", 980, 402);
    ctx.fillText("মোট টাকা", 1220, 402);

    const items = [
      ["১. স্ট্রাকচারাল ডিজাইন ও ড্রয়িং যাচাই", "০১ টি", "২৫,০০০ ৳"],
      ["২. সাইট ইন্সপেকশন ও অনুমোদন সনদ", "০১ টি", "১৫,০০০ ৳"],
      ["৩. সর্বমোট পরিশোধযোগ্য (Total Payable)", "", "৪০,০০০ ৳"],
    ];
    items.forEach(([desc, qty, amt], idx) => {
      const y = 480 + idx * 90;
      ctx.fillStyle = idx === 2 ? "#0f2a6b" : "#334155";
      ctx.font = `${idx === 2 ? 700 : 500} 28px "Hind Siliguri", sans-serif`;
      ctx.fillText(desc, 115, y);
      ctx.fillText(qty, 980, y);
      ctx.fillText(amt, 1220, y);
    });

    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(115, H - 150); ctx.lineTo(440, H - 150);
    ctx.moveTo(W - 460, H - 150); ctx.lineTo(W - 115, H - 150);
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.font = '600 26px "Hind Siliguri", sans-serif';
    ctx.fillText("হিসাবরক্ষক", 220, H - 110);
    ctx.fillText("অনুমোদনকারী ও অফিসিয়াল সিল", W - 430, H - 110);

    const src = cv.toDataURL("image/png");
    return {
      kind: "image",
      name: "অফিসিয়াল-ইনভয়েস",
      mime: "image/png",
      pages: [{ src, width: W, height: H }],
    };
  }

  if (kind === "noc") {
    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#0f2a6b";
    ctx.lineWidth = 6;
    ctx.strokeRect(50, 50, W - 100, H - 100);
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f2a6b";
    ctx.font = '700 48px "Hind Siliguri", sans-serif';
    ctx.fillText("অনাপত্তি ও চূড়ান্ত অনুমোদন পত্র (NOC)", W / 2, 165);
    ctx.fillStyle = "#475569";
    ctx.font = '600 26px "Inter", sans-serif';
    ctx.fillText("REF NO: BD/NOC/2026/409 · OFFICIAL CLEARANCE", W / 2, 215);

    ctx.textAlign = "left";
    ctx.fillStyle = "#1e293b";
    ctx.font = '500 32px "Hind Siliguri", sans-serif';
    ctx.fillText("প্রত্যয়ন করা যাচ্ছে যে, প্রস্তাবিত প্রকল্প ও কারিগরি নকশা যথাযথভাবে যাচাই করা হয়েছে।", 130, 350);
    ctx.fillText("নির্ধারিত মানদণ্ড অনুযায়ী কাজ সম্পাদনের জন্য চূড়ান্ত অনুমোদন প্রদান করা হলো।", 130, 415);
    ctx.fillStyle = "#0f2a6b";
    ctx.font = '700 36px "Hind Siliguri", sans-serif';
    ctx.fillText("প্রকল্প প্রধান: সায়মন হাসান (রেজি. নং ২০২৩-২০২৬)", 130, 520);

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(130, H - 160); ctx.lineTo(460, H - 160);
    ctx.moveTo(W - 480, H - 160); ctx.lineTo(W - 130, H - 160);
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.font = '600 28px "Hind Siliguri", sans-serif';
    ctx.fillText("তারিখ ও স্মারক", 220, H - 115);
    ctx.fillText("চূড়ান্ত অনুমোদন সিল ও স্বাক্ষর", W - 450, H - 115);

    const src = cv.toDataURL("image/png");
    return {
      kind: "image",
      name: "অনুমোদন-পত্র-NOC",
      mime: "image/png",
      pages: [{ src, width: W, height: H }],
    };
  }

  // Default: Certificate ("নমুনা-সনদ")
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#0f2a6b";
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 3;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f2a6b";
  ctx.font = "600 58px 'Hind Siliguri', sans-serif";
  ctx.fillText("প্রশিক্ষণ সম্পন্ন প্রত্যয়নপত্র", W / 2, 175);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 28px Georgia, serif";
  ctx.fillText("C E R T I F I C A T E   O F   C O M P L E T I O N", W / 2, 232);
  ctx.fillStyle = "#334155";
  ctx.font = "500 34px 'Hind Siliguri', sans-serif";
  ctx.fillText("এতদ্বারা জানানো যাইতেছে যে,", W / 2, 340);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 240, 448);
  ctx.lineTo(W / 2 + 240, 448);
  ctx.stroke();
  ctx.fillStyle = "#0f2a6b";
  ctx.font = "600 52px 'Hind Siliguri', sans-serif";
  ctx.fillText("সাইমুন হাসান", W / 2, 430);
  ctx.fillStyle = "#334155";
  ctx.font = "500 34px 'Hind Siliguri', sans-serif";
  ctx.fillText("নির্ধারিত সময়ের মধ্যে সফলভাবে প্রশিক্ষণ সম্পন্ন করেছেন", W / 2, 520);
  ctx.fillText("এবং এই প্রত্যয়ন গ্রহণের যোগ্যতা অর্জন করেছেন।", W / 2, 575);
  const y0 = H - 150;
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(150, y0);
  ctx.lineTo(470, y0);
  ctx.moveTo(W - 470, y0);
  ctx.lineTo(W - 150, y0);
  ctx.stroke();
  ctx.fillStyle = "#475569";
  ctx.font = "600 28px 'Hind Siliguri', sans-serif";
  ctx.fillText("তারিখ", 310, y0 + 42);
  ctx.fillText("স্বাক্ষর ও সিল", W - 310, y0 + 42);
  const src = cv.toDataURL("image/jpeg", 0.95);
  return { kind: "image", name: "নমুনা-সনদ", mime: "image/jpeg", pages: [{ src, width: W, height: H }] };
}
