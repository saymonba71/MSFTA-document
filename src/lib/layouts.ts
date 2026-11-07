import type { Seal, Stamp } from "../types";
import { uid } from "../types";
import { portableSeal } from "./project";

export type Layout = {
  id: string;
  name: string;
  stamps: Array<Pick<Stamp, "sealId" | "x" | "y" | "w" | "rot" | "opacity" | "blend" | "tile" | "brightness" | "contrast">>;
  seals?: Seal[];
};

const KEY = "seal-layouts-v1";

export function loadLayouts(): Layout[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((l) => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.stamps) && l.stamps.every((s: Stamp) => s && [s.x, s.y, s.w, s.rot, s.opacity].every(Number.isFinite) && s.w > 0)).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export async function saveLayout(name: string, stamps: Stamp[], seals: Seal[]): Promise<Layout[]> {
  const ids = new Set(stamps.filter((s) => !s.hidden).slice(0, 24).map((s) => s.sealId));
  const assets = await Promise.all(seals.filter((s) => ids.has(s.id)).map(portableSeal));
  const layout: Layout = {
    id: uid(),
    name: name.trim().slice(0, 32) || "লেআউট",
    seals: assets,
    stamps: stamps
      .filter((s) => !s.hidden)
      .slice(0, 24)
      .map((s) => ({
        sealId: s.sealId,
        x: s.x,
        y: s.y,
        w: s.w,
        rot: s.rot,
        opacity: s.opacity,
        brightness: s.brightness,
        contrast: s.contrast,
        blend: s.blend,
        tile: s.tile,
      })),
  };
  const next = [layout, ...loadLayouts()].slice(0, 8);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteLayout(id: string): Layout[] {
  const next = loadLayouts().filter((l) => l.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
