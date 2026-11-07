import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Icon } from "./ui";
import {
  DEFAULT_SEAL,
  loadImage,
  processSealImage,
  sealDataUrl,
  type SealConfig,
  type SealEmblem,
} from "../lib/seal";
import type { Seal } from "../types";
import { uid } from "../types";
import { cn } from "../utils/cn";

const COLORS = [
  { c: "#0f2a6b", n: "নেভি ব্লু" },
  { c: "#1d4ed8", n: "নীল" },
  { c: "#b91c1c", n: "লাল" },
  { c: "#7e22ce", n: "বেগুনি" },
  { c: "#15803d", n: "সবুজ" },
  { c: "#111827", n: "কালো" },
];

type Preset = { id: string; label: string; icon: string; patch: Partial<SealConfig> };

const PRESETS: Preset[] = [
  { id: "map", label: "ম্যাপ সিল", icon: "", patch: { shape: "circle", laurel: false, emblem: "map", top: "MSFTA.SHOP", middle: "SAYMON HASAN", date: "2023-2026", bottom: "OF THE BANGLADESH DEVELOPMENT" } },
  { id: "flag", label: "পতাকা সিল", icon: "", patch: { shape: "circle", laurel: false, emblem: "flag", top: "MSFTA.SHOP", bottom: "OF THE BANGLADESH DEVELOPMENT" } },
  { id: "crescent", label: "চাঁদ-তারা", icon: "", patch: { shape: "circle", laurel: false, emblem: "crescent", top: "MSFTA.SHOP", bottom: "OF THE BANGLADESH DEVELOPMENT" } },
  { id: "lily", label: "শাপলা সিল", icon: "", patch: { shape: "circle", laurel: false, emblem: "waterlily", top: "MSFTA.SHOP", bottom: "OF THE BANGLADESH DEVELOPMENT" } },
  { id: "office", label: "ক্লিয়ার অফিস", icon: "", patch: { shape: "circle", laurel: true, emblem: "none", top: "OFFICE OF THE", middle: "SAYMON HASAN", bottom: "AUTHORISED SIGNATORY" } },
  { id: "letter", label: "লেটারহেড", icon: "", patch: { shape: "rect", laurel: false, emblem: "map", top: "MSFTA.SHOP", bottom: "OF THE BANGLADESH DEVELOPMENT" } },
];

const DESIGNS: { id: string; label: string; sub: string; patch: Partial<SealConfig> }[] = [
  { id: "B", label: "ডিজাইন B", sub: "গোল", patch: { shape: "circle", laurel: false, emblem: "map" } },
  { id: "A", label: "ডিজাইন A", sub: "পাতা", patch: { shape: "circle", laurel: true, emblem: "map" } },
  { id: "C", label: "ডিজাইন C", sub: "স্কয়ার", patch: { shape: "square", laurel: false, emblem: "map" } },
  { id: "D", label: "ডিজাইন D", sub: "আয়তাকার", patch: { shape: "rect", laurel: false, emblem: "map" } },
];

