import QRCode from "qrcode";
import type { Seal } from "../types";
import { uid } from "../types";

export type ApprovalStatus =
  | "APPROVED"
  | "APPROVED AS NOTED"
  | "FOR CONSTRUCTION"
  | "AS-BUILT"
  | "VERIFIED"
  | "REVISE & RESUBMIT";

export type EngineeringStampConfig = {
  status: ApprovalStatus;
  project: string;
  drawingNo: string;
  scale: string;
  revision: string;
  engineer: string;
  date: string;
  color: string;
};

export const DEFAULT_ENG_STAMP: EngineeringStampConfig = {
  status: "APPROVED",
  project: "PROJECT NAME",
  drawingNo: "DWG-001",
  scale: "1:100",
  revision: "REV-01",
  engineer: "ENGINEER NAME",
  date: "",
  color: "#0f2a6b",
};

export const APPROVAL_STATUS_LIST: Array<{ id: ApprovalStatus; label: string; bn: string; color: string }> = [
  { id: "APPROVED", label: "APPROVED", bn: "অনুমোদিত", color: "#0f2a6b" },
  { id: "FOR CONSTRUCTION", label: "FOR CONSTRUCTION", bn: "নির্মাণের জন্য", color: "#047857" },
  { id: "APPROVED AS NOTED", label: "APPROVED AS NOTED", bn: "শর্তসাপেক্ষে", color: "#1d4ed8" },
  { id: "AS-BUILT", label: "AS-BUILT DRAWING", bn: "চূড়ান্ত ড্রয়িং", color: "#0f766e" },
  { id: "VERIFIED", label: "VERIFIED & CHECKED", bn: "যাচাইকৃত", color: "#6d28d9" },
  { id: "REVISE & RESUBMIT", label: "REVISE & RESUBMIT", bn: "সংশোধন প্রয়োজন", color: "#be123c" },
];

/** Builds a crisp, high-DPI Engineering Approval & Title Block stamp. */
export async function makeEngineeringStamp(cfg: EngineeringStampConfig): Promise<Seal> {
  const W = 1200;
  const H = 680;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const c = cfg.color || "#0f2a6b";

  // Subtle paper-safe translucent fill inside the box
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillRect(16, 16, W - 32, H - 32);

  // Outer heavy border + inner technical frame
  ctx.strokeStyle = c;
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 34, W - 68, H - 68);

  // Top status banner
  ctx.fillStyle = c;
  ctx.fillRect(34, 34, W - 68, 118);
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 54px "Inter", "Arial Black", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cfg.status, W / 2, 95, W - 120);

  // Project title row
  ctx.fillStyle = c;
  ctx.font = '700 36px "Inter", Arial, sans-serif';
  ctx.fillText((cfg.project || "PROJECT NAME").toUpperCase(), W / 2, 200, W - 110);

  // Horizontal & vertical technical grid lines
  ctx.lineWidth = 4;
  const rows = [245, 365, 485];
  for (const y of rows) {
    ctx.beginPath();
    ctx.moveTo(34, y);
    ctx.lineTo(W - 34, y);
    ctx.stroke();
  }
  // Vertical dividers
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 245);
  ctx.lineTo(W * 0.5, 485);
  ctx.moveTo(W * 0.76, 245);
  ctx.lineTo(W * 0.76, 365);
  ctx.stroke();

  const drawCell = (label: string, value: string, x: number, y: number, maxW: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.72;
    ctx.font = '700 20px "Inter", Arial, sans-serif';
    ctx.fillText(label, x, y + 32);
    ctx.globalAlpha = 1;
    ctx.font = '800 33px "Inter", Arial, sans-serif';
    ctx.fillText(value.toUpperCase(), x, y + 82, maxW);
  };

  drawCell("DRAWING / DOC NO.", cfg.drawingNo || "-", 58, 245, W * 0.5 - 80);
  drawCell("SCALE", cfg.scale || "-", W * 0.5 + 24, 245, W * 0.26 - 44);
  drawCell("REVISION", cfg.revision || "-", W * 0.76 + 24, 245, W * 0.24 - 68);

  drawCell("CHECKED / ENGINEER", cfg.engineer || "-", 58, 365, W * 0.5 - 80);
  drawCell("DATE", cfg.date || "-", W * 0.5 + 24, 365, W * 0.5 - 70);

  // Bottom verification & signature bar
  ctx.textAlign = "left";
  ctx.font = '700 22px "Inter", Arial, sans-serif';
  ctx.fillStyle = c;
  ctx.fillText("TECHNICAL REVIEW", 58, 545);

  // Checkmark badge on bottom right
  ctx.beginPath();
  ctx.arc(W - 110, 565, 46, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W - 132, 565);
  ctx.lineTo(W - 115, 582);
  ctx.lineTo(W - 86, 548);
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.font = '600 22px "Inter", Arial, sans-serif';
  ctx.fillText("SIGNATURE / SEAL", 58, 605);

  return {
    id: uid(),
    name: `ইঞ্জিনিয়ারিং: ${cfg.status}`,
    src: cv.toDataURL("image/png"),
    aspect: W / H,
  };
}

