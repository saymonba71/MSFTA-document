import * as pdfjs from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker&inline";
import { degrees, PDFDocument } from "pdf-lib";
import { uid } from "../types";

export type PdfSource = { id: string; name: string; bytes: ArrayBuffer };
export type ManagedPage = {
  id: string;
  sourceId: string;
  sourceName: string;
  originalIndex: number;
  thumbnail: string;
  rotation: 0 | 90 | 180 | 270;
  included: boolean;
};

/** Read low-resolution previews separately from the high-resolution editor. */
export async function readPdfPages(files: File[], existingCount = 0, onProgress?: (message: string) => void) {
  if (!files.length) throw new Error("এক বা একাধিক PDF বেছে নিন।");
  if (files.some((f) => f.type !== "application/pdf" && !/\.pdf$/i.test(f.name))) throw new Error("শুধু PDF ফাইল দিন।");
  if (files.some((f) => f.size > 50 * 1024 * 1024)) throw new Error("প্রতিটি PDF ৫০ MB-এর মধ্যে রাখুন।");
  if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  const sources: PdfSource[] = [];
  const pages: ManagedPage[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(`${i + 1} / ${files.length}: ${file.name}`);
    const bytes = await file.arrayBuffer();
    // Refuse encrypted files rather than producing a damaged or incomplete result.
    try { await PDFDocument.load(bytes.slice(0)); }
    catch { throw new Error(`“${file.name}” খোলা যায়নি। পাসওয়ার্ড সরিয়ে আবার চেষ্টা করুন।`); }
    let pdf: pdfjs.PDFDocumentProxy;
    try { pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise; }
    catch { throw new Error(`“${file.name}” প্রিভিউ করা যায়নি।`); }
    const source: PdfSource = { id: uid(), name: file.name, bytes };
    if (existingCount + pages.length + pdf.numPages > 80) {
      await pdf.destroy();
      throw new Error("একবারে সর্বোচ্চ ৮০টি পেজ সাজানো যাবে।");
    }
    try {
      for (let j = 1; j <= pdf.numPages; j++) {
        onProgress?.(`${file.name}: পেজ ${j} / ${pdf.numPages}`);
        const page = await pdf.getPage(j);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1, 280 / Math.max(base.width, base.height)) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        pages.push({ id: uid(), sourceId: source.id, sourceName: source.name, originalIndex: j - 1, thumbnail: canvas.toDataURL("image/jpeg", .82), rotation: 0, included: true });
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
      sources.push(source);
    } finally { await pdf.destroy(); }
  }
  return { sources, pages };
}

/** Copy original PDF page contents, applying the requested order and extra rotation. */
export async function createOrganizedPdf(sources: PdfSource[], pages: ManagedPage[]) {
  const chosen = pages.filter((page) => page.included);
  if (!chosen.length) throw new Error("অন্তত একটি পেজ বেছে নিন।");
  const output = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();
  for (const item of chosen) {
    let original = loaded.get(item.sourceId);
    if (!original) {
      const source = sources.find((s) => s.id === item.sourceId);
      if (!source) throw new Error("মূল PDF পাওয়া যায়নি। আবার ফাইল বেছে নিন।");
      original = await PDFDocument.load(source.bytes.slice(0));
      loaded.set(item.sourceId, original);
    }
    const [copied] = await output.copyPages(original, [item.originalIndex]);
    const finalRotation = ((copied.getRotation().angle + item.rotation) % 360 + 360) % 360;
    copied.setRotation(degrees(finalRotation));
    output.addPage(copied);
  }
  const bytes = await output.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Export each selected page as its own PDF inside a ZIP, keeping original page content. */
export async function createSeparatePdfZip(sources: PdfSource[], pages: ManagedPage[], onProgress?: (message: string) => void) {
  const chosen = pages.filter((page) => page.included);
  if (!chosen.length) throw new Error("অন্তত একটি পেজ বেছে নিন।");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const loaded = new Map<string, PDFDocument>();
  for (let index = 0; index < chosen.length; index++) {
    onProgress?.(`পেজ ${index + 1} / ${chosen.length} তৈরি হচ্ছে...`);
    const item = chosen[index];
    let source = loaded.get(item.sourceId);
    if (!source) {
      const file = sources.find((entry) => entry.id === item.sourceId);
      if (!file) throw new Error("মূল PDF পাওয়া যায়নি। আবার ফাইল বেছে নিন।");
      source = await PDFDocument.load(file.bytes.slice(0));
      loaded.set(item.sourceId, source);
    }
    const output = await PDFDocument.create();
    const [copy] = await output.copyPages(source, [item.originalIndex]);
    copy.setRotation(degrees(((copy.getRotation().angle + item.rotation) % 360 + 360) % 360));
    output.addPage(copy);
    zip.file(`page-${String(index + 1).padStart(3, "0")}.pdf`, await output.save());
  }
  return zip.generateAsync({ type: "blob" });
}