/** Cross-module hand-off: PWA share target + Projects "Open". */
let pendingFile: File | null = null;
const pendingOpen = new Map<string, unknown>();
export function setPendingFile(f: File | null) { pendingFile = f; }
export function takePendingFile(): File | null { const f = pendingFile; pendingFile = null; return f; }
export function setPendingOpen(tool: string, data: unknown) { pendingOpen.set(tool, data); }
export function takePendingOpen(tool: string): unknown { const d = pendingOpen.get(tool); pendingOpen.delete(tool); return d; }
export async function consumeSharedFile(): Promise<File | null> {
  if (typeof caches === "undefined") return null;
  try {
    const keys = await caches.keys();
    const key = keys.find((k) => k.endsWith("-share")); if (!key) return null;
    const cache = await caches.open(key);
    const res = await cache.match("/__shared__"); if (!res) return null;
    await cache.delete("/__shared__");
    const blob = await res.blob();
    const name = decodeURIComponent(res.headers.get("x-name") || "shared");
    return new File([blob], name, { type: blob.type || "application/octet-stream" });
  } catch { return null; }
}
