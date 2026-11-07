import { useRef, useState } from "react";
import { canPickSaveLocation, isEmbedded, prettySize, savePreparedFile, type PreparedFile } from "../lib/download";
import { Icon } from "./ui";
import { cn } from "../utils/cn";

export function DownloadResult({ file, dark = false }: { file: PreparedFile; dark?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const guard = useRef(false);
  const isImage = file.blob.type.startsWith("image/");
  const canOpen = isImage || file.blob.type === "application/pdf";
  const canCopy = file.blob.type === "image/png" && typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
  const shareFile = new File([file.blob], file.filename, { type: file.blob.type });
  let canShare = false;
  try { canShare = !!navigator.canShare?.({ files: [shareFile] }); } catch { /* unavailable in this context */ }

  const action = async (task: () => Promise<string>) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setMessage(""); setError("");
    try { setMessage(await task()); }
    catch (cause) { if ((cause as Error).name !== "AbortError") setError((cause as Error).message || "কাজটি হয়নি। ডাউনলোড লিংক দিয়ে চেষ্টা করুন।"); }
    finally { guard.current = false; setBusy(false); }
  };

  const print = async () => {
    const frame = document.createElement("iframe");
    frame.title = "প্রিন্ট প্রিভিউ";
    frame.style.cssText = "position:fixed;inset:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none";
    // Give printing its own URL so closing the export modal cannot interrupt it.
    const url = URL.createObjectURL(file.blob);
    const cleanup = () => { frame.remove(); URL.revokeObjectURL(url); };
    const timeout = window.setTimeout(cleanup, 120_000);
    await new Promise<void>((resolve, reject) => {
      frame.onload = async () => {
        try {
          const win = frame.contentWindow!;
          await win.document.querySelector("img")!.decode();
          win.addEventListener("afterprint", () => { window.clearTimeout(timeout); cleanup(); }, { once: true });
          win.focus(); win.print(); resolve();
        } catch (cause) { window.clearTimeout(timeout); cleanup(); reject(cause); }
      };
      frame.srcdoc = `<html><head><style>@page{margin:8mm}body{margin:0}img{display:block;max-width:100%;max-height:95vh;margin:auto}</style></head><body><img src="${url}"></body></html>`;
      document.body.appendChild(frame);
    });
    return "প্রিন্টের অনুরোধ পাঠানো হয়েছে।";
  };

  return (
    <section className={cn("download-result", dark && "download-result-dark")} aria-label="তৈরি ফাইল">
      <div className="download-ready"><Icon.Check className="h-4 w-4" /><span>ফাইল প্রস্তুত</span><small>{prettySize(file.blob.size)}</small></div>
      <p className="download-filename" title={file.filename}>{file.filename}</p>
      <a data-testid="download-file" href={file.url} download={file.filename} className="download-primary" onClick={() => { setError(""); setMessage("ডাউনলোডের অনুরোধ পাঠানো হয়েছে। ব্রাউজারের Downloads দেখুন।"); }}>
        <Icon.Download className="h-4 w-4" /> ডাউনলোড করুন
      </a>
      {isEmbedded() && <p className="download-note">প্রিভিউ ফ্রেমে ডাউনলোড বন্ধ থাকতে পারে। না নামলে সাইটটি আলাদা ব্রাউজার ট্যাবে খুলুন। এই নিষেধাজ্ঞা অ্যাপ থেকে বদলানো যায় না।</p>}
      {message && <p className="download-message" role="status">{message}</p>}
      {error && <p className="download-error" role="alert">{error}</p>}
      <details className="download-alternatives">
        <summary>না নামলে অন্যভাবে সেভ করুন</summary>
        <div className="download-alternative-actions">
          {canOpen && <a href={file.url} target="_blank" rel="noopener noreferrer" data-testid="open-result"><Icon.Expand className="h-3.5 w-3.5" /> নতুন ট্যাবে খুলুন</a>}
          {canPickSaveLocation() && <button type="button" disabled={busy} onClick={() => action(async () => {
            const status = await savePreparedFile(file);
            return status === "saved" ? "নির্বাচিত স্থানে সেভ হয়েছে।" : status === "cancelled" ? "সেভ বাতিল করেছেন। ফাইলটি এখানেই আছে।" : "এখানে সেভ ডায়ালগ সমর্থিত নয়। ডাউনলোড লিংকটি ব্যবহার করুন।";
          })}><Icon.Folder className="h-3.5 w-3.5" /> সেভের স্থান বাছুন</button>}
          {canShare && <button type="button" disabled={busy} onClick={() => action(async () => { await navigator.share({ files: [shareFile] }); return "শেয়ার করা হয়েছে।"; })}><Icon.Share className="h-3.5 w-3.5" /> শেয়ার</button>}
          {canCopy && <button type="button" disabled={busy} onClick={() => action(async () => { await navigator.clipboard.write([new ClipboardItem({ "image/png": file.blob })]); return "ছবি কপি হয়েছে।"; })}><Icon.Copy className="h-3.5 w-3.5" /> ছবি কপি</button>}
          {isImage && <button type="button" disabled={busy} onClick={() => action(print)}><Icon.Print className="h-3.5 w-3.5" /> প্রিন্ট</button>}
        </div>
        {isImage && <details className="download-image-viewer"><summary>ছবি দেখুন ও ধরে সেভ করুন</summary><p>মোবাইলে ছবির ওপর চেপে ধরে “Save image” বেছে নিন, যদি ব্রাউজার অনুমতি দেয়।</p><img src={file.url} alt="সেভ করার জন্য তৈরি ছবি" /></details>}
      </details>
    </section>
  );
}