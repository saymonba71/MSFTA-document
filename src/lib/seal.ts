import antonWoff2 from "@fontsource/anton/files/anton-latin-400-normal.woff2?inline";
import { BD_H, BD_PATH, BD_W } from "./bdmap";
import type { Seal } from "../types";
import { uid } from "../types";

export type SealShape = "circle" | "square" | "rect";
export type SealEmblem = "map" | "flag" | "star" | "crescent" | "waterlily" | "paddy" | "monogram" | "none";

export type SealConfig = {
  shape: SealShape;
  laurel: boolean;
  emblem: SealEmblem;
  top: string;
  middle: string;
  date: string;
  bottom: string;
  color: string;
  grunge: 0 | 1 | 2; // 0 = clean, 1 = light, 2 = strong
  serial?: string;
  ink: number; // ink strength 0.35 – 1 (light ↔ dark)
};

export const DEFAULT_SEAL: SealConfig = {
  shape: "circle",
  laurel: false,
  emblem: "map",
  top: "MSFTA.SHOP",
  middle: "SAYMON HASAN",
  date: "2023-2026",
  bottom: "OF THE BANGLADESH DEVELOPMENT",
  color: "#0f2a6b",
  grunge: 0,
  serial: "",
  ink: 1,
};

export function normalizeSealConfig(value: unknown): SealConfig {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: "top" | "middle" | "date" | "bottom" | "serial", length: number) => typeof data[key] === "string" ? data[key].slice(0, length) : DEFAULT_SEAL[key] ?? "";
  return {
    shape: ["circle", "square", "rect"].includes(String(data.shape)) ? data.shape as SealShape : "circle",
    laurel: data.laurel === true,
    emblem: ["map", "flag", "star", "crescent", "waterlily", "paddy", "monogram", "none"].includes(String(data.emblem)) ? data.emblem as SealEmblem : "map",
    top: text("top", 45), middle: text("middle", 45), date: text("date", 28), bottom: text("bottom", 65), serial: text("serial", 36),
    color: typeof data.color === "string" && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : DEFAULT_SEAL.color,
    grunge: data.grunge === 2 ? 2 : data.grunge === 1 || data.grunge === true ? 1 : 0,
    ink: typeof data.ink === "number" && Number.isFinite(data.ink) ? Math.min(1, Math.max(.35, data.ink)) : 1,
  };
}

/** Page aspect (width / height) for each seal shape. */
export const sealAspect = (shape: SealShape) => (shape === "rect" ? 1000 / 620 : 1);

const C = 500;
const rad = (a: number) => (a * Math.PI) / 180;
const f = (n: number) => n.toFixed(2);
// Anton average uppercase advance ≈ 0.46em
const textW = (s: string, fs: number, ls = 0) => s.length * (fs * 0.46 + ls);

function pt(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}`;
}

function star(cx: number, cy: number, r: number, extra = "") {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.42;
    const [x, y] = pt(cx, cy, rr, -90 + i * 36);
    pts.push(`${f(x)},${f(y)}`);
  }
  return `<polygon points="${pts.join(" ")}"${extra}/>`;
}

function leaf(x: number, y: number, deg: number, L: number, W: number) {
  return `<path stroke="none" d="M0 0 Q${f(L / 2)} ${f(-W)} ${f(L)} 0 Q${f(L / 2)} ${f(W)} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})"/>`;
}

function branch(cx: number, cy: number, R: number, a0: number, a1: number, n: number, L: number, W: number) {
  let s = `<path d="${arcPath(cx, cy, R, a0, a1)}" fill="none" stroke-width="${f(W * 0.45)}" stroke-linecap="round"/>`;
  const dir = Math.sign(a1 - a0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / (n + 0.4);
    const a = a0 + (a1 - a0) * t;
    const [x, y] = pt(cx, cy, R, a);
    const tau = a + dir * 90;
    const len = L * (1 - 0.35 * t);
    s += leaf(x, y, tau - 40, len, W) + leaf(x, y, tau + 40, len, W);
  }
  const [tx, ty] = pt(cx, cy, R, a1);
  s += leaf(tx, ty, a1 + dir * 90, L * 0.6, W * 0.8);
  return s;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const FONT = "SealAnton, Anton, Impact, 'Arial Narrow Bold', sans-serif";
const fontStyle = `<style>@font-face{font-family:'SealAnton';src:url(${antonWoff2}) format('woff2');font-weight:400;}</style>`;

function fitAttr(s: string, fs: number, max: number, ls = 0) {
  return textW(s, fs, ls) > max ? ` textLength="${f(max)}" lengthAdjust="spacingAndGlyphs"` : "";
}

function grungeFilter(level: 0 | 1 | 2) {
  if (level === 0) return "";
  if (level === 1) {
    return `<filter id="grunge" x="0" y="0" width="1000" height="1000" filterUnits="userSpaceOnUse">
  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="11" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="4" result="fine"/>
  <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 40 -11" result="specks"/>
  <feComposite in="rough" in2="specks" operator="in"/>
