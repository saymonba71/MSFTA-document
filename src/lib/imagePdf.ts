import { PDFDocument } from "pdf-lib";
import { loadImage } from "./seal";
import { uid } from "../types";

export type ImagePdfLayout = "a4" | "original";
export type ImagePdfItem = { id: string; file: File; src: string; width: number; height: number };
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const isSupported = (file: File) => /^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

/** Validate every file before appending; invalid selections are never silently discarded. */
export async function readImagePdfItems(files: File[], existing: number): Promise<ImagePdfItem[]> {
  if (!files.length) return [];
  if (files.length + existing > 40) throw new Error("একবারে সর্বোচ্চ ৪০টি ছবি যোগ করুন।");
  if (files.some((file) => !isSupported(file))) throw new Error("শুধু JPG, PNG অথবা WEBP ছবি যোগ করুন।");
  if (files.some((file) => !file.size || file.size > 50 * 1024 * 1024)) throw new Error("প্রতিটি ছবি ৫০ MB-এর মধ্যে রাখুন।");
  const urls: string[] = [];
  const items: ImagePdfItem[] = [];
  try {
    for (const file of files) {
      const src = URL.createObjectURL(file);
      urls.push(src);
      const image = await loadImage(src);
      const { naturalWidth: width, naturalHeight: height } = image;
      if (!width || !height || width * height > 40_000_000 || Math.max(width, height) > 16384) {
        throw new Error(`“${file.name}” খুব বড়। ৪০ মেগাপিক্সেলের মধ্যে ছবি দিন।`);
      }
      items.push({ id: uid(), file, src, width, height });
    }
    return items;
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("ছবিটি প্রস্তুত করা যায়নি।")), type, quality));
}

/** Draw each browser-decoded image once so EXIF orientation and transparent PNGs are handled consistently. */
export async function makeImagePdf(items: ImagePdfItem[], layout: ImagePdfLayout, onProgress?: (message: string) => void): Promise<Blob> {
  if (!items.length) throw new Error("অন্তত একটি ছবি যোগ করুন।");
  const pdf = await PDFDocument.create();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(`পেজ ${i + 1} / ${items.length} তৈরি হচ্ছে`);
    const image = await loadImage(item.src);
    const canvas = document.createElement("canvas");
    canvas.width = item.width;
    canvas.height = item.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("এই ব্রাউজারে ছবি প্রস্তুত করা যাচ্ছে না।");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, item.width, item.height);
    ctx.drawImage(image, 0, 0, item.width, item.height);
    const jpg = /^image\/jpeg$/i.test(item.file.type) || /\.jpe?g$/i.test(item.file.name);
    const blob = await canvasBlob(canvas, jpg ? "image/jpeg" : "image/png", .94);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    canvas.width = 0;
    canvas.height = 0;
    const embedded = jpg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    let pageWidth: number;
    let pageHeight: number;
    let margin: number;
    if (layout === "a4") {
      [pageWidth, pageHeight] = item.width > item.height ? [A4_HEIGHT, A4_WIDTH] : [A4_WIDTH, A4_HEIGHT];
      margin = 24;
    } else {
      const scale = Math.min(.75, 14400 / Math.max(item.width, item.height));
      pageWidth = Math.max(3, item.width * scale);
      pageHeight = Math.max(3, item.height * scale);
      margin = 0;
    }
    const fit = Math.min((pageWidth - margin * 2) / item.width, (pageHeight - margin * 2) / item.height);
    const width = item.width * fit;
    const height = item.height * fit;
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
  }
  return new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" });
}