const EMBLEMS: { id: SealEmblem; label: string }[] = [
  { id: "map", label: "বাংলাদেশ ম্যাপ" },
  { id: "flag", label: "বাংলাদেশ পতাকা" },
  { id: "star", label: "তারা" },
  { id: "crescent", label: "চাঁদ-তারা" },
  { id: "waterlily", label: "শাপলা ফুল" },
  { id: "paddy", label: "ধানগাছ" },
  { id: "monogram", label: "মনোগ্রাম" },
  { id: "none", label: "কিছু নেই" },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-display text-base font-bold text-[#0c1c4a]">{title}</h4>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function CustomizeSealModal({
  open,
  onClose,
  config,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  config: SealConfig;
  onSave: (c: SealConfig) => void;
}) {
  const [draft, setDraft] = useState<SealConfig>(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const thumbCfg = useMemo(() => ({ ...draft, grunge: 0 as const, serial: "" }), [draft]);
  const preview = useMemo(() => sealDataUrl(draft), [draft]);
  const designThumbs = useMemo(
    () => DESIGNS.map((d) => ({ ...d, src: sealDataUrl({ ...thumbCfg, ...d.patch }) })),
    [thumbCfg]
  );
  const emblemThumbs = useMemo(
    () => EMBLEMS.map((e) => ({ ...e, src: sealDataUrl({ ...thumbCfg, shape: draft.shape, laurel: draft.laurel, emblem: e.id }) })),
    [thumbCfg, draft.shape, draft.laurel]
  );

  const set = <K extends keyof SealConfig>(k: K, v: SealConfig[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const inkPct = Math.round((draft.ink ?? 1) * 100);

  return (
    <Modal open={open} onClose={onClose} title="সিল কাস্টমাইজ করুন" wide>
      <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr]">
        {/* preview */}
        <div className="md:sticky md:top-16 md:self-start">
          <div className="checker flex aspect-square items-center justify-center rounded-2xl border border-slate-200 p-4">
            <img src={preview} alt="সিলের প্রিভিউ" className="max-h-full max-w-full object-contain drop-shadow-sm" />
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">কালির গাঢ়তা</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{inkPct}%</span>
            </div>
            <input aria-label="সিলের মূল কালির গাঢ়তা" type="range" min={35} max={100} step={1} value={inkPct} onChange={(e) => set("ink", +e.target.value / 100)} className="w-full" />
            <div className="mt-2 grid grid-cols-3 gap-1">
              {([
                [0.45, "হালকা"],
                [0.7, "স্বাভাবিক"],
                [1, "গাঢ়"],
              ] as const).map(([v, label]) => (
                <button
                  key={label}
                  onClick={() => set("ink", v)}
                  className={cn("rounded-lg border px-2 py-1.5 text-xs font-medium", Math.abs((draft.ink ?? 1) - v) < 0.03 ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              হালকা করলে পুরনো ছাপের মতো মিশে যাবে, গাঢ় করলে স্পষ্ট বসবে। এডিটরে বসানোর পরও সিলেক্ট করে বদলানো যাবে।
            </p>
          </div>
        </div>

        {/* controls */}
        <div className="space-y-6 pb-20">
          <Section title="প্রিসেট — এক ক্লিকে সাজান">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDraft((d) => ({ ...d, ...p.patch }))}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="ডিজাইন">
            <div className="grid grid-cols-4 gap-2">
              {designThumbs.map((d) => {
                const active = draft.shape === d.patch.shape && draft.laurel === d.patch.laurel;
                return (
                  <button
                    key={d.id}
                    aria-pressed={active}
                    onClick={() => setDraft((prev) => ({ ...prev, shape: d.patch.shape ?? prev.shape, laurel: d.patch.laurel ?? prev.laurel }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition",
                      active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <span className="checker flex h-16 w-full items-center justify-center overflow-hidden rounded-md p-1">
                      <img src={d.src} alt={d.label} className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="text-[11px] font-bold leading-none text-slate-700">{d.label}</span>
                    <span className="text-[10px] leading-none text-slate-500">{d.sub}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="সিলের ভেতরের প্রতীক" hint="সব ডিজাইনে কাজ করে">
            <div className="grid grid-cols-4 gap-2">
              {emblemThumbs.map((e) => (
                <button
                  key={e.id}
                  aria-pressed={draft.emblem === e.id}
                  onClick={() => set("emblem", e.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition",
                    draft.emblem === e.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="checker flex h-14 w-full items-center justify-center overflow-hidden rounded-md p-1">
                    <img src={e.src} alt={e.label} className="max-h-full max-w-full object-contain" />
                  </span>
                  <span className="text-center text-[10px] font-medium leading-tight text-slate-600">{e.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="লেখা">
            <div className="space-y-3">
              <Field label="উপরের লেখা" value={draft.top} onChange={(v) => set("top", v)} />
              <Field label="মাঝের নাম" value={draft.middle} onChange={(v) => set("middle", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="সাল / তারিখ" value={draft.date} onChange={(v) => set("date", v)} />
                <Field label="সিরিয়াল (ঐচ্ছিক)" value={draft.serial ?? ""} onChange={(v) => set("serial", v)} />
              </div>
              <Field label="নিচের লেখা" value={draft.bottom} onChange={(v) => set("bottom", v)} />
            </div>
          </Section>

          <Section title="রং ও টেক্সচার">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.c}
                  title={c.n}
                  onClick={() => set("color", c.c)}
                  className={cn("h-8 w-8 rounded-full border-2 transition", draft.color === c.c ? "scale-110 border-white ring-2 ring-blue-500" : "border-white shadow")}
                  style={{ background: c.c }}
                />
              ))}
              <input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-200" />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {([
                [0, "পরিষ্কার"],
                [1, "হালকা দাগ"],
                [2, "পুরনো ঘষা"],
              ] as const).map(([lv, label]) => (
                <button
                  key={lv}
                  onClick={() => set("grunge", lv)}
                  className={cn("rounded-lg px-2 py-2 text-xs font-medium transition", draft.grunge === lv ? "bg-white text-blue-700 shadow" : "text-slate-600 hover:text-slate-900")}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 py-3 backdrop-blur">
            <button onClick={() => setDraft(DEFAULT_SEAL)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
              ডিফল্ট
            </button>
            <button
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Icon.Check className="h-4 w-4" /> সেভ করুন
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        value={value}
        maxLength={label.includes("নিচের") ? 65 : label.includes("সাল") ? 28 : label.includes("সিরিয়াল") ? 36 : 45}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}

export function UploadSealModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (s: Seal) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  const [removeBg, setRemoveBg] = useState(true);
  const [threshold, setThreshold] = useState(205);
  const [result, setResult] = useState<{ src: string; aspect: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setImg(null);
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!img) return;
    setBusy(true);
    const t = setTimeout(() => {
      setResult(processSealImage(img, { removeBg, threshold }));
      setBusy(false);
    }, 60);
    return () => clearTimeout(t);
  }, [img, removeBg, threshold]);

  const pick = async (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const im = await loadImage(url);
      setImg(im);
      setName(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      alert("ছবিটি পড়া যায়নি");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="নিজের সিল আপলোড করুন">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {!img ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-12 text-slate-500 transition hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-600"
        >
          <Icon.Upload className="h-10 w-10" />
          <span className="font-semibold">সিলের ছবি নির্বাচন করুন</span>
          <span className="text-sm">PNG (ট্রান্সপারেন্ট) সবচেয়ে ভালো। সাদা ব্যাকগ্রাউন্ড অটো মুছে ফেলা যাবে।</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="checker relative flex aspect-square items-center justify-center rounded-2xl border border-slate-200 p-4">
            {result && <img src={result.src} className="max-h-full max-w-full object-contain" alt="processed seal" />}
            {busy && <div className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2 py-0.5 text-xs text-white">প্রসেসিং...</div>}
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            <span className="text-sm font-medium">সাদা / চেকারবোর্ড ব্যাকগ্রাউন্ড মুছে ফেলুন</span>
          </label>
          {removeBg && (
            <label className="block">
              <div className="mb-1 flex justify-between text-sm text-slate-600">
                <span>ব্যাকগ্রাউন্ড মোছার মাত্রা</span>
                <span className="font-mono">{threshold}</span>
              </div>
              <input type="range" min={120} max={250} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="w-full" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">সিলের নাম</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          <div className="flex gap-2">
            <button onClick={() => inputRef.current?.click()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
              অন্য ছবি
            </button>
            <button
              disabled={!result || busy}
              onClick={() => {
                if (!result) return;
                onAdd({ id: uid(), name: name || "আমার সিল", src: result.src, aspect: result.aspect });
                onClose();
              }}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              সিল যোগ করুন
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