</filter>`;
  }
  return `<filter id="grunge" x="0" y="0" width="1000" height="1000" filterUnits="userSpaceOnUse">
  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n1"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="3" result="n2"/>
  <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 9 0 0 0 -2.3" result="m1"/>
  <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 13 0 0 0 -3.9" result="m2"/>
  <feComposite in="m1" in2="m2" operator="in" result="m"/>
  <feComposite in="rough" in2="m" operator="in"/>
</filter>`;
}

/* ---------------- emblem library ---------------- */
function starPoints(cx: number, cy: number, r: number, inner = 0.42) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = -90 + i * 36;
    pts.push(`${f(cx + rr * Math.cos(rad(a)))},${f(cy + rr * Math.sin(rad(a)))}`);
  }
  return pts.join(" ");
}

function emblemSvg(kind: SealEmblem, middle: string) {
  switch (kind) {
    case "map": {
      const h = 200;
      const sc = h / BD_H;
      const w = BD_W * sc;
      return `<path stroke="none" d="${BD_PATH}" transform="translate(${f(-w / 2)} -100) scale(${f(sc)})"/>`;
    }
    case "flag":
      return `<g stroke="none"><rect x="-108" y="-72" width="216" height="144" rx="7" fill="#006a4e"/><circle cx="-14" cy="0" r="45" fill="#f42a41"/><rect x="-108" y="-72" width="216" height="144" rx="7" fill="none" stroke="currentColor" stroke-width="5"/></g>`;
    case "star":
      return `<polygon stroke="none" points="${starPoints(0, 0, 94)}"/><polygon stroke="none" points="${starPoints(-118, 58, 20)}"/><polygon stroke="none" points="${starPoints(118, 58, 20)}"/>`;
    case "crescent":
      return `<g stroke="none">
  <mask id="crescent-cut" maskUnits="userSpaceOnUse" x="-120" y="-120" width="240" height="240">
    <rect x="-120" y="-120" width="240" height="240" fill="white"/>
    <circle cx="30" cy="-10" r="70" fill="black"/>
  </mask>
  <circle cx="-8" cy="6" r="86" mask="url(#crescent-cut)"/>
  <polygon points="${starPoints(62, -62, 24)}"/>
</g>`;
    case "waterlily": {
      const petals = Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-54" rx="25" ry="54" transform="rotate(${i * 45})"/>`).join("");
      return `<g stroke="none">${petals}<circle cx="0" cy="0" r="22" fill="#ffffff"/><circle cx="0" cy="0" r="22" fill="none" stroke="currentColor" stroke-width="6"/></g>`;
    }
    case "paddy": {
      const stalk = (dir: number) => {
        const leaves = Array.from({ length: 6 }, (_, i) => {
          const y = 70 - i * 30;
          const x = dir * (10 + i * 4);
          return `<ellipse cx="${f(x + dir * 22)}" cy="${f(y - 8)}" rx="30" ry="10" transform="rotate(${dir * -42} ${f(x + dir * 22)} ${f(y - 8)})"/>`;
        }).join("");
        return `<path d="M0 92 Q ${dir * 26} 10 0 -86" fill="none" stroke-width="7" stroke-linecap="round"/>${leaves}`;
      };
      return `<g stroke="none" stroke-linecap="round">${stalk(-1)}${stalk(1)}</g>`;
    }
    case "monogram": {
      const words = middle.trim().split(/\s+/).filter(Boolean);
      const initials = (words[0]?.[0] ?? "S") + (words[1]?.[0] ?? "");
      return `<g><circle cx="0" cy="0" r="94" fill="none" stroke-width="10"/><circle cx="0" cy="0" r="78" fill="none" stroke-width="3"/><text x="0" y="32" font-family="${FONT}" font-size="84" text-anchor="middle" stroke="none">${esc(initials.toUpperCase())}</text></g>`;
    }
    default:
      return "";
  }
}

