import { useEffect, useRef, useState } from "react";
import { Icon, Modal } from "./ui";
import { DownloadResult } from "./DownloadResult";
import { createOrganizedPdf, createSeparatePdfZip, readPdfPages, type ManagedPage, type PdfSource } from "../lib/pdfPages";
import { prepareFile, releaseFile, type PreparedFile } from "../lib/download";
import { cn } from "../utils/cn";

export function PdfOrganizer({ open, onClose, initialFile }: { open: boolean; onClose: () => void; initialFile?: File | null }) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const guard = useRef(false);
  const [sources, setSources] = useState<PdfSource[]>([]);
  const [pages, setPages] = useState<ManagedPage[]>([]);
  const [history, setHistory] = useState<ManagedPage[][]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("organized-document");
  const [outputType, setOutputType] = useState<"pdf" | "zip">("pdf");
  const [result, setResult] = useState<PreparedFile | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => () => releaseFile(result), [result]);
  useEffect(() => { if (!open) { setSources([]); setPages([]); setHistory([]); setResult(null); setError(""); setProgress(""); } }, [open]);

  const addFiles = async (files: File[]) => {
    if (!files.length || guard.current) return;
    guard.current = true;
    setError("");
    setResult(null);
    setProgress("PDF খোলা হচ্ছে...");
    try {
      const loaded = await readPdfPages(files, pages.length, setProgress);
      if (!active.current) return;
      setSources((current) => [...current, ...loaded.sources]);
      setPages((current) => [...current, ...loaded.pages]);
      setHistory([]);
    } catch (cause) { if (active.current) setError((cause as Error).message || "PDF খোলা যায়নি।"); }
    finally { guard.current = false; if (active.current) setProgress(""); }
  };

  useEffect(() => {
    if (open && initialFile) void addFiles([initialFile]);
    // Opening a new manager session is the only point at which initialFile is consumed.
  }, [open, initialFile]);

  const change = (next: ManagedPage[]) => {
    setHistory((previous) => [...previous.slice(-19), pages]);
    setPages(next);
    setResult(null);
    setError("");
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setPages(previous);
    setHistory((current) => current.slice(0, -1));
    setResult(null);
  };
  const create = async () => {
    if (guard.current) return;
    guard.current = true;
    setError("");
    setProgress("PDF তৈরি হচ্ছে...");
    try {
      const blob = outputType === "zip" ? await createSeparatePdfZip(sources, pages, setProgress) : await createOrganizedPdf(sources, pages);
      const ready = prepareFile(blob, `${filename.replace(/\.(pdf|zip)$/i, "") || "organized-document"}.${outputType}`);
      if (active.current) setResult(ready); else releaseFile(ready);
    } catch (cause) { if (active.current) setError((cause as Error).message || "PDF তৈরি হয়নি।"); }
    finally { guard.current = false; if (active.current) setProgress(""); }
  };

  const included = pages.filter((page) => page.included).length;
  return (
    <Modal open={open} onClose={progress ? () => {} : onClose} title="PDF পেজ সাজান" wide>
      <div className="organizer">
        <input ref={input} data-testid="organizer-input" type="file" accept="application/pdf,.pdf" multiple hidden disabled={!!progress} onChange={(e) => { void addFiles(Array.from(e.currentTarget.files ?? [])); e.currentTarget.value = ""; }} />
        {!pages.length ? (
          <div className="organizer-empty">
            <span><Icon.Layers className="h-7 w-7" /></span>
            <h4>পেজগুলো নিজের মতো সাজান</h4>
            <p>একাধিক PDF একসঙ্গে খুলে পেজের ক্রম বদলান, ঘোরান বা বাদ দিন।</p>
            <button disabled={!!progress} className="organizer-primary" onClick={() => input.current?.click()}><Icon.Upload className="h-4 w-4" /> PDF বেছে নিন</button>
          </div>
        ) : (
          <>
            <div className="organizer-topline">
              <div><b>{included}টি পেজ নির্বাচিত</b><small>{sources.length}টি PDF থেকে</small></div>
              <div className="organizer-actions">
                <button disabled={!history.length || !!progress} onClick={undo} title="আগের অবস্থায় ফিরুন"><Icon.Undo className="h-4 w-4" /> ফিরুন</button>
                <button disabled={!!progress || pages.length >= 80} onClick={() => input.current?.click()}><Icon.Plus className="h-4 w-4" /> PDF যোগ</button>
              </div>
            </div>
            <p className="organizer-instruction">তীর দিয়ে পেজ সরান। যে পেজ লাগবে না, তার টিক তুলে দিন।</p>
            <div className="organizer-pages" data-testid="organizer-pages">
              {pages.map((page, index) => (
                <article key={page.id} data-page-id={page.id} data-source-page={page.originalIndex + 1} className={cn("organizer-page", !page.included && "is-excluded")}>
                  <label className="organizer-select"><input type="checkbox" checked={page.included} onChange={(event) => change(pages.map((item) => item.id === page.id ? { ...item, included: event.target.checked } : item))} aria-label={`${page.sourceName} পেজ ${page.originalIndex + 1} অন্তর্ভুক্ত`} /><span>{index + 1}</span></label>
                  <div className="organizer-thumb"><img src={page.thumbnail} alt={`${page.sourceName} পেজ ${page.originalIndex + 1}`} style={{ transform: `rotate(${page.rotation}deg)`, maxHeight: page.rotation % 180 ? "70%" : undefined }} /></div>
                  <p title={`${page.sourceName}, পেজ ${page.originalIndex + 1}`}>{page.sourceName}</p>
                  <small>মূল পেজ {page.originalIndex + 1}</small>
                  <div className="organizer-page-tools">
                    <button title="আগে সরান" aria-label={`${page.sourceName} পেজ ${page.originalIndex + 1} আগে সরান`} disabled={index === 0 || !!progress} onClick={() => move(index, -1)}><Icon.Back className="h-4 w-4" /></button>
                    <button title="পরে সরান" aria-label={`${page.sourceName} পেজ ${page.originalIndex + 1} পরে সরান`} disabled={index === pages.length - 1 || !!progress} onClick={() => move(index, 1)}><Icon.Next className="h-4 w-4" /></button>
                    <button title="৯০ ডিগ্রি ঘোরান" aria-label={`${page.sourceName} পেজ ${page.originalIndex + 1} ঘোরান`} disabled={!!progress} onClick={() => change(pages.map((item) => item.id === page.id ? { ...item, rotation: ((item.rotation + 90) % 360) as ManagedPage["rotation"] } : item))}><Icon.Rotate className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
            <p className="organizer-caveat">মূল পেজের লেখা ও ছবি থাকবে। নতুন PDF-এ বুকমার্ক ও কিছু ইন্টারঅ্যাক্টিভ ফর্ম নাও থাকতে পারে।</p>
            <label className="organizer-filename">কীভাবে সেভ করবেন <select aria-label="PDF আউটপুটের ধরন" value={outputType} disabled={!!progress} onChange={(event) => { setOutputType(event.target.value as "pdf" | "zip"); setResult(null); }}><option value="pdf">একটি PDF-এ সব পেজ</option><option value="zip">প্রতি পেজ আলাদা PDF (ZIP)</option></select></label>
            <label className="organizer-filename">ফাইলের নাম <input aria-label="সাজানো PDF-এর নাম" value={filename} maxLength={100} disabled={!!progress} onChange={(event) => { setFilename(event.target.value); setResult(null); }} /></label>
            {!result && <button className="organizer-primary organizer-create" disabled={!included || !!progress} onClick={create}><Icon.Download className="h-4 w-4" /> {outputType === "pdf" ? "সাজানো PDF তৈরি করুন" : "আলাদা পেজের ZIP তৈরি করুন"}</button>}
            {result && <DownloadResult key={result.url} file={result} />}
          </>
        )}
        {progress && <p className="organizer-progress" role="status"><span className="export-spinner" /> {progress}</p>}
        {error && <p className="download-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}