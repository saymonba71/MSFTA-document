import { useEffect, useState } from "react";
import type { Seal } from "../types";
import { makeTextSeal } from "../lib/seal";
import { Icon, Modal } from "./ui";

const FONTS = [
  { label: "বাংলা", value: '"Hind Siliguri", sans-serif' },
  { label: "সাধারণ", value: "Arial, sans-serif" },
  { label: "সেরিফ", value: "Georgia, serif" },
];
const BACKGROUNDS = [
  { label: "স্বচ্ছ", value: "transparent" },
  { label: "সাদা", value: "#ffffff" },
  { label: "হালকা হলুদ", value: "#fff4cc" },
];

export function TextLayerModal({
  open,
  onClose,
  initial,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Seal;
  onCreate: (seal: Seal) => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#0f2a6b");
  const [font, setFont] = useState(FONTS[0].value);
  const [background, setBackground] = useState("transparent");
  const [preview, setPreview] = useState<Seal | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(initial?.text ?? "");
    setColor(initial?.color ?? "#0f2a6b");
    setFont(initial?.fontFamily ?? FONTS[0].value);
    setBackground(initial?.background ?? "transparent");
  }, [open, initial]);

  useEffect(() => {
    if (!open || !text.trim()) {
      setPreview(null);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      makeTextSeal(text, color, font, background, initial?.id)
        .then((s) => live && setPreview(s))
        .catch(() => live && setPreview(null));
    }, 100);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [open, text, color, font, background, initial]);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const seal = await makeTextSeal(text, color, font, background, initial?.id);
      onCreate(seal);
      onClose();
    } catch (e) {
      alert((e as Error).message || "লেখার স্তর তৈরি করা যায়নি");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "লেখা সম্পাদনা" : "লেখার স্তর যোগ করুন"}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">আপনার লেখা</span>
          <textarea
            autoFocus
            rows={3}
            maxLength={180}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="যেমন: অনুমোদিত · ২০২৬ · SAYMON HASAN"
            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          <span className="mt-1 block text-right text-xs text-slate-400">{text.length}/180 · একাধিক লাইনের জন্য Enter চাপুন</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">ফন্ট</span>
            <select value={font} onChange={(e) => setFont(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">লেখার রং</span>
            <span className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-200 px-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" />
              <span className="font-mono text-xs uppercase text-slate-500">{color}</span>
            </span>
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">ব্যাকগ্রাউন্ড</span>
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.value}
                onClick={() => setBackground(b.value)}
                className={`rounded-xl border px-2 py-2 text-sm transition ${background === b.value ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="checker flex min-h-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 px-4 py-3">
          {preview ? <img src={preview.src} alt="লেখার প্রিভিউ" className="max-h-32 max-w-full object-contain" /> : <span className="text-sm text-slate-400">এখানে লাইভ প্রিভিউ দেখাবে</span>}
        </div>

        <button disabled={!text.trim() || busy} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon.Plus className="h-5 w-5" />}
          {initial ? "পরিবর্তন সেভ করুন" : "লেখা যোগ করুন"}
        </button>
      </div>
    </Modal>
  );
}