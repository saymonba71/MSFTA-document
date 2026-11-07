import { useEffect, useRef, useState } from "react";
import { Icon, Modal } from "./ui";
import { DownloadResult } from "./DownloadResult";
import { makeImagePdf, readImagePdfItems, type ImagePdfItem, type ImagePdfLayout } from "../lib/imagePdf";
import { prepareFile, releaseFile, type PreparedFile } from "../lib/download";

export function ImagePdfModal({ open, onClose, onEdit }: { open: boolean; onClose: () => void; onEdit: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const guard = useRef(false);
  const alive = useRef(true);
  const urls = useRef(new Set<string>());
  const dragDepth = useRef(0);
  const [items, setItems] = useState<ImagePdfItem[]>([]);
  const [layout, setLayout] = useState<ImagePdfLayout>("a4");
  const [name, setName] = useState("photos");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedFile | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { alive.current = true; return () => { alive.current = false; urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current.clear(); }; }, []);
  useEffect(() => () => releaseFile(result), [result]);
  useEffect(() => {
    if (open) return;
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setItems([]); setResult(null); setError(""); setName("photos"); setLayout("a4"); setDragging(false); dragDepth.current = 0;
  }, [open]);

  const add = async (files: File[]) => {
    if (!files.length || guard.current) return;
    guard.current = true; setProgress("ছবি পড়া হচ্ছে..."); setError("");
    try {
      const next = await readImagePdfItems(files, items.length);
      if (!alive.current) { next.forEach((item) => URL.revokeObjectURL(item.src)); return; }
      next.forEach((item) => urls.current.add(item.src));
      setItems((current) => [...current, ...next]); setResult(null);
    } catch (cause) { if (alive.current) setError((cause as Error).message || "ছবি পড়া যায়নি।"); }
    finally { guard.current = false; if (alive.current) setProgress(""); }
  };
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items]; [next[index], next[to]] = [next[to], next[index]];
    setItems(next); setResult(null);
  };
  const remove = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (item) { URL.revokeObjectURL(item.src); urls.current.delete(item.src); }
    setItems((current) => current.filter((entry) => entry.id !== id)); setResult(null);
  };
  const create = async () => {
    if (guard.current) return;
    guard.current = true; setProgress("PDF তৈরি হচ্ছে..."); setError("");
    try {
      const blob = await makeImagePdf(items, layout, setProgress);
      const ready = prepareFile(blob, `${name.replace(/\.pdf$/i, "").trim() || "photos"}.pdf`);
      if (alive.current) setResult(ready); else releaseFile(ready);
    } catch (cause) { if (alive.current) setError((cause as Error).message || "PDF তৈরি হয়নি।"); }
    finally { guard.current = false; if (alive.current) setProgress(""); }
  };

  return <Modal open={open} onClose={progress ? () => {} : onClose} title="ছবি থেকে PDF" wide>
    <div className={`image-pdf${dragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); dragDepth.current++; if (!progress) setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { event.preventDefault(); dragDepth.current--; if (dragDepth.current <= 0) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!progress) void add(Array.from(event.dataTransfer.files)); }}>
      <input ref={input} data-testid="image-pdf-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden disabled={!!progress} onChange={(event) => { void add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
      {!items.length ? <div className="image-pdf-empty">
        <span className="image-pdf-empty-icon"><Icon.Image className="h-6 w-6" /></span>
        <h4>{dragging ? "ছবি এখানে ছেড়ে দিন" : "ছবিগুলো একটি PDF-এ আনুন"}</h4>
        <p>পছন্দমতো ক্রম সাজিয়ে প্রতিটি ছবি আলাদা পেজ হিসেবে রাখুন।</p>
        <button type="button" className="organizer-primary" disabled={!!progress} onClick={() => input.current?.click()}><Icon.Plus className="h-4 w-4" /> ছবি বেছে নিন</button>
        <small>JPG, PNG, WEBP · সর্বোচ্চ ৪০টি</small>
      </div> : <>
        <div className="image-pdf-head"><div><b>{items.length}টি ছবি</b><span>প্রতিটি ছবি একটি পেজ</span></div><button type="button" disabled={!!progress || items.length >= 40} onClick={() => input.current?.click()}><Icon.Plus className="h-4 w-4" /> আরও ছবি</button></div>
        <div className="image-pdf-list" aria-label="ছবির ক্রম">
          {items.map((item, index) => <div className="image-pdf-row" key={item.id} data-image-pdf-item={item.file.name}>
            <span className="image-pdf-order">{String(index + 1).padStart(2, "0")}</span>
            <img src={item.src} alt="" />
            <div className="image-pdf-file"><b title={item.file.name}>{item.file.name}</b><span>{item.width} × {item.height} px</span></div>
            <div className="image-pdf-row-actions">
              <button type="button" title="আগে সরান" aria-label={`${item.file.name} আগে সরান`} disabled={!!progress || index === 0} onClick={() => move(index, -1)}><Icon.ArrowUp className="h-4 w-4" /></button>
              <button type="button" title="পরে সরান" aria-label={`${item.file.name} পরে সরান`} disabled={!!progress || index === items.length - 1} onClick={() => move(index, 1)}><Icon.ArrowDown className="h-4 w-4" /></button>
              <button type="button" title="ছবি বাদ দিন" aria-label={`${item.file.name} বাদ দিন`} disabled={!!progress} onClick={() => remove(item.id)}><Icon.Trash className="h-4 w-4" /></button>
            </div>
          </div>)}
        </div>
        <fieldset className="image-pdf-options" disabled={!!progress}>
          <legend>পেজের আকার</legend>
          <label><input type="radio" name="image-pdf-layout" value="a4" checked={layout === "a4"} onChange={() => { setLayout("a4"); setResult(null); }} /><span><b>A4 পেজ</b><small>ছবি অনুযায়ী খাড়া বা আড়াআড়ি হবে</small></span></label>
          <label><input type="radio" name="image-pdf-layout" value="original" checked={layout === "original"} onChange={() => { setLayout("original"); setResult(null); }} /><span><b>ছবির অনুপাতে</b><small>প্রতিটি পেজের অনুপাত ছবি অনুযায়ী</small></span></label>
        </fieldset>
        <label className="organizer-filename">ফাইলের নাম<input aria-label="ছবির PDF-এর নাম" value={name} maxLength={100} disabled={!!progress} onChange={(event) => { setName(event.target.value); setResult(null); }} /></label>
        {!result ? <button type="button" className="organizer-primary organizer-create" disabled={!!progress} onClick={create}><Icon.File className="h-4 w-4" /> PDF তৈরি করুন</button> : <div className="image-pdf-result"><DownloadResult key={result.url} file={result} /><button type="button" className="image-pdf-edit" onClick={() => { const file = new File([result.blob], result.filename, { type: "application/pdf" }); onClose(); onEdit(file); }}><Icon.Edit className="h-4 w-4" /> এই PDF-এ সিল বসান</button></div>}
      </>}
      {progress && <p className="organizer-progress" role="status"><span className="export-spinner" /> {progress}</p>}
      {error && <p className="download-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}