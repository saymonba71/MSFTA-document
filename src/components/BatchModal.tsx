import { useEffect, useRef, useState } from "react";
import type { Seal, Stamp } from "../types";
import { stampMany } from "../lib/doc";
import { Icon, Modal } from "./ui";
import { prepareFile, releaseFile, type PreparedFile } from "../lib/download";
import { DownloadResult } from "./DownloadResult";

export function BatchModal({
  open,
  onClose,
  pattern,
  seals,
}: {
  open: boolean;
  onClose: () => void;
  pattern: Stamp[];
  seals: Seal[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [allPages, setAllPages] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedFile | null>(null);
  const running = useRef(false);
  useEffect(() => () => releaseFile(result), [result]);
  useEffect(() => { setResult(null); setError(""); }, [files, allPages, open, pattern, seals]);

  const run = async () => {
    if (!files.length || running.current) return;
    running.current = true;
    setError("");
    setBusy("শুরু হচ্ছে...");
    try {
      const blob = await stampMany(files, pattern, seals, allPages, setBusy);
      setResult(prepareFile(blob, `batch-sealed-${files.length}.zip`));
    } catch (e) {
      setError((e as Error).message || "ব্যাচ কাজটি হয়নি");
    } finally {
      setBusy(null);
      running.current = false;
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="একই সিল অনেক ফাইলে">
      <div className="space-y-4">
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          এই পেজের <b>{pattern.length}</b> টি সিল একই জায়গায় প্রতিটি ফাইলে বসবে। তারপর সব একসাথে ZIP-এ নামবে।
          {pattern.length === 0 && <span className="mt-1 block text-amber-700">আগে এই পেজে অন্তত একটি সিল বসান।</span>}
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-slate-600 hover:border-blue-400 hover:bg-blue-50/40">
          <Icon.Upload className="h-7 w-7" />
          <span className="font-semibold">{files.length ? `${files.length}টি ফাইল বেছে নেওয়া হয়েছে` : "ছবি বা PDF বেছে নিন"}</span>
          <span className="text-xs">একসাথে সর্বোচ্চ ৪০টি</span>
          <input
            type="file"
            disabled={!!busy}
            accept="image/*,application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = [...(e.target.files ?? [])];
              if (list.length > 40) { setError("সর্বোচ্চ ৪০টি ফাইল দিন। কোনো ফাইল বাদ দিয়ে কাজ করা হয়নি।"); return; }
              setFiles(list);
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" disabled={!!busy} checked={allPages} onChange={(e) => setAllPages(e.target.checked)} className="h-4 w-4 accent-blue-600" />
          PDF-এর সব পেজে বসান
        </label>
        {error && <p className="download-error" role="alert">{error}</p>}
        {result ? <DownloadResult key={result.url} file={result} /> : <button
          disabled={!files.length || !pattern.length || !!busy}
          onClick={run}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon.Download className="h-5 w-5" />}
          {busy || "সিল বসিয়ে ZIP তৈরি করুন"}
        </button>}
      </div>
    </Modal>
  );
}
