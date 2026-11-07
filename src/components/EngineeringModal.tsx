import { useEffect, useState } from "react";
import type { Seal } from "../types";
import {
  APPROVAL_STATUS_LIST,
  DEFAULT_ENG_STAMP,
  makeDimensionStamp,
  makeEngineeringStamp,
  makeMarkupBox,
  makeVerificationBadge,
  type EngineeringStampConfig,
} from "../lib/engineering";
import { Icon, Modal } from "./ui";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (seal: Seal, widthFrac?: number) => void;
  initialTab?: "approval" | "dimension" | "markup" | "verify";
};

export function EngineeringModal({ open, onClose, onCreate, initialTab = "approval" }: Props) {
  const [tab, setTab] = useState<"approval" | "dimension" | "markup" | "verify">(initialTab);
  const [cfg, setCfg] = useState<EngineeringStampConfig>(DEFAULT_ENG_STAMP);
  const [preview, setPreview] = useState<string>("");
  const [dimLabel, setDimLabel] = useState("12.50 m");
  const [dimColor, setDimColor] = useState("#be123c");
  const [markupNote, setMarkupNote] = useState("REV-A · CHECK DIMENSION");
  const [qrValue, setQrValue] = useState("");
  const [qrLabel, setQrLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || tab !== "approval") return;
    let alive = true;
    makeEngineeringStamp(cfg)
      .then((s) => alive && setPreview(s.src))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, tab, cfg]);

  const setField = <K extends keyof EngineeringStampConfig>(key: K, value: EngineeringStampConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const applyApproval = async () => {
    setBusy(true);
    try {
      const seal = await makeEngineeringStamp(cfg);
      onCreate(seal, 0.34);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const applyDimension = async () => {
    setBusy(true);
    try {
      const seal = await makeDimensionStamp(dimLabel, dimColor);
      onCreate(seal, 0.36);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const applyMarkup = async (kind: "whiteout" | "blackout" | "redline") => {
    setBusy(true);
    try {
      const seal = await makeMarkupBox(kind, markupNote);
      onCreate(seal, kind === "redline" ? 0.28 : 0.22);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const applyVerify = async () => {
    setBusy(true);
    try {
      const seal = await makeVerificationBadge(qrValue, qrLabel);
      onCreate(seal, 0.28);
      onClose();
    } catch (cause) {
      setError((cause as Error).message || "QR কোড তৈরি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="ইঞ্জিনিয়ারিং ও ডকুমেন্ট টুলস" wide>
      <div className="eng-tabs" role="tablist">
        {([
          ["approval", "অনুমোদন ব্লক"],
          ["dimension", "মাপের নোট"],
          ["markup", "ঢাকনা ও মার্কআপ"],
          ["verify", "QR কোড"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("eng-tab", tab === id && "is-active")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "approval" && (
        <div className="grid gap-5 pt-4 md:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="checker flex aspect-[12/7] items-center justify-center rounded-xl border border-slate-200 p-3">
              {preview ? <img src={preview} alt="ইঞ্জিনিয়ারিং ব্লক প্রিভিউ" className="max-h-full max-w-full object-contain" /> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {APPROVAL_STATUS_LIST.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setCfg((prev) => ({ ...prev, status: st.id, color: st.color }))}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left text-xs font-bold transition",
                    cfg.status === st.id ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span className="block truncate">{st.label}</span>
                  <span className="text-[11px] font-medium text-slate-500">{st.bn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-500">দেখানো তথ্য উদাহরণ। ব্যবহার করার আগে নিজের তথ্য লিখে যাচাই করুন।</p>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">প্রজেক্ট / শিরোনাম</span>
              <input
                value={cfg.project}
                onChange={(e) => setField("project", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">ড্রয়িং / নথি নং</span>
                <input
                  value={cfg.drawingNo}
                  onChange={(e) => setField("drawingNo", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-900"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">স্কেল</span>
                <input
                  value={cfg.scale}
                  onChange={(e) => setField("scale", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-900"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">রিভিশন</span>
                <input
                  value={cfg.revision}
                  onChange={(e) => setField("revision", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-900"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">প্রকৌশলী / কর্মকর্তা</span>
                <input
                  value={cfg.engineer}
                  onChange={(e) => setField("engineer", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">তারিখ</span>
                <input
                  value={cfg.date}
                  onChange={(e) => setField("date", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={applyApproval}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f2a6b] px-4 py-3 text-sm font-bold text-white hover:bg-[#1a3c8b]"
            >
              <Icon.Check className="h-4 w-4" /> ইঞ্জিনিয়ারিং ব্লক বসান
            </button>
          </div>
        </div>
      )}

      {tab === "dimension" && (
        <div className="space-y-4 pt-4">
          <p className="text-sm leading-relaxed text-slate-600">নিজের দেওয়া মাপটি নোট হিসেবে বসবে; অ্যাপ নকশা থেকে মাপ হিসাব করে না।</p>
          <div className="grid grid-cols-4 gap-2">
            {["12.50 m", "24.00 m", "45'-0\"", "2400 mm"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDimLabel(preset)}
                className={cn(
                  "rounded-lg border py-2 text-xs font-bold",
                  dimLabel === preset ? "border-rose-600 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-700"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">মাপের লেখা (Dimension Label)</span>
            <input
              value={dimLabel}
              onChange={(e) => setDimLabel(e.target.value)}
              placeholder="যেমন: 12.50 m বা 150 ft"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">রঙ:</span>
            {["#be123c", "#0f2a6b", "#047857", "#111827"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDimColor(c)}
                className={cn("h-7 w-7 rounded-full border-2 border-white shadow", dimColor === c && "ring-2 ring-blue-600")}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={applyDimension}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700"
          >
            <Icon.Plus className="h-4 w-4" /> মাপজোক লাইন বসান
          </button>
        </div>
      )}

      {tab === "markup" && (
        <div className="space-y-4 pt-4">
          <p className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900" role="note">সাদা ও কালো বক্স শুধু দৃশ্যমান অংশ ঢাকে। মূল PDF-এর লেখা সার্চ বা কপি করলে থেকে যেতে পারে; গোপন তথ্য সরানোর জন্য এটি ব্যবহার করবেন না।</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => applyMarkup("whiteout")}
              className="flex flex-col items-start gap-1 rounded-xl border-2 border-slate-200 p-4 text-left hover:border-blue-500"
            >
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">সাদা ঢাকনা</span>
              <b className="text-base text-slate-900">পুরনো লেখা/দাগ ঢেকে দিন</b>
              <span className="text-xs text-slate-600">সাদা বক্স দিয়ে দৃশ্যমান অংশ ঢেকে দিন</span>
            </button>
            <button
              type="button"
              onClick={() => applyMarkup("blackout")}
              className="flex flex-col items-start gap-1 rounded-xl border-2 border-slate-200 p-4 text-left hover:border-slate-800"
            >
              <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">কালো ঢাকনা</span>
              <b className="text-base text-slate-900">কালো বক্স বসান</b>
              <span className="text-xs text-slate-600">এটি মূল তথ্য স্থায়ীভাবে অপসারণ করে না</span>
            </button>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-rose-900">রেডলাইন ইঞ্জিনিয়ারিং নোট</span>
              <input
                value={markupNote}
                onChange={(e) => setMarkupNote(e.target.value)}
                className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => applyMarkup("redline")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
            >
              রেডলাইন কলআউট বক্স বসান
            </button>
          </div>
        </div>
      )}

      {tab === "verify" && (
        <div className="space-y-4 pt-4">
          <p className="text-sm leading-relaxed text-slate-600">আপনার দেওয়া লিংক বা লেখা স্ক্যানযোগ্য QR কোডে বসবে। QR কোড নিজে নথির সত্যতা প্রমাণ করে না।</p>
          <div className="grid gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">QR-এ থাকা লিংক বা লেখা</span>
              <input
                value={qrValue}
                maxLength={600}
                placeholder="https://example.com/document/123"
                onChange={(e) => { setQrValue(e.target.value); setError(""); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">নাম (ঐচ্ছিক)</span>
              <input
                value={qrLabel}
                maxLength={28}
                onChange={(e) => setQrLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900"
              />
            </label>
          </div>
          {error && <p className="download-error" role="alert">{error}</p>}
          <button
            type="button"
            disabled={busy || !qrValue.trim()}
            onClick={applyVerify}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"
          >
            <Icon.Qr className="h-4 w-4" /> স্ক্যানযোগ্য QR বসান
          </button>
        </div>
      )}
    </Modal>
  );
}
