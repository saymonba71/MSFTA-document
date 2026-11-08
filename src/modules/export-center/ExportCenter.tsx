import { useEffect, useState } from "react";
import { exportQueue, downloadBlob, prettySize, type ExportJob } from "../../core/export/queue";
import { Button, ModuleHeader, Empty, Notice } from "../../ui/primitives";
import { getAll } from "../../core/storage/db";

type Row = { id: string; filename: string; size: number; blob: Blob; createdAt: number };

export default function ExportCenter() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [storage, setStorage] = useState("");

  useEffect(() => {
    const sync = () => {
      setJobs(exportQueue.jobs());
      void getAll("exports").then((rows) => setHistory(rows.map((r) => ({ id: r.id, filename: r.filename, size: r.size, blob: r.blob, createdAt: r.createdAt })).sort((a, b) => b.createdAt - a.createdAt)));
    };
    sync();
    const off = exportQueue.subscribe(sync);
    navigator.storage?.estimate?.().then((e) => setStorage(`${prettySize(e.usage ?? 0)} / ${prettySize(e.quota ?? 0)}`)).catch(() => {});
    return off;
  }, []);

  return <div className="iso-module" data-testid="export-center">
    <ModuleHeader icon="📤" title="Export Center" desc="Queue · real encoded sizes · persisted results (IndexedDB) · retry · cancel" />
    <Notice>স্টোরেজ: {storage || "…"} · ফলাফল ব্রাউজারেই থাকে; কোনো আপলোড নেই।</Notice>
    <h2>এই সেশনের কিউ</h2>
    {jobs.length === 0 ? <Empty text="এখনো কোনো export নেই" /> : <div className="iso-list">{jobs.map((j) => <div key={j.id} className="iso-card iso-row">
      <span className={`iso-badge is-${j.status}`}>{j.status}</span>
      <b>{j.filename}</b><span>{j.format.toUpperCase()}</span>
      {j.size != null && <span>{prettySize(j.size)}</span>}
      {j.status === "running" && <progress max={1} value={j.progress} />}
      {j.error && <small className="iso-error">{j.error}</small>}
      <div className="iso-row">
        {j.blob && <Button onClick={() => downloadBlob(j.blob!, j.filename)}>Download</Button>}
        {(j.status === "running" || j.status === "queued") && <Button onClick={() => exportQueue.cancel(j.id)}>Cancel</Button>}
        {(j.status === "error" || j.status === "cancelled") && <Button onClick={() => exportQueue.retry(j.id)}>Retry</Button>}
        <Button variant="ghost" onClick={() => void exportQueue.remove(j.id)}>Remove</Button>
      </div>
    </div>)}</div>}
    <h2>সংরক্ষিত ইতিহাস ({history.length})</h2>
    {history.length === 0 ? <Empty text="ইতিহাস খালি" /> : <div className="iso-list">{history.map((h) => <div key={h.id} className="iso-card iso-row">
      <b>{h.filename}</b><span>{prettySize(h.size)}</span><small>{new Date(h.createdAt).toLocaleString()}</small>
      <Button onClick={() => downloadBlob(h.blob, h.filename)}>Download</Button>
      <Button variant="ghost" onClick={async () => { await exportQueue.remove(h.id); setHistory((x) => x.filter((y) => y.id !== h.id)); }}>Remove</Button>
    </div>)}</div>}
  </div>;
}
