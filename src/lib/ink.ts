import type { Stamp } from "../types";
import { loadImage } from "./seal";

export type InkSettings = Pick<Stamp, "opacity" | "brightness" | "contrast" | "blend">;
export const DEFAULT_INK: Required<InkSettings> = { opacity: 1, brightness: 100, contrast: 100, blend: "ink" };
export const INK_PRESETS = [
  { id: "light", label: "হালকা", values: { opacity: .45, brightness: 110, contrast: 95, blend: "ink" } },
  { id: "natural", label: "স্বাভাবিক", values: { opacity: .8, brightness: 100, contrast: 100, blend: "ink" } },
  { id: "dark", label: "গাঢ়", values: { opacity: 1, brightness: 70, contrast: 120, blend: "ink" } },
] satisfies Array<{ id: string; label: string; values: InkSettings }>;

const limit = (value: number | undefined, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback;
export function inkValues(value: Partial<InkSettings>): Required<InkSettings> {
  return {
    opacity: limit(value.opacity, 1, 0, 1),
    brightness: limit(value.brightness, 100, 40, 180),
    contrast: limit(value.contrast, 100, 50, 180),
    blend: value.blend === "normal" ? "normal" : "ink",
  };
}

export function inkFilter(settings: Partial<InkSettings>) {
  const { brightness, contrast } = inkValues(settings);
  return `brightness(${brightness}%) contrast(${contrast}%)`;
}

const images = new Map<string, Promise<HTMLImageElement>>();
const adjusted = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

export function cachedImage(src: string) {
  let promise = images.get(src);
  if (!promise) {
    promise = loadImage(src).catch((error) => { images.delete(src); throw error; });
    if (images.size >= 16) images.delete(images.keys().next().value!);
    images.set(src, promise);
  }
  return promise;
}

/** Filter the artwork before placement; opacity and paper blending are applied only once. */
export async function inkSource(src: string, settings: Partial<InkSettings>): Promise<HTMLImageElement | HTMLCanvasElement> {
  const img = await cachedImage(src);
  const { brightness, contrast } = inkValues(settings);
  if (brightness === 100 && contrast === 100) return img;
  const cache = adjusted.get(img) ?? new Map<string, HTMLCanvasElement>();
  adjusted.set(img, cache);
  const key = `${brightness}:${contrast}`;
  const found = cache.get(key);
  if (found) return found;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  if ("filter" in ctx) {
    ctx.filter = inkFilter(settings);
    ctx.drawImage(img, 0, 0);
  } else {
    // Older Safari versions do not support CanvasRenderingContext2D.filter.
    const fallback = canvas.getContext("2d")!;
    fallback.drawImage(img, 0, 0);
    const pixels = fallback.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const lit = Math.min(255, pixels.data[i + c] * brightness / 100);
        pixels.data[i + c] = (lit - 127.5) * contrast / 100 + 127.5;
      }
    }
    fallback.putImageData(pixels, 0, 0);
  }
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(key, canvas);
  return canvas;
}