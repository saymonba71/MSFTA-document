import { useEffect, useMemo, useState } from "react";
import type { Doc, PdfTextItem, Seal, Stamp } from "../types";
import { cachedImage } from "../lib/ink";
import {
  TEXT_FONTS,
  defaultTextEdit,
  fitSizeMultiplier,
  makeTextPatch,
  sampleBackground,
  sampleInkColor,
  validateTextEdit,
  type TextAlign,
  type TextEdit,
  type TextFont,
  type TextIssue,
} from "../lib/pdfText";
import { Icon, Modal } from "./ui";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  doc: Doc;
  pageIdx: number;
  stamps: Stamp[];
  onApply: (item: PdfTextItem, edit: TextEdit, seal: Seal, dims?: { w: number; h: number }) => void;
  onRevert: (itemId: string) => void;
};

const colors = ["#111827", "#a90b25", "#0f2a6b", "#15803d", "#7e22ce", "#ffffff"];

export function PdfTextModal({ open, onClose, doc, pageIdx, stamps, onApply, onRevert }: Props) {
  const [page, setPage] = useState(pageIdx);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, TextEdit>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) {
      setPage(pageIdx);
      setSelectedId(null);
      setMessage("");
      setFilter("");
      setZoom(1);
    }
  }, [open, pageIdx]);

  const patches = useMemo(
    () => new Map(stamps.filter((s) => s.origin === "pdf-text" && s.itemId).map((s) => [s.itemId!, s.edit!])),
    [stamps]
  );
  const items = useMemo(() => (doc.textItems ?? []).filter((item) => item.page === page), [doc.textItems, page]);
  const visibleItems = useMemo(
    () => items.filter((item) => !filter.trim() || item.text.toLowerCase().includes(filter.trim().toLowerCase())),
    [items, filter]
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const allIssues = useMemo(() => {
    const list: TextIssue[] = [];
    for (const item of items) {
      const edit = edits[item.id] ?? patches.get(item.id);
      if (edit) list.push(...validateTextEdit(item, edit, doc.pages[page]));
    }
    return list;
  }, [items, edits, patches, doc.pages, page]);

  const selectedEdit = selected ? edits[selected.id] ?? patches.get(selected.id) ?? defaultTextEdit(selected) : null;
  const selectedIssues = selected && selectedEdit ? validateTextEdit(selected, selectedEdit, doc.pages[page]) : [];

  const changed = (item: PdfTextItem) => {
    const edit = edits[item.id];
    if (!edit) return false;
    return (
      edit.text !== item.text ||
      edit.sizeMultiplier !== 1 ||
      edit.bold !== (item.bold ?? false) ||
      (edit.align ?? "left") !== "left"
    );
  };
  const editedCount = items.filter((item) => changed(item) || patches.has(item.id)).length;

  const setEdit = (patch: Partial<TextEdit>) => {
    if (!selected) return;
    const base = edits[selected.id] ?? patches.get(selected.id) ?? defaultTextEdit(selected);
    setEdits((previous) => ({ ...previous, [selected.id]: { ...base, ...patch, itemId: selected.id } }));
    setMessage("");
  };

  const defaults = async (item: PdfTextItem) => {
    setSelectedId(item.id);
    setMessage("");
    if (edits[item.id] || patches.get(item.id)) return;
    let background = "#ffffff";
    let color = "#111827";
    try {
      const image = await cachedImage(doc.pages[page].src);
      [background, color] = await Promise.all([
        sampleBackground(image, item, doc.pages[page]),
        sampleInkColor(image, item, doc.pages[page]),
      ]);
    } catch {
      /* fallback colours are safe */
    }
    setEdits((previous) => (previous[item.id] ? previous : { ...previous, [item.id]: { ...defaultTextEdit(item), background, color } }));
  };

  const fitSelected = () => {
    if (!selected || !selectedEdit) return;
    const fitted = fitSizeMultiplier(selected, selectedEdit, doc.pages[page]);
    setEdit({ sizeMultiplier: fitted });
    setMessage(`লেখাটি বক্সের মাপে (${Math.round(fitted * 100)}%) ফিট করা হয়েছে।`);
  };

  const apply = async () => {
    if (!selected || !selectedEdit || busy) return;
    if (!selectedEdit.text.trim()) {
      setMessage("নতুন লেখাটি খালি রাখা যাবে না। মূল লেখা ফিরাতে চাইলে “মূল অবস্থায় ফেরান” চাপুন।");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { seal, w, h } = await makeTextPatch(selected, doc.pages[page], selectedEdit);
      onApply(selected, selectedEdit, seal, { w, h });
      setEdits((previous) => ({ ...previous, [selected.id]: selectedEdit }));
      setMessage(patches.has(selected.id) ? "পরিবর্তন হালনাগাদ হয়েছে — নথিতে দেখা যাবে।" : "লেখা নথিতে বসানো হয়েছে — নথিতে দেখা যাবে।");
    } catch (error) {
      setMessage((error as Error).message || "লেখা বসানো যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="PDF লেখা এডিট" wide>
      <div className="pdftext-head">
        <div>
          <b>{items.length}</b>টি লেখার লাইন পাওয়া গেছে · {editedCount}টি এডিট হয়েছে
        </div>
        <div className="pdftext-head-tools">
          <div className="pdftext-zoom" aria-label="প্রিভিউ জুম">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom <= 1} title="জুম কমান">
              <Icon.Minus className="h-3.5 w-3.5" />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2.25, +(z + 0.25).toFixed(2)))} disabled={zoom >= 2.25} title="জুম বাড়ান">
              <Icon.Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {doc.pages.length > 1 && (
            <div className="pdftext-pages">
              <button disabled={page === 0} onClick={() => { setPage(page - 1); setSelectedId(null); }} aria-label="আগের পেজ">
                <Icon.Back className="h-4 w-4" />
              </button>
              <span>{page + 1} / {doc.pages.length}</span>
              <button disabled={page === doc.pages.length - 1} onClick={() => { setPage(page + 1); setSelectedId(null); }} aria-label="পরের পেজ">
                <Icon.Next className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {!items.length ? (
        <div className="pdftext-empty">
          <Icon.Text className="h-8 w-8" />
          <b>এই পেজে এডিট করার মতো লেখা পাওয়া যায়নি।</b>
          <p>স্ক্যান করা ছবি, আউটলাইন করা বা পাশের দিকে ঘোরানো লেখার PDF স্বয়ংক্রিয়ভাবে এডিট করা যায় না। লেখা স্তর যোগ করে কাজ চালিয়ে যেতে পারেন।</p>
        </div>
      ) : (
        <div className="pdftext-layout">
          <div>
            <div className="pdftext-preview-scroll">
              <div
                className="pdftext-preview"
                style={{
                  aspectRatio: `${doc.pages[page].width} / ${doc.pages[page].height}`,
                  width: `${zoom * 100}%`,
                }}
              >
                <img src={doc.pages[page].src} alt="PDF পেজ" draggable={false} />
                {items.map((item, index) => {
                  const edit = edits[item.id] ?? patches.get(item.id);
                  const issues = edit ? validateTextEdit(item, edit, doc.pages[page]) : [];
                  const isEdited = patches.has(item.id) || (edit && edit.text !== item.text);
                  const fontCss = TEXT_FONTS[edit?.font ?? "sans"].css;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`লেখা ${index + 1}: ${item.text}`}
                      onClick={() => void defaults(item)}
                      className={cn(
                        "pdftext-box",
                        selectedId === item.id && "is-selected",
                        issues.length > 0 && "has-issue",
                        patches.has(item.id) && "is-edited"
                      )}
                      style={{
                        left: `${(item.x - item.w / 2) * 100}%`,
                        top: `${(item.y - item.h / 2) * 100}%`,
                        width: `${item.w * 100}%`,
                        height: `${item.h * 100}%`,
                      }}
                    >
                      <span className="pdftext-box-label">{index + 1}</span>
                      {issues.length > 0 && <span className="pdftext-issue-mark" title={issues[0].message}>!</span>}
                      {issues.length > 0 && <span className="pdftext-issue-glow" aria-hidden="true" />}
                      {isEdited && edit && (
                        <span
                          className="pdftext-preview-text"
                          style={{
                            fontSize: `${Math.min(92, Math.max(48, Math.round(74 * edit.sizeMultiplier)))}cqh`,
                            fontWeight: edit.bold ? 700 : 500,
                            fontFamily: fontCss,
                            color: edit.color,
                            backgroundColor: edit.background,
                            justifyContent: edit.align === "center" ? "center" : edit.align === "right" ? "flex-end" : "flex-start",
                          }}
                        >
                          {edit.text}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="pdftext-tip">
              <span className="pdftext-dot" /> লাল চিহ্নে মাপ, রং বা ফাঁকের সমস্যা দেখুন। এটি পূর্ণ বানান পরীক্ষক নয়।
            </p>
            {allIssues.length > 0 && (
              <div className="pdftext-summary" role="alert">
                <b>{allIssues.length}টি ভুল পাওয়া গেছে</b>
                <ul>
                  {allIssues.slice(0, 5).map((issue, index) => (
                    <li key={`${issue.itemId}-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="pdftext-form">
            {selected && selectedEdit ? (
              <>
                <div className="pdftext-form-head">
                  <span>লেখা {items.findIndex((item) => item.id === selected.id) + 1}</span>
                  <button type="button" onClick={() => setSelectedId(null)} aria-label="এডিট বন্ধ করুন">
                    <Icon.X className="h-4 w-4" />
                  </button>
                </div>

                <label className="pdftext-field">
                  <span>মূল লেখা</span>
                  <output>{selected.text}</output>
                </label>

                <label className="pdftext-field">
                  <span>
                    নতুন লেখা
                    <button
                      type="button"
                      className="pdftext-inline-btn"
                      onClick={() => setEdit({ text: selected.text, sizeMultiplier: 1 })}
                    >
                      মূল লেখা কপি
                    </button>
                  </span>
                  <textarea rows={2} value={selectedEdit.text} onChange={(event) => setEdit({ text: event.target.value })} />
                </label>

                {/* Crisp 1:1 live specimen preview */}
                <div className="pdftext-specimen">
                  <div className="pdftext-specimen-head">
                    <span>স্পষ্ট লাইভ প্রিভিউ</span>
                    <button type="button" onClick={fitSelected} className="pdftext-fit-btn">
                      বক্সে ফিট করুন
                    </button>
                  </div>
                  <div
                    className="pdftext-specimen-box"
                    style={{
                      backgroundColor: selectedEdit.background,
                      color: selectedEdit.color,
                      fontFamily: TEXT_FONTS[selectedEdit.font ?? "sans"].css,
                      fontWeight: selectedEdit.bold ? 700 : 500,
                      fontSize: `${Math.min(28, Math.max(12, Math.round(selected.size * 520 * selectedEdit.sizeMultiplier)))}px`,
                      textAlign: selectedEdit.align ?? "left",
                    }}
                  >
                    {selectedEdit.text.trim() || "খালি লেখা"}
                  </div>
                </div>

                <div className="pdftext-row">
                  <label className="pdftext-field">
                    <span>
                      আকার <small>{Math.round(selectedEdit.sizeMultiplier * 100)}%</small>
                    </span>
                    <input
                      aria-label="লেখার আকার"
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.02}
                      value={selectedEdit.sizeMultiplier}
                      onChange={(event) => setEdit({ sizeMultiplier: +event.target.value })}
                    />
                  </label>
                  <label className="pdftext-field">
                    <span>ফন্টের ধরন</span>
                    <select
                      aria-label="ফন্টের ধরন"
                      value={selectedEdit.font ?? "sans"}
                      onChange={(event) => setEdit({ font: event.target.value as TextFont })}
                      className="pdftext-select"
                    >
                      {(Object.keys(TEXT_FONTS) as TextFont[]).map((key) => (
                        <option key={key} value={key}>
                          {TEXT_FONTS[key].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="pdftext-row">
                  <label className="pdftext-field">
                    <span>লেখার রঙ</span>
                    <div className="pdftext-colors">
                      {colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`রঙ ${color}`}
                          aria-pressed={selectedEdit.color === color}
                          onClick={() => setEdit({ color })}
                          style={{ background: color }}
                        />
                      ))}
                      <input type="color" aria-label="অন্য রঙ" value={selectedEdit.color} onChange={(event) => setEdit({ color: event.target.value })} />
                    </div>
                  </label>
                  <div className="pdftext-field">
                    <span>সাজানো ও স্টাইল</span>
                    <div className="pdftext-align-group">
                      {([
                        ["left", "বাম"],
                        ["center", "মাঝ"],
                        ["right", "ডান"],
                      ] as Array<[TextAlign, string]>).map(([align, label]) => (
                        <button
                          key={align}
                          type="button"
                          aria-pressed={(selectedEdit.align ?? "left") === align}
                          onClick={() => setEdit({ align })}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-pressed={selectedEdit.bold}
                        onClick={() => setEdit({ bold: !selectedEdit.bold })}
                        title="মোটা অক্ষর (Bold)"
                      >
                        <b>B</b>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pdftext-row">
                  <label className="pdftext-field">
                    <span>পেছনের কাগজের রঙ</span>
                    <div className="flex items-center gap-2">
                      <input type="color" aria-label="পেছনের রঙ" value={selectedEdit.background} onChange={(event) => setEdit({ background: event.target.value })} />
                      <span className="font-mono text-[10px] text-slate-500">{selectedEdit.background}</span>
                    </div>
                  </label>
                  <label className="pdftext-check">
                    <input type="checkbox" checked={selectedEdit.bold} onChange={(event) => setEdit({ bold: event.target.checked })} /> বোল্ড অক্ষর
                  </label>
                </div>

                {selectedIssues.length > 0 ? (
                  <div className="pdftext-errors" role="alert">
                    <b>
                      <Icon.Info className="h-4 w-4" /> এই লেখায় {selectedIssues.length}টি ভুল
                    </b>
                    <ul>
                      {selectedIssues.map((issue, index) => (
                        <li key={index}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="pdftext-ok">
                    <Icon.Check className="h-4 w-4" /> কোনো সমস্যা পাওয়া যায়নি — মাপ ও রঙ একদম ঠিক আছে।
                  </p>
                )}

                {message && (
                  <p className="pdftext-message" role="status">
                    {message}
                  </p>
                )}

                <div className="pdftext-actions">
                  {patches.has(selected.id) && (
                    <button
                      type="button"
                      className="pdftext-revert"
                      onClick={() => {
                        onRevert(selected.id);
                        setEdits((previous) => {
                          const next = { ...previous };
                          delete next[selected.id];
                          return next;
                        });
                        setMessage("মূল লেখা ফিরিয়ে আনা হয়েছে।");
                      }}
                    >
                      মূল অবস্থায় ফেরান
                    </button>
                  )}
                  <button type="button" className="pdftext-apply" disabled={busy || !selectedEdit.text.trim()} onClick={() => void apply()}>
                    {busy ? <span className="export-spinner" /> : <Icon.Check className="h-4 w-4" />}
                    {patches.has(selected.id) ? "পরিবর্তন হালনাগাদ" : selectedIssues.length ? "তবুও বসান" : "লেখা বসান"}
                  </button>
                </div>
              </>
            ) : (
              <div className="pdftext-list">
                <div className="pdftext-list-head">
                  <b>লেখার তালিকা ({visibleItems.length})</b>
                  <span>চাপ দিয়ে বেছে নিন</span>
                </div>
                {items.length > 4 && (
                  <label className="pdftext-search">
                    <Icon.Search className="h-3.5 w-3.5" />
                    <input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="এই পেজের লেখা খুঁজুন..."
                      aria-label="এই পেজের লেখা খুঁজুন"
                    />
                  </label>
                )}
                {visibleItems.map((item) => {
                  const index = items.findIndex((entry) => entry.id === item.id);
                  const edit = edits[item.id] ?? patches.get(item.id);
                  const issues = edit ? validateTextEdit(item, edit, doc.pages[page]) : [];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void defaults(item)}
                      className={cn("pdftext-line", issues.length > 0 && "has-issue", patches.has(item.id) && "is-edited")}
                    >
                      <span>{index + 1}</span>
                      <p>{edit?.text ?? item.text}</p>
                      {issues.length > 0 ? (
                        <b className="pdftext-count">{issues.length}</b>
                      ) : patches.has(item.id) ? (
                        <Icon.Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <p className="pdftext-disclaimer">
        <Icon.Info className="h-4 w-4" /> নতুন লেখা মূল লেখার ওপর বসানো হয়। পুরোনো PDF লেখা সার্চ বা কপি করলে পাওয়া যেতে পারে; এটি নিরাপদ তথ্য অপসারণ নয়।
      </p>
    </Modal>
  );
}
