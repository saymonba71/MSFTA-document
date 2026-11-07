import { useEffect, useRef, useState } from "react";
import type { Seal } from "../types";
import { canvasToBlob } from "../lib/doc";
import { prepareFile, releaseFile, type PreparedFile } from "../lib/download";
import { loadImage } from "../lib/seal";
import { DownloadResult } from "./DownloadResult";
import { Icon, Modal } from "./ui";

/** Export only the seal artwork, retaining its transparent background. */
export function SealExportModal({ open, onClose, seal }: { open: boolean; onClose: () => void; seal: Seal }) {
  const [size, setSize] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedFile | null>(null);
  const guard = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => () => releaseFile(result), [result]);
  useEffect(() => { if (!open) { setResult(null); setError(""); setSize(1024); } }, [open]);
  useEffect(() => { setResult(null); setError(""); }, [size, seal]);

  const create = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      await document.fonts.ready;
      const image = await loadImage(seal.src);
      const ratio = image.naturalWidth / image.naturalHeight || seal.aspect;
      const canvas = document.createElement("canvas");
      canvas.width = ratio >= 1 ? size : Math.max(1, Math.round(size * ratio));
      canvas.height = ratio >= 1 ? Math.max(1, Math.round(size / ratio)) : size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("সিলের ছবি তৈরি করা যায়নি।");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, "image/png");
      const ready = prepareFile(blob, "seal-transparent.png");
      if (alive.current) setResult(ready); else releaseFile(ready);
    } catch (cause) { if (alive.current) setError((cause as Error).message || "সিল তৈরি করা যায়নি।"); }
    finally { guard.current = false; if (alive.current) setBusy(false); }
  };

  return <Modal open={open} onClose={busy ? () => {} : onClose} title="সিল ডাউনলোড">
    <div className="seal-export">
      <div className="seal-export-preview checker"><img src={seal.src} alt={`${seal.name} প্রিভিউ`} /></div>
      <div><h4>{seal.name}</h4><p>স্বচ্ছ ব্যাকগ্রাউন্ডসহ PNG ফাইল তৈরি হবে।</p></div>
      <label className="organizer-filename">সর্বোচ্চ আকার<select aria-label="সিলের ছবির আকার" value={size} disabled={busy} onChange={(event) => setSize(Number(event.target.value))}><option value={512}>512 px</option><option value={1024}>1024 px</option><option value={2048}>2048 px</option></select></label>
      <p className="seal-export-note">ছবির স্পষ্টতা আপলোড করা সিলের মূল মানের ওপরও নির্ভর করে।</p>
      {error && <p className="download-error" role="alert">{error}</p>}
      {result ? <DownloadResult key={result.url} file={result} /> : <button className="organizer-primary organizer-create" type="button" disabled={busy} onClick={create}>{busy ? <span className="export-spinner" /> : <Icon.Download className="h-4 w-4" />} {busy ? "তৈরি হচ্ছে..." : "স্বচ্ছ PNG তৈরি করুন"}</button>}
    </div>
  </Modal>;
}