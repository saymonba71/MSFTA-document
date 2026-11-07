import type { Doc, Page, Seal, Stamp } from "../types";
import { uid } from "../types";
import { inkValues } from "./ink";

const PROJECT_FORMAT = "seal-boshan-project";

export type EditableProject = {
  doc: Doc;
  stamps: Stamp[];
  seals: Seal[];
  pageIdx: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function makePagePortable(page: Page): Promise<Page> {
  if (page.src.startsWith("data:")) return page;
  const response = await fetch(page.src);
  if (!response.ok) throw new Error("ডকুমেন্টের পেজ পড়া যায়নি");
  const blob = await response.blob();
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("প্রজেক্ট ডেটা তৈরি করা যায়নি"));
    reader.readAsDataURL(blob);
  });
  return { ...page, src };
}

export async function portableSeal(seal: Seal): Promise<Seal> {
  if (seal.src.startsWith("data:image/")) return seal;
  const page = await makePagePortable({ src: seal.src, width: 1, height: 1 });
  return { ...seal, src: page.src };
}

export async function exportEditableProject(project: EditableProject): Promise<Blob> {
  const pages = await Promise.all(project.doc.pages.map(makePagePortable));
  const ids = new Set(project.stamps.map((s) => s.sealId));
  const seals = await Promise.all(project.seals.filter((s) => ids.has(s.id) || s.builtIn).map(portableSeal));
  const payload = {
    format: PROJECT_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    doc: {
      kind: project.doc.kind,
      name: project.doc.name,
      mime: project.doc.mime,
      pages,
      textItems: project.doc.textItems,
      pdfBase64: project.doc.bytes ? arrayBufferToBase64(project.doc.bytes) : undefined,
    },
    stamps: project.stamps,
    seals,
    pageIdx: project.pageIdx,
  };
  return new Blob([JSON.stringify(payload)], { type: "application/json" });
}

export async function importEditableProject(file: File): Promise<EditableProject> {
  if (file.size > 160 * 1024 * 1024) throw new Error("প্রজেক্ট ১৬০ MB-এর মধ্যে রাখুন");
  const raw = JSON.parse(await file.text());
  if (raw?.format !== PROJECT_FORMAT || raw?.version !== 1) {
    throw new Error("এই ফাইলটি সিল বসান প্রজেক্ট ফাইল নয়");
  }
  if (!raw.doc || !Array.isArray(raw.doc.pages) || !raw.doc.pages.length || !Array.isArray(raw.stamps) || !Array.isArray(raw.seals)) {
    throw new Error("প্রজেক্ট ফাইলটি অসম্পূর্ণ বা নষ্ট");
  }
  const pages = raw.doc.pages as Page[];
  if (pages.length > 100 || raw.stamps.length > 10000 || raw.seals.length > 500) throw new Error("প্রজেক্টটি খুব বড়");
  if (pages.some((p) => typeof p.src !== "string" || !p.src.startsWith("data:image/") || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0)) {
    throw new Error("প্রজেক্টে একটি বা একাধিক ছবি পেজ পড়া যাচ্ছে না");
  }
  const bytes = raw.doc.kind === "pdf" && typeof raw.doc.pdfBase64 === "string" ? base64ToArrayBuffer(raw.doc.pdfBase64) : undefined;
  if (raw.doc.kind === "pdf" && (!bytes || bytes.byteLength === 0)) throw new Error("মূল PDF ডেটা নেই");
  const seals = (raw.seals as Seal[]).filter((s) => s && typeof s.id === "string" && typeof s.src === "string" && s.src.startsWith("data:image/") && Number.isFinite(s.aspect) && s.aspect > 0);
  if (!seals.length) throw new Error("প্রজেক্টে ব্যবহারযোগ্য সিল নেই");
  const validSealIds = new Set(seals.map((s) => s.id));
  const stamps = (raw.stamps as Stamp[]).filter((s) =>
    s && typeof s.id === "string" && validSealIds.has(s.sealId) && Number.isInteger(s.page) && s.page >= 0 && s.page < pages.length &&
    [s.x, s.y, s.w, s.rot, s.opacity].every(Number.isFinite) && s.w > 0 && s.w <= 2 && s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1
  );
  if (stamps.length !== raw.stamps.length) throw new Error("প্রজেক্টের কিছু সিল বা অবস্থানের ডেটা অসম্পূর্ণ");
  const idMap = new Map(seals.map((seal) => [seal.id, `restored-${uid()}`]));
  const doc: Doc = {
    kind: raw.doc.kind === "pdf" ? "pdf" : "image",
    name: typeof raw.doc.name === "string" ? raw.doc.name : file.name,
    mime: typeof raw.doc.mime === "string" ? raw.doc.mime : "image/png",
    pages,
    bytes,
    textItems: Array.isArray(raw.doc.textItems) ? (raw.doc.textItems as unknown[]).filter((item) => {
      const entry = item as Record<string, unknown>;
      return item && typeof entry.id === "string" && typeof entry.text === "string" && typeof entry.page === "number" && Number.isInteger(entry.page) && entry.page >= 0 && entry.page < pages.length && [entry.x, entry.y, entry.w, entry.h, entry.size].every((value) => typeof value === "number" && Number.isFinite(value));
    }).slice(0, 2000) as Doc["textItems"] : undefined,
  };
  return {
    doc,
    stamps: stamps.map((s) => ({ ...s, ...inkValues(s), sealId: idMap.get(s.sealId)! })),
    seals: seals.map((seal) => ({ ...seal, id: idMap.get(seal.id)!, builtIn: false })),
    pageIdx: Math.max(0, Math.min(pages.length - 1, Math.floor(Number(raw.pageIdx) || 0))),
  };
}