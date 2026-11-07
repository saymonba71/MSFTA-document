import type { ComponentType } from "react";
export interface ToolDef { id: string; module: string; title: { bn: string; en: string; ar: string }; icon: string; keywords: string[]; offline: boolean; requiresAI?: boolean; component: () => Promise<{ default: ComponentType }> }
const tools = new Map<string, ToolDef>();
export function registerTool(t: ToolDef) { tools.set(t.id, t); }
export function allTools() { return [...tools.values()]; }
export function findTools(q: string, lang: "bn" | "en" | "ar" = "bn") { const s = q.trim().toLowerCase(); return allTools().filter((t) => !s || t.title[lang].toLowerCase().includes(s) || t.id.includes(s) || t.keywords.some((k) => k.toLowerCase().includes(s))); }
const T = (id: string, module: string, bn: string, en: string, ar: string, icon: string, keywords: string[], component: ToolDef["component"], requiresAI = false) => registerTool({ id, module, title: { bn, en, ar }, icon, keywords, offline: !requiresAI, requiresAI, component });
T("pdf.studio", "pdf-studio", "PDF স্টুডিও", "PDF Studio", "استوديو PDF", "📄", ["merge", "split", "compress", "redact", "password", "একত্র", "ضغط"], () => import("../../modules/pdf-studio/PdfStudio"));
T("image.studio", "image-studio", "ইমেজ স্টুডিও", "Image Studio", "استوديو الصور", "🖼️", ["crop", "resize", "filter", "background", "ছবি"], () => import("../../modules/image-studio/ImageStudio"));
T("seal.studio", "seal-studio", "সিল স্টুডিও", "Seal Studio", "استوديو الأختام", "⭕", ["stamp", "rubber", "সিল", "ختم"], () => import("../../modules/seal-studio/SealStudio"));
T("signature.studio", "signature-studio", "স্বাক্ষর স্টুডিও", "Signature Studio", "استوديو التوقيع", "✍️", ["signature", "sign", "সই", "توقيع"], () => import("../../modules/signature-studio/SignatureStudio"));
T("prompt.studio", "prompt-studio", "প্রম্পট স্টুডিও", "Prompt Studio", "استوديو الأوامر", "✨", ["prompt", "midjourney", "প্রম্পট"], () => import("../../modules/prompt-studio/PromptStudio"));
T("document.studio", "document-studio", "ডকুমেন্ট ডিজাইন", "Document Design", "تصميم المستندات", "📐", ["invoice", "certificate", "চালান", "فاتورة"], () => import("../../modules/document-studio/DocumentStudio"));
T("text.studio", "text-studio", "টেক্সট স্টুডিও", "Text Studio", "استوديو النصوص", "🔤", ["rich text", "বাংলা", "نص"], () => import("../../modules/text-studio/TextStudio"));
T("qr.barcode", "qr-barcode", "QR ও বারকোড", "QR & Barcode", "QR والباركود", "🔳", ["qr", "barcode", "upi", "বারকোড"], () => import("../../modules/qr-barcode/QrBarcode"));
T("engineering.studio", "engineering", "ইঞ্জিনিয়ারিং", "Engineering", "الهندسة", "📏", ["dimension", "scale", "title block", "মাপ"], () => import("../../modules/engineering/EngineeringStudio"));
T("batch.studio", "batch", "ব্যাচ প্রসেসিং", "Batch Processing", "المعالجة الدفعية", "📦", ["batch", "folder", "ব্যাচ"], () => import("../../modules/batch/BatchStudio"));
T("ai.assistant", "ai-assistant", "AI ডকুমেন্ট সহকারী", "AI Document Assistant", "مساعد المستندات", "🤖", ["ocr", "summary", "invoice", "সারাংশ"], () => import("../../modules/ai-assistant/AiAssistant"));
T("projects", "projects", "প্রজেক্ট", "Projects", "المشاريع", "🗂️", ["project", "autosave", "প্রজেক্ট"], () => import("../../modules/projects/Projects"));
T("export.center", "export-center", "এক্সপোর্ট সেন্টার", "Export Center", "مركز التصدير", "⬇️", ["export", "download", "এক্সপোর্ট"], () => import("../../modules/export-center/ExportCenter"));
T("settings", "settings", "সেটিংস", "Settings", "الإعدادات", "⚙️", ["settings", "privacy", "সেটিংস"], () => import("../../modules/settings/Settings"));
export const registry = allTools().map((t) => ({ id: t.id, title: t.title.en, module: t.module }));