function laurelMark() {
  return `
    ${branch(C, C, 185, 212, 250, 5, 52, 15)}
    ${branch(C, C, 185, 328, 290, 5, 52, 15)}
    ${branch(C, C, 180, 84, 150, 6, 56, 16)}
    ${branch(C, C, 180, 96, 30, 6, 56, 16)}`;
}

/* ---------------- circle seal ---------------- */
function circleDesign(cfg: SealConfig) {
  const c = cfg.color;
  const topFs = 108;
  const topR = 330;
  const topArcLen = rad(130) * topR;
  const botFs = 56;
  const botR = 392;
  const botArcLen = rad(136) * botR;
  const serial = cfg.serial?.trim();
  const midFs = cfg.middle.length > 13 ? 92 : 108;
  const isMap = cfg.emblem === "map";
  const emblem = emblemSvg(cfg.emblem, cfg.middle);
  const dateY = cfg.date ? 628 : 636;
  const starY = isMap ? 500 : 392;

  const knock = `
    <text x="500" y="552" font-size="${midFs}" text-anchor="middle"${fitAttr(cfg.middle, midFs, 640)}>${esc(cfg.middle)}</text>
    ${cfg.date ? `<text x="500" y="${dateY}" font-size="46" letter-spacing="3" text-anchor="middle"${fitAttr(cfg.date, 46, 300, 3)}>${esc(cfg.date)}</text>` : ""}
    ${cfg.date ? `${star(500 - Math.min(320, textW(cfg.date, 46, 3)) / 2 - 34, dateY - 14, 14, ' stroke="none"')}${star(500 + Math.min(320, textW(cfg.date, 46, 3)) / 2 + 34, dateY - 14, 14, ' stroke="none"')}` : ""}`;

  return `
<defs>
  <mask id="knock" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
    <rect width="1000" height="1000" fill="white"/>
    <g fill="black" stroke="black" stroke-width="26" stroke-linejoin="round" font-family="${FONT}">${knock}</g>
  </mask>
  <clipPath id="innerClip"><circle cx="500" cy="500" r="292"/></clipPath>
  <path id="topArc" d="${arcPath(C, C, topR, 202, 338)}"/>
  <path id="botArc" d="${arcPath(C, C, botR, 158, 22)}"/>
</defs>
<g fill="${c}" stroke="${c}" opacity="${f(cfg.ink)}"${cfg.grunge ? ' filter="url(#grunge)"' : ""}>
  <circle cx="500" cy="500" r="472" fill="none" stroke-width="20"/>
  <circle cx="500" cy="500" r="449" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="0.1 15.6"/>
  <g mask="url(#knock)">
    ${cfg.laurel ? laurelMark() : ""}
    ${emblem ? `<g clip-path="url(#innerClip)"><g transform="translate(500 ${isMap ? 452 : 366}) scale(${isMap ? 1.9 : 1.05})">${emblem}</g></g>` : ""}
  </g>
  <circle cx="500" cy="500" r="312" fill="none" stroke-width="5"/>
  <circle cx="500" cy="500" r="299" fill="none" stroke-width="2"/>
  ${star(132, starY, 19, ' stroke="none"')}${star(868, starY, 19, ' stroke="none"')}
  ${serial ? `<text x="500" y="716" font-size="26" letter-spacing="4" text-anchor="middle" stroke="none">${esc(serial)}</text>` : ""}
  <g font-family="${FONT}" stroke="none">
    <text font-size="${topFs}" letter-spacing="4"><textPath href="#topArc" startOffset="50%" text-anchor="middle"${fitAttr(cfg.top, topFs, topArcLen * 0.9, 4)}>${esc(cfg.top)}</textPath></text>
    <text font-size="${botFs}" letter-spacing="2"><textPath href="#botArc" startOffset="50%" text-anchor="middle"${fitAttr(cfg.bottom, botFs, botArcLen * 0.95, 2)}>${esc(cfg.bottom)}</textPath></text>
    ${knock}
  </g>
</g>`;
}

