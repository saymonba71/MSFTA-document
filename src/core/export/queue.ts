import { db, type StoredExport } from "../storage/db";
import { safeName } from "../security/validate";
import { pngWithDpi, jpegWithDpi } from "./dpi";
export type ExportFormat = "png" | "jpg" | "webp" | "pdf" | "zip" | "txt" | "docx" | "json" | "svg" | "isoe" | "xlsx" | "csv" | "html" | "md";
export interface ExportJob { id: string; filename: string; format: ExportFormat; status: "queued" | "running" | "done" | "error" | "cancelled"; progress: number; error?: string; size?: number; blob?: Blob; result?: StoredExport; run: (progress: (p: number) => void, signal: AbortSignal) => Promise<Blob>; dpi?: number; controller?: AbortController }
type Listener = () => void;
class ExportQueue {
  private list: ExportJob[] = []; private listeners = new Set<Listener>(); private running = false;
  jobs() { return [...this.list].reverse(); }
  subscribe(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit() { this.listeners.forEach((l) => l()); }
  add(job: Omit<ExportJob, "id" | "status" | "progress"> & { id?: string; run: (progress: (p: number) => void, signal?: AbortSignal) => Promise<Blob> }) { const j: ExportJob = { ...job, id: job.id ?? crypto.randomUUID(), filename: safeName(job.filename), status: "queued", progress: 0, controller: new AbortController() }; this.list.push(j); this.emit(); void this.pump(); return j.id; }
  cancel(id: string) { const j = this.list.find((x) => x.id === id); if (!j) return; j.controller?.abort(); if (j.status === "queued") { j.status = "cancelled"; this.emit(); } }
  retry(id: string) { const j = this.list.find((x) => x.id === id); if (!j || j.status === "running") return; j.status = "queued"; j.error = undefined; j.progress = 0; j.controller = new AbortController(); this.emit(); void this.pump(); }
  async remove(id: string) { this.list = this.list.filter((x) => x.id !== id); await db().then((d) => d.delete("exports", id)); this.emit(); }
  private async pump() { if (this.running) return; this.running = true; while (this.list.some((j) => j.status === "queued")) { const j = this.list.find((x) => x.status === "queued")!; j.status = "running"; this.emit(); try { let blob = await j.run((p) => { j.progress = p; this.emit(); }, j.controller!.signal); if (j.controller!.signal.aborted) throw new Error("Cancelled"); if (j.dpi && j.format === "png") blob = await pngWithDpi(blob, j.dpi); if (j.dpi && j.format === "jpg") blob = await jpegWithDpi(blob, j.dpi); const filename = /\.[a-z0-9]{2,5}$/i.test(j.filename) ? j.filename : `${j.filename}.${j.format}`; const rec: StoredExport = { id: j.id, filename, mime: blob.type || "application/octet-stream", size: blob.size, createdAt: Date.now(), blob }; await db().then((d) => d.put("exports", rec)); j.result = rec; j.blob = blob; j.size = blob.size; j.filename = filename; j.status = "done"; j.progress = 1; } catch (e) { j.status = j.controller!.signal.aborted ? "cancelled" : "error"; j.error = (e as Error).message; } this.emit(); } this.running = false; }
  /** Record an already-encoded blob (modules that encode themselves) into history + queue view. */
  async record(blob: Blob, filename: string, format: ExportFormat) { if (this.list.some((j) => j.blob === blob)) return; const name = safeName(/\.[a-z0-9]{2,5}$/i.test(filename) ? filename : `${filename}.${format}`); const rec: StoredExport = { id: crypto.randomUUID(), filename: name, mime: blob.type || "application/octet-stream", size: blob.size, createdAt: Date.now(), blob }; await db().then((d) => d.put("exports", rec)); this.list.push({ id: rec.id, filename: name, format, status: "done", progress: 1, blob, size: blob.size, result: rec, run: async () => blob }); this.emit(); }
  clearFinished() { this.list = this.list.filter((j) => j.status === "queued" || j.status === "running"); this.emit(); }
}
export const exportQueue = new ExportQueue();
export function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = safeName(filename); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
export function prettySize(n: number) { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`; }
