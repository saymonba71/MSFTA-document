export interface Defaults { exportFormat: "png" | "jpg" | "pdf" | "webp"; pdfSize: string; imageQuality: number; sealSizeMm: number; font: string }
export const DEFAULTS: Defaults = { exportFormat: "png", pdfSize: "A4", imageQuality: 0.92, sealSizeMm: 40, font: "Noto Sans Bengali" };
export function loadDefaults(): Defaults { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("isoe-defaults") || "{}") as Partial<Defaults> }; } catch { return DEFAULTS; } }
export function saveDefaults(d: Defaults) { localStorage.setItem("isoe-defaults", JSON.stringify(d)); }
