// Keep object URLs alive while their download links are visible.
export type PreparedFile = { blob: Blob; url: string; filename: string };

export function isEmbedded() {
  try { return window.self !== window.top; } catch { return true; }
}

export function safeFilename(value: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "-");
  const extension = cleaned.match(/\.[a-z0-9]{1,16}$/i)?.[0] ?? "";
  const stem = extension ? cleaned.slice(0, -extension.length) : cleaned;
  const digits = stem.replace(/[০-৯]/g, (ch) => String("০১২৩৪৫৬৭৮৯".indexOf(ch)));
  const ascii = digits.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]+/g, "-").replace(/-+/g, "-").replace(/^[ ._-]+|[ ._-]+$/g, "");
  // Chromium can discard a non-Latin download attribute, including its extension.
  const prefix = stem && !/^[\x20-\x7e]/.test(stem) && ascii ? "document-" : "";
  return `${prefix}${ascii || "document"}`.slice(0, 140) + extension;
}

export function prepareFile(blob: Blob, filename: string): PreparedFile {
  if (!blob.size) throw new Error("ফাইল তৈরি হয়নি। আবার চেষ্টা করুন।");
  return { blob, url: URL.createObjectURL(blob), filename: safeFilename(filename) };
}

export function requestDownload(file: Pick<PreparedFile, "url" | "filename">) {
  const anchor = document.createElement("a");
  anchor.href = file.url;
  anchor.download = file.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function triggerDownload(blob: Blob, filename: string) {
  const file = prepareFile(blob, filename);
  requestDownload(file);
  return file.url;
}

export function releaseFile(file: Pick<PreparedFile, "url"> | null) {
  // Do not interrupt a browser that is still starting the save operation.
  if (file) window.setTimeout(() => URL.revokeObjectURL(file.url), 60_000);
}

export function prettySize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type SaveHandle = { createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }> };
type PickerWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<SaveHandle> };

export function canPickSaveLocation() { return !isEmbedded() && typeof (window as PickerWindow).showSaveFilePicker === "function"; }

/** Call from a click after file generation, while transient user activation is still available. */
export async function savePreparedFile(file: PreparedFile): Promise<"saved" | "cancelled" | "unsupported"> {
  if (!canPickSaveLocation()) return "unsupported";
  let handle: SaveHandle;
  try {
    handle = await (window as PickerWindow).showSaveFilePicker!({ suggestedName: file.filename });
  } catch (error) {
    if ((error as Error).name === "AbortError") return "cancelled";
    if ((error as Error).name === "SecurityError") return "unsupported";
    throw error;
  }
  const writable = await handle.createWritable();
  await writable.write(file.blob);
  await writable.close();
  return "saved";
}