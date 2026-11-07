import DOMPurify from "dompurify";

export const LIMITS = { fileBytes: 200 * 1024 * 1024, pixels: 80_000_000, pages: 2000, zipEntries: 5000, zipUncompressed: 512 * 1024 * 1024 };
export type FileKind = "pdf" | "png" | "jpeg" | "webp" | "svg" | "zip" | "json" | "text" | "unknown";

export function detectKind(bytes: Uint8Array, name = ""): FileKind {
  const starts = (sig: number[], off = 0) => sig.every((b, i) => bytes[off + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "png";
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (starts([0x50, 0x4b, 3, 4]) || starts([0x50, 0x4b, 5, 6])) return "zip";
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  if (/\.svg$/i.test(name) && head.includes("<svg")) return "svg";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (!/[\x00-\x08\x0e-\x1f]/.test(head)) return "text";
  return "unknown";
}

export async function validateFile(file: File, allowed: FileKind[], maxBytes = LIMITS.fileBytes): Promise<FileKind> {
  if (file.size > maxBytes) throw new Error(`ফাইলটি খুব বড় (${(file.size / 1048576).toFixed(1)} MB; সীমা ${(maxBytes / 1048576).toFixed(0)} MB)`);
  const kind = detectKind(new Uint8Array(await file.slice(0, 512).arrayBuffer()), file.name);
  if (!allowed.includes(kind)) throw new Error(`এই টুলে ${allowed.join(", ")} ফাইল দিন। শনাক্ত হয়েছে: ${kind}`);
  return kind;
}

export function safeName(value: string, fallback = "document"): string {
  const cleaned = value.normalize("NFC").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+/, "").replace(/\.+$/,"").trim().slice(0, 120);
  const base = cleaned || fallback;
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(base) ? `_${base}` : base;
}

export function sanitizeSvg(svg: string): string {
  const clean = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["script", "foreignObject", "a"], FORBID_ATTR: ["onload", "onerror", "onclick", "href", "xlink:href"] });
  if (/(?:url\(\s*['"]?https?:|<!ENTITY)/i.test(clean)) throw new Error("বাহ্যিক রেফারেন্সযুক্ত SVG নিরাপদ নয়");
  return clean;
}

export const SENSITIVE_PATTERNS: { id: string; label: string; re: RegExp }[] = [
  { id: "email", label: "ইমেইল", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { id: "phone", label: "ফোন", re: /(?:\+?880|0)1[3-9]\d{8}\b|\b\+?\d[\d -]{8,14}\d\b/g },
  { id: "nid", label: "NID/পাসপোর্ট", re: /\b(?:\d{10}|\d{13}|\d{17}|[A-Z]{2}\d{7})\b/g },
  { id: "card", label: "কার্ড নম্বর", re: /\b(?:\d[ -]?){13,19}\b/g },
];
export function findSensitive(text: string) { return SENSITIVE_PATTERNS.filter((p) => { p.re.lastIndex = 0; return p.re.test(text); }).map(({ id, label }) => ({ id, label })); }
export function maskSensitive(text: string): string { return SENSITIVE_PATTERNS.reduce((t, p) => t.replace(p.re, "[REDACTED]"), text); }
export function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
