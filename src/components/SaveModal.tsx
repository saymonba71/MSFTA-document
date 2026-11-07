import { useEffect, useRef, useState } from "react";
import type { Doc, Seal, Stamp } from "../types";
import { Icon, Modal } from "./ui";
import { baseName, canvasToBlob, composePage, exportFlatPdf, exportPdf, exportZip, originalFileBlob } from "../lib/doc";
import { prepareFile, releaseFile, safeFilename, type PreparedFile } from "../lib/download";
import { exportEditableProject } from "../lib/project";
import { DownloadResult } from "./DownloadResult";

type Format = "png" | "jpg" | "pdf" | "flat" | "zip" | "project" | "original";
type Props = { open: boolean; onClose: () => void; doc: Doc; stamps: Stamp[]; seals: Seal[]; pageIdx: number };
const descriptions: Record<Format, string> = {
  png: "এই পেজের পরিষ্কার ছবি। মূল রেজোলিউশন বজায় থাকবে।",
  jpg: "এই পেজ ছোট ফাইল হিসেবে। শেয়ার করার জন্য উপযুক্ত।",
  pdf: "সব পেজসহ মূল PDF। মূল লেখা নির্বাচন ও সার্চ করা যাবে।",
  flat: "সব পেজ ছবি হিসেবে PDF-এ থাকবে। মূল লেখায় আর সার্চ করা যাবে না।",
  zip: "সব পেজের PNG ছবি একসঙ্গে একটি ZIP-এ।",
  project: "নথি, সিল, অবস্থান ও আলো-কালির সেটিংস। পরে খুলে আবার সম্পাদনা করুন।",
  original: "সিল ছাড়া মূল ফাইল। ছবির ক্ষেত্রে বর্তমান পেজটি সেভ হবে।",
};

export function SaveModal({ open, onClose, doc, stamps, seals, pageIdx }: Props) {
  const [format, setFormat] = useState<Format>(doc.kind === "pdf" ? "pdf" : "png");
  const [filename, setFilename] = useState("");
  const [quality, setQuality] = useState(.92);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreparedFile | null>(null);
  const guard = useRef(false);
  const alive = useRef(true);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => () => releaseFile(result), [result]);
  useEffect(() => {
    if (open) { setFilename(safeFilename(`${baseName(doc.name)}-sealed`)); setFormat(doc.kind === "pdf" ? "pdf" : "png"); }
    setResult(null); setError("");
  }, [open, doc]);
  useEffect(() => { setResult(null); setError(""); }, [format, filename, quality, stamps, seals, pageIdx]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let url: string | undefined;
    setPreview(null); setPreviewError("");
    (async () => {
      const canvas = await composePage(doc.pages[pageIdx], stamps.filter((s) => s.page === pageIdx), seals, 1200);
      const blob = await canvasToBlob(canvas, "image/png");
      if (!active) return;
      url = URL.createObjectURL(blob); setPreview(url);
    })().catch((cause) => { if (active) setPreviewError((cause as Error).message || "প্রিভিউ তৈরি হয়নি।"); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [open, doc, stamps, seals, pageIdx]);

  const prepare = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      let blob: Blob;
      let ext: string = format;
      let suffix = "";
      if (format === "pdf") blob = await exportPdf(doc, stamps, seals);
      else if (format === "flat") { blob = await exportFlatPdf(doc, stamps, seals); ext = "pdf"; }
      else if (format === "zip") blob = await exportZip(doc, stamps, seals);
      else if (format === "project") { blob = await exportEditableProject({ doc, stamps, seals, pageIdx }); ext = "sealproject"; }
      else if (format === "original") {
        blob = await originalFileBlob(doc, pageIdx);
        const mime = blob.type || doc.pages[pageIdx].mime || doc.mime;
        ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        suffix = `-original${doc.kind === "image" && doc.pages.length > 1 ? `-page-${pageIdx + 1}` : ""}`;
      } else {
        const canvas = await composePage(doc.pages[pageIdx], stamps.filter((s) => s.page === pageIdx), seals);
        blob = await canvasToBlob(canvas, format === "png" ? "image/png" : "image/jpeg", quality);
        if (doc.pages.length > 1) suffix = `-page-${pageIdx + 1}`;
      }
      const name = safeFilename(filename.replace(/\.(png|jpg|jpeg|pdf|zip|sealproject)$/i, "") || `${baseName(doc.name)}-sealed`);
      const ready = prepareFile(blob, `${name}${suffix}.${ext}`);
      if (alive.current) {
        setResult(ready);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      } else releaseFile(ready);
    } catch (cause) { if (alive.current) setError((cause as Error).message || "ফাইল তৈরি করা যায়নি। আবার চেষ্টা করুন।"); }
    finally { guard.current = false; if (alive.current) setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="সেভ ও ডাউনলোড" wide>
      <div className="export-layout" aria-busy={busy}>
        <div className="export-preview-column">
          <div className="export-preview">
            {preview ? <img src={preview} alt="ডাউনলোড প্রিভিউ" /> : previewError ? <p role="alert">{previewError}</p> : <span className="export-spinner" aria-label="প্রিভিউ তৈরি হচ্ছে" />}
          </div>
          <p className="export-caption">পেজ {pageIdx + 1} / {doc.pages.length} · {stamps.filter((s) => !s.hidden).length}টি দৃশ্যমান স্তর</p>
          <p className="export-private"><Icon.Shield className="h-4 w-4" /> মূল ফাইল বদলায় না। সব কাজ আপনার ডিভাইসেই।</p>
        </div>
        <div className="export-options">
          <fieldset disabled={busy}>
            <label>ফাইলের নাম<input aria-label="ফাইলের নাম" value={filename} onChange={(e) => setFilename(e.target.value)} maxLength={120} /><span className="export-filename-note">ডাউনলোডে সমস্যা এড়াতে ইংরেজি অক্ষরে নাম রাখুন।</span></label>
            <label>ফাইলের ধরন<select aria-label="ফাইলের ধরন" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {doc.kind === "pdf" && <option value="pdf">PDF · মূল লেখা অক্ষত</option>}
              <option value="png">PNG · পরিষ্কার ছবি</option>
              <option value="jpg">JPG · ছোট ফাইল</option>
              <option value="flat">PDF · সব পেজ ছবি হিসেবে</option>
              {doc.pages.length > 1 && <option value="zip">ZIP · সব পেজের PNG</option>}
              <option value="project">এডিটেবল প্রজেক্ট</option>
              <option value="original">মূল ফাইল (সিল ছাড়া)</option>
            </select></label>
            <p className="export-description">{descriptions[format]}</p>
            {format === "jpg" && <label>JPG কোয়ালিটি: {Math.round(quality * 100)}%<input type="range" aria-label="JPG কোয়ালিটি" min={.5} max={1} step={.01} value={quality} onChange={(e) => setQuality(+e.target.value)} /></label>}
          </fieldset>
          {error && <p className="download-error" role="alert">{error}</p>}
          {!result && <button type="button" className="export-prepare" disabled={busy || !!previewError} onClick={prepare}>{busy ? <span className="export-spinner" /> : <Icon.Download className="h-4 w-4" />}{busy ? "ফাইল তৈরি হচ্ছে" : "ফাইল তৈরি করুন"}</button>}
          <div ref={resultRef}>{result && <DownloadResult key={result.url} file={result} />}</div>
          {!result && <p className="export-step-note">তৈরি হলে সরাসরি ডাউনলোড লিংক পাবেন।</p>}
        </div>
      </div>
    </Modal>
  );
}