/* ---------------- square seal ---------------- */
function squareDesign(cfg: SealConfig) {
  const c = cfg.color;
  const serial = cfg.serial?.trim();
  const isMap = cfg.emblem === "map";
  const emblem = emblemSvg(cfg.emblem, cfg.middle);
  return `
<g fill="${c}" stroke="${c}" opacity="${f(cfg.ink)}"${cfg.grunge ? ' filter="url(#grunge)"' : ""}>
  <rect x="36" y="36" width="928" height="928" rx="46" fill="none" stroke-width="20"/>
  <rect x="62" y="62" width="876" height="876" rx="32" fill="none" stroke-width="6"/>
  <rect x="84" y="84" width="832" height="832" rx="22" fill="none" stroke-width="2.5"/>
  <line x1="132" y1="220" x2="868" y2="220" stroke-width="4"/>
  <line x1="132" y1="600" x2="868" y2="600" stroke-width="5"/>
  <clipPath id="sqClip"><rect x="92" y="92" width="816" height="816" rx="18"/></clipPath>
  ${emblem ? `<g clip-path="url(#sqClip)"><g transform="translate(500 ${isMap ? 400 : 384}) scale(${isMap ? 1.5 : 0.9})">${emblem}</g></g>` : ""}
  <g font-family="${FONT}" stroke="none">
    <text x="500" y="176" font-size="60" letter-spacing="3" text-anchor="middle"${fitAttr(cfg.top, 60, 740, 3)}>${esc(cfg.top)}</text>
    <text x="500" y="548" font-size="${cfg.middle.length > 13 ? 76 : 92}" text-anchor="middle"${fitAttr(cfg.middle, 92, 740)}>${esc(cfg.middle)}</text>
    ${cfg.date ? `<text x="500" y="664" font-size="42" letter-spacing="3" text-anchor="middle"${fitAttr(cfg.date, 42, 320, 3)}>${esc(cfg.date)}</text>` : ""}
    <text x="500" y="752" font-size="38" letter-spacing="2" text-anchor="middle"${fitAttr(cfg.bottom, 38, 760, 2)}>${esc(cfg.bottom)}</text>
    ${serial ? `<text x="500" y="834" font-size="24" letter-spacing="3" text-anchor="middle">${esc(serial)}</text>` : ""}
  </g>
  ${star(130, 760, 16, ' stroke="none"')}${star(870, 760, 16, ' stroke="none"')}
</g>`;
}

/* ---------------- rectangular letterhead seal ---------------- */
function rectDesign(cfg: SealConfig) {
  const c = cfg.color;
  const serial = cfg.serial?.trim();
  const emblem = emblemSvg(cfg.emblem, cfg.middle);
  const right = 390;
  return `
<g fill="${c}" stroke="${c}" opacity="${f(cfg.ink)}"${cfg.grunge ? ' filter="url(#grunge)"' : ""}>
  <rect x="24" y="24" width="952" height="572" rx="32" fill="none" stroke-width="16"/>
  <rect x="48" y="48" width="904" height="524" rx="22" fill="none" stroke-width="4"/>
  <line x1="250" y1="92" x2="250" y2="528" stroke-width="3"/>
  <circle cx="149" cy="310" r="104" fill="none" stroke-width="7"/>
  <circle cx="149" cy="310" r="94" fill="none" stroke-width="2"/>
  <clipPath id="medClip"><circle cx="149" cy="310" r="93"/></clipPath>
  ${emblem ? `<g clip-path="url(#medClip)"><g transform="translate(149 310) scale(${cfg.emblem === "map" ? 0.75 : 0.42})">${emblem}</g></g>` : ""}
  <g font-family="${FONT}" stroke="none">
    <text x="${right}" y="150" font-size="44" letter-spacing="3"${fitAttr(cfg.top, 44, 530, 3)}>${esc(cfg.top)}</text>
    <text x="${right}" y="300" font-size="${cfg.middle.length > 14 ? 64 : 82}"${fitAttr(cfg.middle, 82, 530)}>${esc(cfg.middle)}</text>
    <line x1="${right}" y1="330" x2="922" y2="330" stroke-width="3"/>
    ${cfg.date ? `<text x="${right}" y="392" font-size="34" letter-spacing="3">${esc(cfg.date)}</text>` : ""}
    <text x="${right}" y="456" font-size="30" letter-spacing="1.5"${fitAttr(cfg.bottom, 30, 530, 1.5)}>${esc(cfg.bottom)}</text>
    ${serial ? `<text x="${right}" y="512" font-size="22" letter-spacing="2">${esc(serial)}</text>` : ""}
  </g>
  ${star(149, 160, 15, ' stroke="none"')}${star(149, 460, 15, ' stroke="none"')}
</g>`;
}

export function buildSealSvgBody(cfg: SealConfig) {
  if (cfg.shape === "square") return squareDesign(cfg);
  if (cfg.shape === "rect") return rectDesign(cfg);
  return circleDesign(cfg);
}