/** Builds a crisp Engineering Dimension / Measurement Callout (`|<--- 12.50 m --->|`). */
export async function makeDimensionStamp(label: string, color = "#be123c"): Promise<Seal> {
  const clean = label.trim() || "12.00 m";
  const W = 1100;
  const H = 200;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";

  const y = H / 2 + 18;
  // End witness ticks
  ctx.beginPath();
  ctx.moveTo(40, y - 52);
  ctx.lineTo(40, y + 52);
  ctx.moveTo(W - 40, y - 52);
  ctx.lineTo(W - 40, y + 52);
  // Main dimension line
  ctx.moveTo(46, y);
  ctx.lineTo(W - 46, y);
  ctx.stroke();

  // Arrowheads
  const arrow = (x: number, dir: 1 | -1) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 38, y - 20);
    ctx.lineTo(x + dir * 38, y + 20);
    ctx.closePath();
    ctx.fill();
  };
  arrow(42, 1);
  arrow(W - 42, -1);

  // Pill background for dimension label
  ctx.font = '800 54px "Inter", ui-monospace, monospace';
  const textW = Math.min(W - 260, Math.max(180, ctx.measureText(clean).width + 64));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect((W - textW) / 2, y - 56, textW, 76);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect((W - textW) / 2, y - 56, textW, 76);

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(clean, W / 2, y - 16, textW - 24);

  return {
    id: uid(),
    name: `মাপ: ${clean}`,
    src: cv.toDataURL("image/png"),
    aspect: W / H,
  };
}

/** Builds a clean Whiteout (cover-up), Blackout (redact), or Redline Callout box. */
export async function makeMarkupBox(kind: "whiteout" | "blackout" | "redline", note = "REV-A · CHECK"): Promise<Seal> {
  const W = 900;
  const H = 260;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;

  if (kind === "whiteout") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    return { id: uid(), name: "হোয়াইটআউট (ঢেকে দিন)", src: cv.toDataURL("image/png"), aspect: W / H };
  }
  if (kind === "blackout") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
    return { id: uid(), name: "কালো ঢাকনা", src: cv.toDataURL("image/png"), aspect: W / H };
  }

  // Redline engineering callout
  const c = "#e11d48";
  ctx.fillStyle = "rgba(255, 241, 242, 0.92)";
  ctx.fillRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = c;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  // Corner triangle badge
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(150, 14);
  ctx.lineTo(14, 150);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 32px "Inter", sans-serif';
  ctx.fillText("!", 42, 68);

  ctx.fillStyle = c;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '800 54px "Hind Siliguri", "Inter", sans-serif';
  ctx.fillText((note.trim() || "সংশোধন প্রয়োজন").toUpperCase(), W / 2 + 24, H / 2, W - 140);

  return {
    id: uid(),
    name: `মার্কআপ: ${note.slice(0, 16) || "Redline"}`,
    src: cv.toDataURL("image/png"),
    aspect: W / H,
  };
}

/** Encode exactly the supplied text or URL as a scannable QR code. */
export async function makeVerificationBadge(value: string, label = "QR CODE"): Promise<Seal> {
  const content = value.trim();
  if (!content) throw new Error("QR কোডের জন্য একটি লিংক বা লেখা দিন।");
  if (new TextEncoder().encode(content).length > 600) throw new Error("QR-এর লেখা ৬০০ বাইটের মধ্যে রাখুন।");
  const src = await QRCode.toDataURL(content, { errorCorrectionLevel: "M", margin: 4, width: 768, color: { dark: "#102443", light: "#ffffff" } });
  return { id: uid(), name: `QR: ${label.trim().slice(0, 28) || "কোড"}`, src, aspect: 1, kind: "qr" };
}
