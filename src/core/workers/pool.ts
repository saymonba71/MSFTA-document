export type WorkerTask = { op: string; payload: unknown; transfer?: Transferable[] };
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; progress?: (p: number, msg?: string) => void };
export class WorkerPool {
  private idle: Worker[] = []; private busy = new Map<Worker, number>(); private warming = new Set<Worker>(); private queue: { task: WorkerTask; id: number; pending: Pending }[] = []; private nextId = 1; private pending = new Map<number, Pending>(); private disposed = false;
  constructor(private factory: () => Worker, private size = 2) {}
  run<R>(task: WorkerTask, progress?: (p: number, msg?: string) => void): Promise<R> { if (this.disposed) return Promise.reject(new Error("Pool disposed")); return new Promise<R>((resolve, reject) => { const id = this.nextId++; this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress }); this.queue.push({ task, id, pending: this.pending.get(id)! }); this.pump(); }); }
  private pump() { while (this.queue.length && (this.idle.length || this.busy.size + this.warming.size < this.size)) { const w = this.idle.pop(); if (!w) { this.spawn(); break; } const job = this.queue.shift()!; this.busy.set(w, job.id); w.postMessage({ id: job.id, ...job.task }, job.task.transfer ?? []); } }
  private spawn(): Worker { const w = this.factory(); this.warming.add(w); w.onmessage = (e: MessageEvent) => { const { id, ok, result, error, progress, message } = e.data as { id: number; ok?: boolean; result?: unknown; error?: string; progress?: number; message?: string }; if (id === 0 && (result as { ready?: boolean })?.ready) { this.warming.delete(w); this.idle.push(w); this.pump(); return; } const p = this.pending.get(id); if (progress !== undefined) { p?.progress?.(progress, message); return; } this.busy.delete(w); this.idle.push(w); if (p) { this.pending.delete(id); ok ? p.resolve(result) : p.reject(new Error(error || "Worker failed")); } this.pump(); }; w.onerror = () => { const id = this.busy.get(w); this.busy.delete(w); this.warming.delete(w); w.terminate(); if (id !== undefined) { const p = this.pending.get(id); this.pending.delete(id); p?.reject(new Error("Worker crash")); } this.pump(); }; return w; }
  cancelAll() { this.queue = []; for (const [w, id] of this.busy) { this.pending.get(id)?.reject(new Error("Cancelled")); this.pending.delete(id); w.terminate(); } this.busy.clear(); this.warming.forEach((w) => w.terminate()); this.warming.clear(); this.idle.forEach((w) => w.terminate()); this.idle = []; }
  dispose() { this.disposed = true; this.cancelAll(); }
}
import PdfWorker from "./pdf.worker?worker";
import ImageWorker from "./image.worker?worker";
let pdfPool: WorkerPool | null = null; let imagePool: WorkerPool | null = null;
export const pdfPoolGet = () => (pdfPool ??= new WorkerPool(() => new PdfWorker(), 2));
export const imagePoolGet = () => (imagePool ??= new WorkerPool(() => new ImageWorker(), 2));
export function runPdf<R>(op: string, payload: unknown, transfer?: Transferable[], progress?: (p: number, m?: string) => void) { return pdfPoolGet().run<R>({ op, payload, transfer }, progress); }
export function runImage<R>(op: string, payload: unknown, transfer?: Transferable[], progress?: (p: number, m?: string) => void) { return imagePoolGet().run<R>({ op, payload, transfer }, progress); }