export function buildSealSvg(input: Partial<SealConfig>) {
  const cfg = normalizeSealConfig({ ...DEFAULT_SEAL, ...input });
  const g = typeof (cfg.grunge as unknown) === "boolean" ? ((cfg.grunge as unknown) ? 1 : 0) : cfg.grunge;
  cfg.grunge = (g === 2 ? 2 : g === 1 ? 1 : 0) as 0 | 1 | 2;
  cfg.ink = Math.min(1, Math.max(0.35, Number.isFinite(cfg.ink) ? cfg.ink : 1));
  const h = cfg.shape === "rect" ? 620 : 1000;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${h}" viewBox="0 0 1000 ${h}">
${fontStyle}
<defs>${grungeFilter(cfg.grunge)}</defs>
${buildSealSvgBody(cfg)}
</svg>`;
}

export function sealDataUrl(cfg: Partial<SealConfig>) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(buildSealSvg(cfg));
}

/** Builds a transparent, high-resolution text layer so it exports like any other stamp. */
export async function makeTextSeal(
  text: string,
  color: string,
  fontFamily: string,
  background: string,
  existingId?: string
): Promise<Seal> {
  const clean = text.trim().slice(0, 180);
  if (!clean) throw new Error("লেখা লিখুন");
  const fontSize = 96;
  const maxTextWidth = 1320;
  const font = `700 ${fontSize}px ${fontFamily}`;
  await document.fonts?.load(font).catch(() => undefined);

  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d")!;
  measure.font = font;
  const lines: string[] = [];
  for (const rawLine of clean.split(/\n+/)) {
    let line = "";
    for (const word of rawLine.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure.measureText(candidate).width <= maxTextWidth) {
        line = candidate;
      } else if (line) {
        lines.push(line);
        line = word;
      } else {
        // Long single words still fit without being split mid-grapheme.
        line = word;
      }
      if (measure.measureText(line).width > maxTextWidth) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
  }

  const padX = 72;
  const padY = 34;
  const lineHeight = 124;
  const measuredWidth = Math.max(320, ...lines.map((line) => Math.min(maxTextWidth, measure.measureText(line).width)));
  const width = Math.ceil(measuredWidth + padX * 2);
  const height = Math.ceil(lines.length * lineHeight + padY * 2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = color;
  if (background !== "transparent") {
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
  }
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, padY + lineHeight * (i + 0.5), maxTextWidth);
  });

  return {
    id: existingId ?? uid(),
    name: `লেখা: ${clean.slice(0, 18)}${clean.length > 18 ? "..." : ""}`,
    src: canvas.toDataURL("image/png"),
    aspect: width / height,
    kind: "text",
    text: clean,
    color,
    fontFamily,
    background,
  };
}

/** Re-inks a transparent seal image with a new colour, keeping its texture (alpha). */
export async function recolorSeal(seal: Seal, color: string, colorName: string): Promise<Seal> {
  const img = await loadImage(seal.src);
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return {
    id: uid(),
    name: `${seal.name.replace(/ \(.+\)$/, "")} (${colorName})`,
    src: cv.toDataURL("image/png"),
    aspect: w / h,
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ছবি লোড করা যায়নি"));
    img.src = src;
  });
}

/** Rasterize an SVG seal to a crisp PNG (fonts embedded, consistent on all devices). */
export async function rasterizeSeal(svgUrl: string, size = 1400): Promise<{ src: string; aspect: number }> {
  const img = await loadImage(svgUrl);
  const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  const w = aspect >= 1 ? size : Math.round(size * aspect);
  const h = aspect >= 1 ? Math.round(size / aspect) : size;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return { src: cv.toDataURL("image/png"), aspect };
}

/**
 * Removes light/white/checkerboard backgrounds from an uploaded seal image,
 * trims the empty borders and returns a PNG data URL.
 */
export function processSealImage(
  img: HTMLImageElement,
  opts: { removeBg: boolean; threshold: number; maxSize?: number }
): { src: string; aspect: number } {
  const maxSize = opts.maxSize ?? 1200;
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const thr = opts.threshold;
  const soft = 45;
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (opts.removeBg) {
        const r = d[i],
          g = d[i + 1],
          b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (sat < 60) {
          const k = Math.min(1, Math.max(0, (thr - lum) / soft));
          d[i + 3] = Math.round(d[i + 3] * k);
        }
      }
      if (d[i + 3] > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  if (maxX < 0) return { src: cv.toDataURL("image/png"), aspect: w / h };
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  out.getContext("2d")!.drawImage(cv, minX, minY, tw, th, 0, 0, tw, th);
  return { src: out.toDataURL("image/png"), aspect: tw / th };
}
