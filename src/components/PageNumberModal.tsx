import { useState } from "react";
import { Icon, Modal } from "./ui";

export type PageNumberOptions = {
  start: number;
  language: "bn" | "en";
  style: "number" | "fraction";
  position: "bottom-center" | "bottom-right" | "top-right";
};

export function formatPageNumber(index: number, total: number, options: PageNumberOptions) {
  const number = options.start + index;
  const last = options.start + total - 1;
  const format = (value: number) => options.language === "bn" ? String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]) : String(value);
  return options.style === "fraction" ? `${format(number)} / ${format(last)}` : format(number);
}

export function PageNumberModal({ open, onClose, total, onApply }: { open: boolean; onClose: () => void; total: number; onApply: (options: PageNumberOptions) => Promise<void> }) {
  const [options, setOptions] = useState<PageNumberOptions>({ start: 1, language: "bn", style: "fraction", position: "bottom-center" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apply = async () => {
    if (busy) return;
    if (!Number.isInteger(options.start) || options.start < 1 || options.start > 9999) { setError("শুরুর নম্বর ১ থেকে ৯৯৯৯-এর মধ্যে দিন।"); return; }
    setBusy(true); setError("");
    try { await onApply(options); onClose(); }
    catch (cause) { setError((cause as Error).message || "পেজ নম্বর যোগ করা যায়নি।"); }
    finally { setBusy(false); }
  };
  return <Modal open={open} onClose={busy ? () => {} : onClose} title="পেজ নম্বর যোগ করুন">
    <div className="page-number-form">
      <p>সব পেজে একসঙ্গে নম্বর বসান। আগের যোগ করা নম্বর থাকলে সেটি বদলে যাবে।</p>
      <div className="page-number-preview" aria-label="পেজ নম্বর প্রিভিউ">
        <span>প্রথম পেজের নম্বর</span><b>{formatPageNumber(0, total, options)}</b><small>মোট {total}টি পেজ</small>
      </div>
      <div className="page-number-grid">
        <label>শুরু হবে<input type="number" aria-label="শুরুর নম্বর" min={1} max={9999} step={1} value={options.start} disabled={busy} onChange={(event) => setOptions({ ...options, start: Number(event.target.value) })} /></label>
        <label>সংখ্যার ভাষা<select aria-label="সংখ্যার ভাষা" value={options.language} disabled={busy} onChange={(event) => setOptions({ ...options, language: event.target.value as PageNumberOptions["language"] })}><option value="bn">বাংলা</option><option value="en">English</option></select></label>
        <label>দেখাবে<select aria-label="পেজ নম্বরের ধরন" value={options.style} disabled={busy} onChange={(event) => setOptions({ ...options, style: event.target.value as PageNumberOptions["style"] })}><option value="fraction">নম্বর / শেষ নম্বর</option><option value="number">শুধু নম্বর</option></select></label>
        <label>অবস্থান<select aria-label="পেজ নম্বরের অবস্থান" value={options.position} disabled={busy} onChange={(event) => setOptions({ ...options, position: event.target.value as PageNumberOptions["position"] })}><option value="bottom-center">নিচে মাঝখানে</option><option value="bottom-right">নিচে ডানে</option><option value="top-right">উপরে ডানে</option></select></label>
      </div>
      {error && <p className="download-error" role="alert">{error}</p>}
      <button type="button" className="organizer-primary organizer-create" disabled={busy} onClick={apply}>{busy ? <span className="export-spinner" /> : <Icon.Plus className="h-4 w-4" />} {busy ? "যোগ হচ্ছে..." : "সব পেজে নম্বর বসান"}</button>
    </div>
  </Modal>;
}