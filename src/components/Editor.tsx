import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Doc, PdfTextItem, Seal, Stamp } from "../types";
import type { TextEdit } from "../lib/pdfText";
import { uid } from "../types";
import { Icon, SealPicker, Slider } from "./ui";
import { SaveModal } from "./SaveModal";
import { cn } from "../utils/cn";
import { TextLayerModal } from "./TextLayerModal";
import { SignatureModal } from "./SignatureModal";
import { BatchModal } from "./BatchModal";
import { makeTextSeal, recolorSeal } from "../lib/seal";
import { expandForPaint, exportPdf, pagePng } from "../lib/doc";
import { prepareFile, releaseFile, requestDownload, isEmbedded, type PreparedFile } from "../lib/download";
import { deleteLayout, loadLayouts, saveLayout, type Layout } from "../lib/layouts";
import { InkControls } from "./InkControls";
import { inkFilter, inkValues } from "../lib/ink";
import { DownloadResult } from "./DownloadResult";
import { PdfTextModal } from "./PdfTextModal";
import { EngineeringModal } from "./EngineeringModal";
import { PdfOrganizer } from "./PdfOrganizer";
import { PageNumberModal, formatPageNumber, type PageNumberOptions } from "./PageNumberModal";
import { validateStamps } from "../lib/pdfText";

const INK_COLORS = [
  { c: "#0c1c4a", n: "নীল" },
  { c: "#b91c1c", n: "লাল" },
  { c: "#6d28d9", n: "বেগুনি" },
  { c: "#15803d", n: "সবুজ" },
  { c: "#111827", n: "কালো" },
];

const baseNameForFile = (name: string) => (name.replace(/\.[^.]+$/, "") || "document").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);

// [label, x, y] — where the seal centre should go (fractions of page)
const PRESETS: [string, number, number][] = [
  ["↖", 0.16, 0.14],
  ["↑", 0.5, 0.14],
  ["↗", 0.84, 0.14],
  ["←", 0.16, 0.5],
  ["•", 0.5, 0.5],
  ["→", 0.84, 0.5],
  ["↙", 0.16, 0.84],
  ["↓", 0.5, 0.84],
  ["↘", 0.84, 0.84],
];

type Mode = "move" | "resize" | "rotate" | "pinch";
type DragState = {
  mode: Mode;
  id: string;
  orig: Stamp;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  startDist: number;
  startAngle: number;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const normAngle = (a: number) => {
  let r = ((a + 180) % 360 + 360) % 360 - 180;
  for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(r - s) < 3) r = s;
  return r === -180 ? 180 : r;
};
const MIN_W = 0.02;
const MAX_W = 1.5;

type Props = {
  doc: Doc;
  seals: Seal[];
  initialSeals?: Seal[];
  initialStamps?: Stamp[];
  initialPage?: number;
  preferredSealId?: string;
  selectionVersion?: number;
  initialTextMode?: boolean;
  onClose: () => void;
  onCustomize: () => void;
  onUploadSeal: () => void;
  onDeleteSeal: (id: string) => boolean;
};

const NO_SEALS: Seal[] = [];

export default function Editor({ doc, seals, initialSeals = NO_SEALS, initialStamps, initialPage = 0, preferredSealId, selectionVersion = 0, initialTextMode = false, onClose, onCustomize, onUploadSeal, onDeleteSeal }: Props) {
  const [generatedSeals, setGeneratedSeals] = useState<Seal[]>([]);
  const [removedSealIds, setRemovedSealIds] = useState<Set<string>>(() => new Set());
  const editorSeals = useMemo(() => {
    const map = new Map<string, Seal>();
    [...seals, ...initialSeals, ...generatedSeals].forEach((s) => map.set(s.id, s));
    return [...map.values()];
  }, [seals, initialSeals, generatedSeals]);
  const sealMap = useMemo(() => new Map(editorSeals.map((s) => [s.id, s])), [editorSeals]);
  const getSeal = useCallback((id: string) => sealMap.get(id) ?? seals[0], [sealMap, seals]);

  const makeStamp = useCallback(
    (page: number, sealId: string, x = 0.5, y = 0.5): Stamp => {
      const p = doc.pages[page];
      const seal = getSeal(sealId);
      const targetPx = 0.26 * Math.min(p.width, p.height);
      const wPx = seal.aspect >= 1 ? targetPx : targetPx * seal.aspect;
      return { id: uid(), page, sealId, x, y, w: wPx / p.width, rot: 0, opacity: 1, blend: seal.kind === "qr" ? "normal" : "ink" };
    },
    [doc.pages, getSeal]
  );

  const [pageIdx, setPageIdx] = useState(() => clamp(initialPage, 0, doc.pages.length - 1));
  const [activeSealId, setActiveSealId] = useState(() => initialStamps?.[0]?.sealId ?? seals[0].id);
  const [stamps, setStampsState] = useState<Stamp[]>(() => initialStamps?.map((s) => ({ ...s })) ?? [makeStamp(0, seals[0].id, doc.name === "নমুনা-সনদ" ? .79 : .5, doc.name === "নমুনা-সনদ" ? .76 : .5)]);
  const [selected, setSelected] = useState<string | null>(() => stamps[0]?.id ?? null);
  const [viewZoom, setViewZoom] = useState(1);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1024);
  const [panelTab, setPanelTab] = useState<"seal" | "layer" | "page" | "check">("seal");
  const [pdfTextOpen, setPdfTextOpen] = useState(false);
  const [engOpen, setEngOpen] = useState(false);
  const [pageOrganizerOpen, setPageOrganizerOpen] = useState(false);
  const [pageOrganizerFile, setPageOrganizerFile] = useState<File | null>(null);
  const [pageOrganizerBusy, setPageOrganizerBusy] = useState(false);
  const [pageNumberOpen, setPageNumberOpen] = useState(false);
  const [gridOn, setGridOn] = useState(false);
  const autoTextUsed = useRef(false);
  useEffect(() => { if (initialTextMode && !autoTextUsed.current && doc.kind === "pdf") { autoTextUsed.current = true; setPdfTextOpen(true); } }, [initialTextMode, doc]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [quick, setQuick] = useState<PreparedFile | null>(null);
  const layerIssues = useMemo(() => validateStamps(doc, pageIdx, stamps), [doc, pageIdx, stamps]);
  const errorIds = useMemo(() => new Set(layerIssues.map((issue) => issue.id)), [layerIssues]);
  const applyPdfText = (item: PdfTextItem, edit: TextEdit, seal: Seal, dims?: { w: number; h: number }) => {
    setGeneratedSeals((previous) => [...previous.filter((entry) => entry.id !== seal.id), seal]);
    const w = dims?.w ?? item.w;
    const h = dims?.h ?? item.h;
    const align = edit.align ?? "left";
    const x = align === "center"
      ? item.x
      : align === "right"
        ? Math.max(w / 2, item.x + item.w / 2 - w / 2)
        : Math.min(1 - w / 2, item.x - item.w / 2 + w / 2);
    const existing = stampsRef.current.find((stamp) => stamp.origin === "pdf-text" && stamp.itemId === item.id);
    if (existing) {
      apply(stampsRef.current.map((stamp) => stamp.id === existing.id ? { ...stamp, sealId: seal.id, edit, x, y: item.y, w, h, rot: 0 } : stamp));
    } else {
      apply([...stampsRef.current, { id: uid(), page: item.page, sealId: seal.id, x, y: item.y, w, h, rot: 0, opacity: 1, blend: "normal", origin: "pdf-text", itemId: item.id, edit }]);
    }
    flash("PDF লেখা হালনাগাদ হয়েছে");
  };
  const revertPdfText = (itemId: string) => {
    const patch = stampsRef.current.find((stamp) => stamp.origin === "pdf-text" && stamp.itemId === itemId);
    if (patch) apply(stampsRef.current.filter((stamp) => stamp.id !== patch.id));
  };
  const [quickBusy, setQuickBusy] = useState(false);
  const quickGuard = useRef(false);
  const [comparing, setComparing] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [hint, setHint] = useState(true);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const stampsRef = useRef(stamps);
  const setStamps = useCallback((action: React.SetStateAction<Stamp[]>) => {
    const next = typeof action === "function" ? action(stampsRef.current) : action;
    stampsRef.current = next;
    setStampsState(next);
  }, []);
  useEffect(() => () => releaseFile(quick), [quick]);

  // ---------- undo / redo ----------
  const histRef = useRef<Stamp[][]>([]);
  const histIdx = useRef(-1);
  const [, bumpHist] = useState(0);
  const pushHist = useCallback((next: Stamp[]) => {
    const h = histRef.current;
    const prev = h[histIdx.current];
    if (prev && JSON.stringify(prev) === JSON.stringify(next)) return;
    if (histIdx.current + 1 < h.length) h.length = histIdx.current + 1;
    h.push(next);
    if (h.length > 60) h.shift();
    histIdx.current = h.length - 1;
    bumpHist((v) => v + 1);
  }, []);
  useEffect(() => {
    if (histIdx.current === -1) {
      histRef.current = [stampsRef.current];
      histIdx.current = 0;
      bumpHist((v) => v + 1);
    }
  }, []);
  const undo = useCallback(() => {
    pushHist(stampsRef.current);
    if (histIdx.current > 0) {
      histIdx.current -= 1;
      setStamps(histRef.current[histIdx.current]);
      setSelected((id) => histRef.current[histIdx.current].some((s) => s.id === id) ? id : null);
      bumpHist((v) => v + 1);
    }
  }, [pushHist, setStamps]);
  const redo = useCallback(() => {
    if (histIdx.current < histRef.current.length - 1) {
      histIdx.current += 1;
      setStamps(histRef.current[histIdx.current]);
      setSelected((id) => histRef.current[histIdx.current].some((s) => s.id === id) ? id : null);
      bumpHist((v) => v + 1);
    }
  }, [setStamps]);

  // Make sure active seal exists
  useEffect(() => {
    if (!sealMap.has(activeSealId)) setActiveSealId(seals[0].id);
  }, [sealMap, activeSealId, seals]);

  // ---------- viewport sizing ----------
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  useLayoutEffect(() => {
    const el = viewportRef.current!;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const page = doc.pages[pageIdx];
  const pad = box.w < 640 ? 12 : 28;
  const fit = Math.max(0.01, Math.min((box.w - pad * 2) / page.width, (box.h - pad * 2) / page.height));
  const scale = fit * viewZoom;
  const dispW = page.width * scale;
  const dispH = page.height * scale;
  const dimRef = useRef({ dispW, dispH });
  dimRef.current = { dispW, dispH };
  const fitView = () => {
    setViewZoom(1);
    requestAnimationFrame(() => viewportRef.current?.scrollTo({ left: 0, top: 0 }));
  };
  useLayoutEffect(() => {
    if (viewZoom === 1) viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }, [box.w, box.h, pageIdx, viewZoom]);

  // ---------- pointer interactions ----------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<DragState | null>(null);

  const twoPts = () => [...pointers.current.values()].slice(0, 2);
  const ptsDist = (p: { x: number; y: number }[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
  const ptsAngle = (p: { x: number; y: number }[]) => (Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) * 180) / Math.PI;

  const startPinch = () => {
    const d = drag.current;
    if (!d) return;
    const pts = twoPts();
    if (pts.length < 2) return;
    const cur = stampsRef.current.find((s) => s.id === d.id);
    if (!cur) return;
    drag.current = { ...d, mode: "pinch", orig: cur, startDist: ptsDist(pts), startAngle: ptsAngle(pts) };
  };

  const startDrag = (e: React.PointerEvent, s: Stamp, mode: Mode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(s.id);
    setHint(false);
    if (s.locked || comparing) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === "move" && pointers.current.size >= 2 && drag.current) {
      startPinch();
      return;
    }
    if (!drag.current) pushHist(stampsRef.current); // checkpoint before the gesture
    const rect = pageRef.current!.getBoundingClientRect();
    const cur = stampsRef.current.find((x) => x.id === s.id) ?? s;
    const cx = rect.left + cur.x * rect.width;
    const cy = rect.top + cur.y * rect.height;
    drag.current = {
      mode,
      id: s.id,
      orig: cur,
      sx: e.clientX,
      sy: e.clientY,
      cx,
      cy,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      startAngle: (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI,
    };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = drag.current;
      if (!d) return;
      const { dispW, dispH } = dimRef.current;
      let patch: Partial<Stamp> = {};
      if (d.mode === "move") {
        let nx = clamp(d.orig.x + (e.clientX - d.sx) / dispW, 0, 1);
        let ny = clamp(d.orig.y + (e.clientY - d.sy) / dispH, 0, 1);
        for (const t of [0.08, 0.5, 0.92]) {
          if (Math.abs(nx - t) < 0.014) nx = t;
          if (Math.abs(ny - t) < 0.014) ny = t;
        }
        patch = { x: nx, y: ny };
      } else if (d.mode === "resize") {
        const dd = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
        patch = { w: clamp((d.orig.w * dd) / d.startDist, MIN_W, MAX_W) };
      } else if (d.mode === "rotate") {
        const a = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
        patch = { rot: normAngle(d.orig.rot + a - d.startAngle) };
      } else if (d.mode === "pinch") {
        const pts = twoPts();
        if (pts.length < 2) return;
        patch = {
          w: clamp((d.orig.w * ptsDist(pts)) / d.startDist, MIN_W, MAX_W),
          rot: normAngle(d.orig.rot + ptsAngle(pts) - d.startAngle),
        };
      }
      setStamps((ss) => ss.map((s) => (s.id === d.id ? { ...s, ...patch } : s)));
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const d = drag.current;
      if (!d) return;
      if (d.mode === "pinch" && pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        const cur = stampsRef.current.find((s) => s.id === d.id);
        if (cur) drag.current = { ...d, mode: "move", orig: cur, sx: p.x, sy: p.y };
      } else if (pointers.current.size === 0) {
        drag.current = null;
        pushHist(stampsRef.current);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  // wheel: zoom seal under cursor, ctrl+wheel zooms view
  const wheelTs = useRef(0);
  const wheelTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = viewportRef.current!;
    const onWheel = (e: WheelEvent) => {
      const t = (e.target as HTMLElement).closest("[data-stamp]") as HTMLElement | null;
      if (t && !e.ctrlKey) {
        e.preventDefault();
        const id = t.dataset.stamp!;
        if (stampsRef.current.find((s) => s.id === id)?.locked) return;
        const now = Date.now();
        if (now - wheelTs.current > 400) pushHist(stampsRef.current);
        wheelTs.current = now;
        const k = Math.exp(-e.deltaY * 0.0015);
        setStamps((ss) => ss.map((s) => (s.id === id ? { ...s, w: clamp(s.w * k, MIN_W, MAX_W) } : s)));
        setSelected(id);
        window.clearTimeout(wheelTimer.current);
        wheelTimer.current = window.setTimeout(() => pushHist(stampsRef.current), 350);
      } else if (e.ctrlKey) {
        e.preventDefault();
        setViewZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.002), 0.3, 6));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(wheelTimer.current);
    };
  }, []);

  // ---------- stamp operations ----------
  const apply = useCallback(
    (next: Stamp[]) => {
      pushHist(stampsRef.current);
      setStamps(next);
      pushHist(next);
    },
    [pushHist, setStamps]
  );
  const update = (id: string, patch: Partial<Stamp>) => setStamps((ss) => ss.map((s) => (s.id === id && !s.locked ? { ...s, ...patch } : s)));
  const sliderTs = useRef(0);
  const sliderTimer = useRef<number | undefined>(undefined);
  const updateSlid = (id: string, patch: Partial<Stamp>) => {
    const now = Date.now();
    if (now - sliderTs.current > 400) pushHist(stampsRef.current);
    sliderTs.current = now;
    update(id, patch);
    window.clearTimeout(sliderTimer.current);
    sliderTimer.current = window.setTimeout(() => pushHist(stampsRef.current), 350);
  };
  useEffect(() => () => { window.clearTimeout(sliderTimer.current); }, []);
  const applyOne = (id: string, patch: Partial<Stamp>) => apply(stampsRef.current.map((s) => (s.id === id && (!s.locked || "locked" in patch || "hidden" in patch) ? { ...s, ...patch } : s)));
  const lastSelectionVersion = useRef(selectionVersion);
  useEffect(() => {
    if (selectionVersion === lastSelectionVersion.current || !preferredSealId || !sealMap.has(preferredSealId)) return;
    lastSelectionVersion.current = selectionVersion;
    setActiveSealId(preferredSealId);
    const layer = stampsRef.current.find((s) => s.id === selected);
    if (layer && !layer.locked) {
      const old = getSeal(layer.sealId);
      const next = getSeal(preferredSealId);
      apply(stampsRef.current.map((s) => s.id === layer.id ? { ...s, sealId: next.id, w: clamp(s.w / old.aspect * next.aspect, MIN_W, MAX_W), blend: next.kind === "qr" ? "normal" : s.blend } : s));
    }
  }, [selectionVersion, preferredSealId, sealMap, selected, apply, getSeal]);
  const openTextEditor = (id: string | null = null) => {
    setEditingTextId(id);
    setTextModalOpen(true);
  };
  const saveTextLayer = (textSeal: Seal) => {
    const old = editingTextId ? getSeal(editingTextId) : undefined;
    const nextSeal = old ? { ...textSeal, id: uid() } : textSeal;
    setGeneratedSeals((prev) => [...prev, nextSeal]);
    if (old) {
      const next = stampsRef.current.map((s) =>
        s.sealId === old.id && !s.locked
          ? { ...s, sealId: nextSeal.id, w: clamp((s.w / old.aspect) * nextSeal.aspect, MIN_W, MAX_W) }
          : s
      );
      apply(next);
      return;
    }
    const p = doc.pages[pageIdx];
    const targetPx = 0.26 * Math.min(p.width, p.height);
    const wPx = textSeal.aspect >= 1 ? targetPx : targetPx * textSeal.aspect;
    const stamp: Stamp = {
      id: uid(), page: pageIdx, sealId: textSeal.id, x: 0.5, y: 0.5,
      w: wPx / p.width, rot: 0, opacity: 1,
    };
    apply([...stampsRef.current, stamp]);
    setSelected(stamp.id);
  };
  const sel = stamps.find((s) => s.id === selected) ?? null;

  /** Adds a freshly generated image (signature / recoloured seal / engineering block) as a new layer. */
  const placeNewSeal = (seal: Seal, x = 0.5, y = 0.5, widthFrac?: number, blend: "ink" | "normal" = "ink") => {
    setGeneratedSeals((prev) => [...prev, seal]);
    const p = doc.pages[pageIdx];
    const targetPx = 0.26 * Math.min(p.width, p.height);
    const wPx = seal.aspect >= 1 ? targetPx : targetPx * seal.aspect;
    const stamp: Stamp = { id: uid(), page: pageIdx, sealId: seal.id, x, y, w: widthFrac ?? wPx / p.width, rot: 0, opacity: 1, blend };
    apply([...stampsRef.current, stamp]);
    setSelected(stamp.id);
  };

  const [recoloring, setRecoloring] = useState(false);
  const recolorSelected = async (color: string, name: string) => {
    if (!sel || sel.locked) return;
    setRecoloring(true);
    try {
      const base = getSeal(sel.sealId);
      const seal = await recolorSeal(base, color, name);
      setGeneratedSeals((prev) => [...prev, seal]);
      applyOne(sel.id, { sealId: seal.id, w: clamp((sel.w / base.aspect) * seal.aspect, MIN_W, MAX_W) });
    } catch {
      alert("রং বদলানো যায়নি");
    } finally {
      setRecoloring(false);
    }
  };

  /** Moves the seal to a preset spot, keeping it fully inside the page. */
  const placeAt = (s: Stamp, px: number, py: number) => {
    const seal = getSeal(s.sealId);
    const p = doc.pages[s.page];
    const m = 0.03;
    const angle = s.rot * Math.PI / 180;
    const width = s.w * p.width;
    const height = width / seal.aspect;
    const boundW = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
    const boundH = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    const shrink = Math.min(1, p.width * (1 - 2 * m) / boundW, p.height * (1 - 2 * m) / boundH);
    const halfW = boundW * shrink / p.width / 2;
    const halfH = boundH * shrink / p.height / 2;
    applyOne(s.id, {
      w: s.w * shrink,
      x: clamp(px, halfW + m, 1 - halfW - m),
      y: clamp(py, halfH + m, 1 - halfH - m),
    });
  };
  const [signOpen, setSignOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [layouts, setLayouts] = useState<Layout[]>(() => loadLayouts());
  const [note, setNote] = useState<string | null>(null);
  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 2200);
  };

  const addPageNumbers = async (options: PageNumberOptions) => {
    if (stampsRef.current.some((layer) => layer.role === "page-number" && layer.locked)) throw new Error("পেজ নম্বরের স্তর লক করা আছে। আগে আনলক করুন।");
    const total = doc.pages.length;
    const made = await Promise.all(doc.pages.map((_, index) => makeTextSeal(formatPageNumber(index, total, options), "#0c1c4a", '"Hind Siliguri", sans-serif', "transparent")));
    setGeneratedSeals((prev) => [...prev, ...made]);
    const next: Stamp[] = made.map((seal, index) => {
      const page = doc.pages[index];
      const width = clamp(seal.aspect * page.height * .026 / page.width, .02, .3);
      const x = options.position === "bottom-center" ? .5 : Math.min(.94 - width / 2, .88);
      return { id: uid(), page: index, sealId: seal.id, x, y: options.position === "top-right" ? .055 : .945, w: width, rot: 0, opacity: 1, blend: "ink", role: "page-number" };
    });
    apply([...stampsRef.current.filter((layer) => layer.role !== "page-number"), ...next]);
    flash(`${total}টি পেজে নম্বর বসানো হয়েছে`);
  };

  const rememberLayout = async () => {
    const pageStampsNow = stampsRef.current.filter((s) => s.page === pageIdx && !s.hidden);
    if (!pageStampsNow.length) return flash("সেভ করার মতো সিল নেই");
    const name = prompt("লেআউটের নাম", "সনদের সিল") || "";
    if (!name.trim()) return;
    try { setLayouts(await saveLayout(name, pageStampsNow, editorSeals)); flash("লেআউট ও সিল সেভ হয়েছে"); }
    catch { flash("ব্রাউজারে জায়গা নেই। এডিটেবল প্রজেক্ট হিসেবে সেভ করুন।"); }
  };

  const applyLayout = (layout: Layout, everyPage: boolean) => {
    const stored = layout.seals ?? [];
    if (layout.stamps.some((s) => !sealMap.has(s.sealId) && !stored.some((a) => a.id === s.sealId))) return flash("পুরনো লেআউটের সিল পাওয়া যায়নি। আবার সেভ করুন।");
    if (!confirm("বর্তমান আনলক করা স্তরের বদলে সেভ করা লেআউট বসাবেন?")) return;
    const assets = stored.map((s) => ({ ...s, id: uid() }));
    const idMap = new Map(stored.map((s, i) => [s.id, assets[i].id]));
    setGeneratedSeals((prev) => [...prev, ...assets]);
    const pages = everyPage ? doc.pages.map((_, i) => i) : [pageIdx];
    const next = pages.flatMap((page) =>
      layout.stamps.map((s) => ({
        ...s,
        id: uid(),
        page,
        sealId: idMap.get(s.sealId) ?? s.sealId,
        opacity: s.opacity ?? 1,
        blend: s.blend ?? "ink",
      }))
    );
    apply([...stampsRef.current.filter((s) => !pages.includes(s.page) || s.locked), ...next]);
    flash(everyPage ? "সব পেজে বসানো হয়েছে" : "এই পেজে বসানো হয়েছে");
  };

  /** Stamps today's date as a small line under the seal — one click, no typing. */
  const addDateStamp = () => {
    const d = new Date();
    const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const bn = (n: number) => String(n).replace(/\d/g, (ch) => "০১২৩৪৫৬৭৮৯"[+ch]);
    const text = `${bn(d.getDate())} ${months[d.getMonth()]} ${bn(d.getFullYear())}`;
    const p = doc.pages[pageIdx];
    makeTextSeal(text, "#0c1c4a", "Arial, sans-serif", "transparent").then((seal) => {
      placeNewSeal(seal, 0.5, 0.78, Math.min(0.4, (0.22 * Math.min(p.width, p.height)) / p.width));
    });
  };

  const addStamp = (x = 0.5, y = 0.5) => {
    const s = makeStamp(pageIdx, activeSealId, x, y);
    apply([...stampsRef.current, s]);
    setSelected(s.id);
  };
  const removeStamp = (id: string) => {
    if (stampsRef.current.find((s) => s.id === id)?.locked) return;
    apply(stampsRef.current.filter((s) => s.id !== id));
    setSelected(null);
  };
  const duplicate = (s: Stamp) => {
    const n = { ...s, id: uid(), x: clamp(s.x + 0.04, 0, 1), y: clamp(s.y + 0.04, 0, 1) };
    apply([...stampsRef.current, n]);
    setSelected(n.id);
  };
  const applyAllPages = (s: Stamp) => {
    const ss = stampsRef.current;
    const others = ss.filter((x) => !(x.page !== s.page && x.sealId === s.sealId && Math.abs(x.x - s.x) < 0.01 && Math.abs(x.y - s.y) < 0.01));
    const copies = doc.pages.map((_, i) => i).filter((i) => i !== s.page).map((i) => ({ ...s, id: uid(), page: i }));
    apply([...others, ...copies]);
  };
  const pickSeal = (id: string) => {
    setActiveSealId(id);
    if (sel) {
      const seal = getSeal(id);
      const old = getSeal(sel.sealId);
      // keep similar visual height when switching seal
      const h = sel.w / old.aspect;
      applyOne(sel.id, { sealId: id, w: clamp(h * seal.aspect, MIN_W, MAX_W), blend: seal.kind === "qr" ? "normal" : sel.blend });
    }
  };
  const removeSealFromLibrary = (id: string) => {
    const seal = getSeal(id);
    if (!onDeleteSeal(id)) return;
    setGeneratedSeals((prev) => [...prev.filter((s) => s.id !== id), seal]);
    setRemovedSealIds((ids) => new Set(ids).add(id));
    if (activeSealId === id) setActiveSealId(seals.find((s) => s.builtIn)?.id ?? seals[0].id);
  };

  // keyboard shortcuts
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable || document.querySelector('[role="dialog"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setQuick(null);
        setSaveOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        const selectedLayer = stampsRef.current.find((x) => x.id === selected);
        if (selectedLayer) {
          e.preventDefault();
          duplicate(selectedLayer);
        }
        return;
      }
      const s = stampsRef.current.find((x) => x.id === selected);
      if (!s) return;
      const { dispW, dispH } = dimRef.current;
      const step = e.shiftKey ? 10 : 1;
      const map: Record<string, Partial<Stamp>> = {
        ArrowLeft: { x: clamp(s.x - step / dispW, 0, 1) },
        ArrowRight: { x: clamp(s.x + step / dispW, 0, 1) },
        ArrowUp: { y: clamp(s.y - step / dispH, 0, 1) },
        ArrowDown: { y: clamp(s.y + step / dispH, 0, 1) },
        "+": { w: clamp(s.w * 1.05, MIN_W, MAX_W) },
        "=": { w: clamp(s.w * 1.05, MIN_W, MAX_W) },
        "-": { w: clamp(s.w / 1.05, MIN_W, MAX_W) },
      };
      if (map[e.key]) {
        e.preventDefault();
        applyOne(s.id, map[e.key]);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeStamp(s.id);
      } else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // fullscreen
  useEffect(() => {
    const f = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  /** One-click PNG of the current page, with a visible fallback link. */
  const quickDownload = async () => {
    if (quickGuard.current) return;
    quickGuard.current = true;
    setQuickBusy(true);
    try {
      const blob = await pagePng(doc, stampsRef.current, editorSeals, pageIdx);
      const name = `${baseNameForFile(doc.name)}-sealed-page${pageIdx + 1}.png`;
      const file = prepareFile(blob, name);
      setQuick(file);
      if (!isEmbedded()) requestDownload(file);
      setHint(false);
    } catch {
      alert("ফাইল তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন।");
    } finally {
      quickGuard.current = false;
      setQuickBusy(false);
    }
  };

  const organizeCurrentPdf = async () => {
    if (doc.kind !== "pdf" || pageOrganizerBusy) return;
    setPageOrganizerBusy(true);
    try {
      const blob = await exportPdf(doc, stampsRef.current, editorSeals);
      setPageOrganizerFile(new File([blob], `${baseNameForFile(doc.name)}-edited.pdf`, { type: "application/pdf" }));
      setPageOrganizerOpen(true);
    } catch (cause) { alert((cause as Error).message || "PDF পেজ খোলা যায়নি।"); }
    finally { setPageOrganizerBusy(false); }
  };

  const goPage = (i: number) => {
    setPageIdx(clamp(i, 0, doc.pages.length - 1));
    setSelected(null);
    setComparing(false);
    fitView();
  };

  const currentLayers = stamps.filter((s) => s.page === pageIdx);
  const pageStamps = currentLayers.filter((s) => !s.hidden);
  const moveLayer = (id: string, direction: -1 | 1) => {
    const ordered = stampsRef.current.filter((s) => s.page === pageIdx);
    const i = ordered.findIndex((s) => s.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    let cursor = 0;
    apply(stampsRef.current.map((s) => (s.page === pageIdx ? ordered[cursor++] : s)));
  };
  const clearPageLayers = () => {
    if (!currentLayers.length || !confirm("এই পেজের সব সিল ও লেখা মুছে ফেলবেন?")) return;
    apply(stampsRef.current.filter((s) => s.page !== pageIdx || s.locked));
    setSelected(null);
  };
  const handle = "absolute h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-md";

  return (
    <div className="workspace-shell fixed inset-0 flex flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="workspace-header z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-800/80 bg-[#0a1020]/95 px-2 backdrop-blur sm:px-3">
        <button onClick={onClose} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800" title="ফিরে যান">
          <Icon.Back />
          <span className="hidden sm:inline">ফিরে যান</span>
        </button>
        <div className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
        <div className="flex min-w-0 items-center gap-2">
          {doc.kind === "pdf" ? <Icon.File className="h-4 w-4 shrink-0 text-red-400" /> : <Icon.Image className="h-4 w-4 shrink-0 text-emerald-400" />}
          <span className="max-w-[42vw] truncate text-xs font-medium text-slate-200 sm:max-w-none sm:text-sm">{doc.name}</span>
        </div>
        <div className="flex-1" />
        <button onClick={toggleFs} className="hidden rounded-lg p-2 text-slate-300 hover:bg-slate-800 sm:block" title="ফুল স্ক্রিন">
          {isFs ? <Icon.Shrink /> : <Icon.Expand />}
        </button>
        <button onClick={() => setPanelOpen((o) => !o)} className={cn("rounded-lg p-2 hover:bg-slate-800", panelOpen ? "text-blue-400" : "text-slate-300")} title="সেটিংস প্যানেল" aria-expanded={panelOpen}>
          <Icon.Panel />
        </button>
        {(doc.kind === "pdf" || !!doc.textItems?.length) && <button data-testid="pdf-text-button" onClick={() => setPdfTextOpen(true)} className="hidden items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 sm:flex" title="PDF লেখা এডিট">
          <Icon.Text className="h-4 w-4" /><span>টেক্সট</span>
        </button>}
        <button data-testid="eng-tools-button" onClick={() => setEngOpen(true)} className="hidden items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 sm:flex" title="ইঞ্জিনিয়ারিং ও মার্কআপ টুলস">
          <Icon.Tools className="h-4 w-4" /><span>ইঞ্জিনিয়ারিং</span>
        </button>
        <button disabled={quickBusy} onClick={quickDownload} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" title="এই পেজ PNG ডাউনলোড">
          {quickBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" /> : <Icon.Download className="h-4 w-4" />}
          <span className="hidden sm:inline">দ্রুত PNG</span>
        </button>
        <button
          onClick={() => {
            setSelected(null);
            setQuick(null);
            setSaveOpen(true);
          }}
          className="editor-save ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 sm:gap-2 sm:px-4"
        >
          <Icon.Download className="h-4 w-4" />
          <span>সেভ</span>
        </button>
      </header>

      <div className={cn("workspace-main", panelOpen && "panel-open")}>
        <section className="workspace-area" aria-label="ডকুমেন্ট এডিটর">
          <div className="workspace-status">
            <span className="workspace-page-label">পেজ {pageIdx + 1} / {doc.pages.length}</span>
            <span className="workspace-status-hint">{comparing ? "মূল ডকুমেন্ট দেখছেন" : hint ? "সিল টেনে জায়গামতো রাখুন" : "মূল ফাইল অপরিবর্তিত থাকে"}</span>
            {!!layerIssues.length && <button onClick={() => { setPanelTab("check"); setPanelOpen(true); }} className="workspace-error-button" title="ভুলগুলো দেখুন"><Icon.Info className="h-3.5 w-3.5" />{layerIssues.length}টি ভুল</button>}
            <div className="workspace-view-tools" aria-label="ডকুমেন্ট দেখার নিয়ন্ত্রণ">
              <button title="ডকুমেন্ট ছোট করে দেখুন" onClick={() => setViewZoom((z) => clamp(z / 1.2, .3, 6))}><Icon.Minus className="h-3.5 w-3.5" /></button>
              <button title="স্ক্রিনে ফিট করুন" onClick={fitView} className="workspace-fit"><Icon.Fit className="h-3.5 w-3.5" /><span>{Math.round(viewZoom * 100)}%</span></button>
              <button title="ডকুমেন্ট বড় করে দেখুন" onClick={() => setViewZoom((z) => clamp(z * 1.2, .3, 6))}><Icon.Plus className="h-3.5 w-3.5" /></button>
              <button data-testid="grid-toggle" title="ইঞ্জিনিয়ারিং গ্রিড ও স্কেল" aria-pressed={gridOn} onClick={() => setGridOn((v) => !v)} className="workspace-compare"><span>গ্রিড</span></button>
              <button title="মূল ছবি দেখুন" aria-pressed={comparing} onClick={() => setComparing((v) => !v)} className="workspace-compare"><Icon.Eye className="h-4 w-4" /><span>{comparing ? "সিলসহ" : "মূল ছবি"}</span></button>
            </div>
          </div>
          <div ref={viewportRef} data-testid="viewport" className="editor-bg workspace-viewport">
            <div className="workspace-page-space" style={{ padding: pad, width: Math.max(box.w, dispW + pad * 2), height: Math.max(box.h, dispH + pad * 2) }}>
              <div
                ref={pageRef}
                data-testid="page-surface"
                className="workspace-page"
                style={{ width: dispW, height: dispH, touchAction: "pan-x pan-y" }}
                onPointerDown={(event) => {
                  if (drag.current && pointers.current.size === 1) {
                    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); startPinch(); return;
                  }
                  if (!comparing) setSelected(null);
                }}
                onDoubleClick={(event) => {
                  if (comparing || (event.target as HTMLElement).closest("[data-stamp]")) return;
                  const rect = pageRef.current!.getBoundingClientRect();
                  addStamp((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
                }}
              >
                <div data-testid="page-paint" className="workspace-paint">
                  <img src={page.src} alt="ডকুমেন্ট" draggable={false} className="workspace-document" />
                  {!comparing && expandForPaint(pageStamps).map((paint) => {
                    const seal = getSeal(paint.sealId);
                    const width = paint.w * dispW;
                    const height = width / seal.aspect;
                    const ink = inkValues(paint);
                    return <img key={paint.id} data-painted={paint.id} src={seal.src} alt="" draggable={false} className="workspace-ink" style={{
                      left: paint.x * dispW - width / 2, top: paint.y * dispH - height / 2, width, height,
                      transform: `rotate(${paint.rot}deg)`, opacity: ink.opacity, filter: inkFilter(ink),
                      mixBlendMode: ink.blend === "normal" ? "normal" : "multiply",
                    }} />;
                  })}
                  {gridOn && (
                    <div
                      data-testid="engineering-grid"
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(37,99,235,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.18) 1px, transparent 1px), linear-gradient(to right, rgba(37,99,235,0.36) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.36) 1px, transparent 1px)",
                        backgroundSize: `${dispW / 20}px ${dispH / 20}px, ${dispW / 20}px ${dispH / 20}px, ${dispW / 4}px ${dispH / 4}px, ${dispW / 4}px ${dispH / 4}px`,
                      }}
                    />
                  )}
                </div>
                {!comparing && pageStamps.map((stamp) => {
                  const seal = getSeal(stamp.sealId);
                  const width = stamp.w * dispW;
                  const height = width / seal.aspect;
                  const isSelected = stamp.id === selected;
                  return <div key={stamp.id} data-stamp={stamp.id} className={cn("workspace-stamp", stamp.locked && "is-locked", errorIds.has(stamp.id) && "has-issue")} style={{
                    left: stamp.x * dispW - width / 2, top: stamp.y * dispH - height / 2, width, height,
                    transform: `rotate(${stamp.rot}deg)`, zIndex: isSelected ? 60 : currentLayers.findIndex((layer) => layer.id === stamp.id) + 1,
                  }} onPointerDown={(event) => startDrag(event, stamp, "move")}>
                    {isSelected && stamp.locked && <div className="pointer-events-none absolute -inset-1 border border-amber-400/70"><Icon.Lock className="absolute -top-6 h-4 w-4 text-amber-400" /></div>}
                    {isSelected && !stamp.locked && <>
                      <div className="pointer-events-none absolute -inset-1 rounded-sm border border-blue-400" />
                      <div className="pointer-events-none absolute -top-7 left-1/2 h-6 w-px bg-blue-400" />
                      <button className="workspace-rotate" title="ঘোরান" onPointerDown={(event) => startDrag(event, stamp, "rotate")}><Icon.Rotate className="h-3.5 w-3.5" /></button>
                      {[
                        ["-left-3 -top-3", "nwse-resize"], ["-right-3 -top-3", "nesw-resize"],
                        ["-left-3 -bottom-3", "nesw-resize"], ["-right-3 -bottom-3", "nwse-resize"],
                      ].map(([pos, cursor]) => <div key={pos} data-resize={pos} className={cn("absolute flex h-7 w-7 items-center justify-center", pos)} style={{ cursor, touchAction: "none" }} onPointerDown={(event) => startDrag(event, stamp, "resize")}><div className={cn(handle, "static")} /></div>)}
                    </>}
                  </div>;
                })}
              </div>
            </div>
          </div>
          <div className="workspace-toolbar" aria-label="এডিটিং টুল">
            <div className="workspace-history">
              <button onClick={undo} disabled={histIdx.current <= 0} title="আনডু (Ctrl+Z)"><Icon.Undo className="h-4 w-4" /></button>
              <button onClick={redo} disabled={histIdx.current >= histRef.current.length - 1} title="রিডু (Ctrl+Y)"><Icon.Redo className="h-4 w-4" /></button>
            </div>
            <div className="workspace-create">
              <button onClick={() => { setComparing(false); addStamp(); }} className="toolbar-primary"><Icon.Plus className="h-4 w-4" />সিল</button>
              {doc.kind === "pdf" && (
                <button onClick={() => setPdfTextOpen(true)} title="PDF-এর মূল লেখা এডিট"><Icon.Text className="h-4 w-4" />PDF লেখা</button>
              )}
              <button onClick={() => openTextEditor()}><Icon.Text className="h-4 w-4" />লেখা</button>
              <button onClick={() => setEngOpen(true)} title="ইঞ্জিনিয়ারিং ও মার্কআপ"><Icon.Tools className="h-4 w-4" />ইঞ্জিনিয়ারিং</button>
              <button onClick={() => setSignOpen(true)}><Icon.Edit className="h-4 w-4" />স্বাক্ষর</button>
              <button onClick={addDateStamp} title="আজকের তারিখ বসান"><Icon.File className="h-4 w-4" />তারিখ</button>
              <button disabled={!sel} aria-label="আলো ও কালি খুলুন" onClick={() => { setComparing(false); setPanelTab("seal"); setPanelOpen(true); }}><Icon.Sun className="h-4 w-4" />কালি</button>
            </div>
            {doc.pages.length > 1 && <div className="workspace-pages">
              <button title="আগের পেজ" disabled={pageIdx === 0} onClick={() => goPage(pageIdx - 1)}><Icon.Back className="h-4 w-4" /></button>
              <span>{pageIdx + 1} / {doc.pages.length}</span>
              <button title="পরের পেজ" disabled={pageIdx === doc.pages.length - 1} onClick={() => goPage(pageIdx + 1)}><Icon.Next className="h-4 w-4" /></button>
            </div>}
          </div>
        </section>

        {/* side panel */}
        {panelOpen && (
          <aside className="workspace-panel" aria-label="এডিটর সেটিংস">
            <div className="workspace-panel-head">
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <span className="font-semibold">সেটিংস</span>
              <button aria-label="সেটিংস বন্ধ করুন" onClick={() => setPanelOpen(false)} className="rounded-full p-2 hover:bg-slate-800">
                <Icon.X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-slate-950 p-1">
              {([
                ["seal", "সিল"],
                ["layer", "স্তর"],
                ["check", layerIssues.length ? `যাচাই ${layerIssues.length}` : "যাচাই"],
                ["page", "পেজ"],
              ] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPanelTab(id)} aria-pressed={panelTab === id} className={cn("rounded-lg py-1.5 text-[11px] font-semibold", panelTab === id ? "bg-blue-600 text-white" : id === "check" && layerIssues.length ? "text-rose-300" : "text-slate-400 hover:text-white")}>
                  {label}
                </button>
              ))}
            </div>

            </div>
            {panelTab === "seal" && (
            <>
            {sel ? (
              <section className="space-y-4">
                <div className="workspace-layer-name flex items-center justify-between gap-3">
                  <h4 className="min-w-0 truncate text-xs font-semibold text-slate-300">{getSeal(sel.sealId).name}</h4>
                  <button title={sel.locked ? "আনলক" : "লক করুন"} onClick={() => applyOne(sel.id, { locked: !sel.locked })} className="p-1 text-slate-400">{sel.locked ? <Icon.Lock className="h-4 w-4 text-amber-300" /> : <Icon.Unlock className="h-4 w-4" />}</button>
                </div>
                {sel.locked && <p className="text-xs text-amber-300">লক করা আছে। বদলাতে আগে আনলক করুন।</p>}
                {getSeal(sel.sealId).kind === "qr" && <p className="text-xs leading-relaxed text-amber-300">QR পড়ার জন্য সাদা ব্যাকগ্রাউন্ড ও পর্যাপ্ত আকার রাখুন। ডাউনলোডের পর স্ক্যান করে নিন।</p>}
                <fieldset disabled={sel.locked} className="min-w-0 space-y-4 disabled:opacity-50">
                <InkControls stamp={sel} onChange={(patch) => updateSlid(sel.id, patch)} onPreset={(patch) => applyOne(sel.id, patch)} />
                <details className="workspace-advanced"><summary>সাইজ, ঘোরানো ও অবস্থান</summary><div className="mt-4 space-y-4">
                <Slider label="সাইজ (জুম)" min={MIN_W} max={1} step={0.005} value={Math.min(1, sel.w)} display={`${Math.round(sel.w * 100)}%`} onChange={(v) => updateSlid(sel.id, { w: v })} />
                <Slider label="ঘোরানো" min={-180} max={180} step={1} value={sel.rot} display={`${Math.round(sel.rot)}°`} onChange={(v) => updateSlid(sel.id, { rot: v })} />
                <Slider label="অবস্থান — বাম / ডান" min={0} max={1} step={0.002} value={sel.x} display={`${Math.round(sel.x * 100)}%`} onChange={(v) => updateSlid(sel.id, { x: v })} />
                <Slider label="অবস্থান — উপর / নিচ" min={0} max={1} step={0.002} value={sel.y} display={`${Math.round(sel.y * 100)}%`} onChange={(v) => updateSlid(sel.id, { y: v })} />
                <div>
                  <div className="mb-1.5 text-sm text-slate-300">দ্রুত জায়গা</div>
                  <div className="grid w-32 grid-cols-3 gap-1">
                    {PRESETS.map(([label, px, py]) => (
                      <button
                        key={label}
                        onClick={() => placeAt(sel, px, py)}
                        className="aspect-square rounded-md bg-slate-800 text-sm text-slate-300 hover:bg-blue-600 hover:text-white"
                        title="এখানে বসান"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {getSeal(sel.sealId).kind !== "text" && getSeal(sel.sealId).kind !== "qr" && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm text-slate-300">
                      <span>কালির রং</span>
                      {recoloring && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />}
                    </div>
                    <div className="flex gap-2">
                      {INK_COLORS.map((c) => (
                        <button
                          key={c.c}
                          disabled={recoloring}
                          title={c.n}
                          onClick={() => recolorSelected(c.c, c.n)}
                          className="h-7 w-7 rounded-full border-2 border-slate-600 transition hover:scale-110 disabled:opacity-50"
                          style={{ background: c.c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                <button onClick={() => applyOne(sel.id, { tile: !sel.tile })} className="rounded-lg bg-slate-800 px-2 py-2 text-xs hover:bg-slate-700">
                    {sel.tile ? "ওয়াটারমার্ক বন্ধ" : "ওয়াটারমার্ক"}
                  </button>
                <button onClick={() => applyOne(sel.id, { rot: 0 })} className="rounded-lg bg-slate-800 px-2 py-2 text-xs hover:bg-slate-700">
                    সোজা করুন
                  </button>
                  <button onClick={() => applyOne(sel.id, { x: 0.5, y: 0.5 })} className="rounded-lg bg-slate-800 px-2 py-2 text-xs hover:bg-slate-700">
                    মাঝখানে
                  </button>
                  <button onClick={() => duplicate(sel)} className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-2 text-xs hover:bg-slate-700">
                    <Icon.Copy className="h-3.5 w-3.5" /> কপি
                  </button>
                </div>
                </div></details>
                {sel.origin === "pdf-text" ? (
                  <button onClick={() => setPdfTextOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/25">
                    <Icon.Text className="h-4 w-4" /> PDF লেখা সম্পাদনা
                  </button>
                ) : getSeal(sel.sealId).kind === "text" && (
                  <button onClick={() => openTextEditor(sel.sealId)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600/15 px-3 py-2 text-sm font-medium text-blue-300 ring-1 ring-blue-500/30 hover:bg-blue-600/25">
                    <Icon.Edit className="h-4 w-4" /> লেখাটি সম্পাদনা
                  </button>
                )}
                {doc.pages.length > 1 && (
                  <button onClick={() => applyAllPages(sel)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600/20 px-3 py-2 text-sm font-medium text-indigo-300 ring-1 ring-indigo-500/40 hover:bg-indigo-600/30">
                    <Icon.Layers className="h-4 w-4" /> সব পেজে একই জায়গায় বসান
                  </button>
                )}
                <button onClick={() => removeStamp(sel.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20">
                  <Icon.Trash className="h-4 w-4" /> সিলটি মুছুন
                </button>
                </fieldset>
              </section>
            ) : (
              <section className="rounded-xl bg-slate-800/50 p-3 text-sm text-slate-400">
                কোনো স্তর নির্বাচিত নেই। পেজে ডাবল ক্লিক করে সিল বসান, অথবা
                <button onClick={() => addStamp()} className="mx-1 font-semibold text-blue-400 hover:underline">
                  নতুন সিল যোগ করুন
                </button>
                 ।
               </section>
             )}
            <div className="mt-5">
            <details className="workspace-library" open={!sel}>
              <summary>সিল নির্বাচন ও তৈরি <Icon.Plus className="h-3.5 w-3.5" /></summary>
              <section className="mt-3">
              <SealPicker seals={editorSeals.filter((s) => s.kind !== "text" && !removedSealIds.has(s.id))} activeId={sel?.sealId ?? activeSealId} onPick={pickSeal} onDelete={removeSealFromLibrary} dark />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={onCustomize} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-medium hover:bg-slate-700">
                  <Icon.Edit className="h-3.5 w-3.5" /> কাস্টমাইজ
                </button>
                <button onClick={onUploadSeal} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-medium hover:bg-slate-700">
                  <Icon.Upload className="h-3.5 w-3.5" /> নিজের সিল
                </button>
              </div>
              <button onClick={() => openTextEditor()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600/15 px-3 py-2 text-sm font-medium text-blue-300 ring-1 ring-blue-500/30 hover:bg-blue-600/25">
                <Icon.Text className="h-4 w-4" /> লেখা / ওয়াটারমার্ক যোগ করুন
              </button>
              <button onClick={() => setSignOpen(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/25">
                <Icon.Edit className="h-4 w-4" /> স্বাক্ষর আঁকুন
              </button>
              <button onClick={() => setEngOpen(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25">
                <Icon.Tools className="h-4 w-4" /> ইঞ্জিনিয়ারিং ও মার্কআপ ব্লক
              </button>
              {!!doc.textItems?.length && <button onClick={() => setPdfTextOpen(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/25">
                <Icon.Text className="h-4 w-4" /> PDF লেখা এডিট
              </button>}
              </section>
            </details>

            <div className="my-4 h-px bg-slate-800" />

            </div>
            </>
            )}

            {panelTab === "layer" && (
            <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Icon.Layers className="h-3.5 w-3.5" /> স্তর ({currentLayers.length})
                </h4>
                {currentLayers.length > 0 && <button onClick={clearPageLayers} className="text-xs text-red-300 hover:text-red-200">সব মুছুন</button>}
              </div>
              {currentLayers.length ? (
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {[...currentLayers].reverse().map((layer, displayIndex) => {
                    const seal = getSeal(layer.sealId);
                    const actualIndex = currentLayers.length - displayIndex - 1;
                    const isSelected = layer.id === selected;
                    return (
                      <div key={layer.id} className={cn("flex min-w-0 items-center gap-1 rounded-lg border px-1.5 py-1", isSelected ? "border-blue-500/60 bg-blue-500/10" : "border-transparent bg-slate-900/70", layer.hidden && "opacity-55")}>
                        <button onClick={() => setSelected(layer.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-800" title={seal.name}>
                          <span className="checker flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
                            {seal.kind === "text" ? <Icon.Text className="h-4 w-4 text-slate-500" /> : <img src={seal.src} alt="" className="h-full w-full object-contain" />}
                          </span>
                          <span className={cn("truncate text-xs", layer.hidden ? "text-slate-500 line-through" : "text-slate-200")}>{seal.name}</span>
                        </button>
                        {seal.kind === "text" && (
                          <button onClick={() => openTextEditor(seal.id)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" title="লেখা সম্পাদনা">
                            <Icon.Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button disabled={actualIndex === currentLayers.length - 1} onClick={() => moveLayer(layer.id, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-25" title="উপরে আনুন">
                          <Icon.Up className="h-3.5 w-3.5" />
                        </button>
                        <button disabled={actualIndex === 0} onClick={() => moveLayer(layer.id, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-25" title="নিচে পাঠান">
                          <Icon.Down className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => applyOne(layer.id, { hidden: !layer.hidden })} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" title={layer.hidden ? "দেখান" : "লুকান"}>
                          {layer.hidden ? <Icon.EyeOff className="h-3.5 w-3.5" /> : <Icon.Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => applyOne(layer.id, { locked: !layer.locked })} className={cn("rounded p-1 hover:bg-slate-800", layer.locked ? "text-amber-300" : "text-slate-400 hover:text-white")} title={layer.locked ? "আনলক" : "লক করুন"}>
                          {layer.locked ? <Icon.Lock className="h-3.5 w-3.5" /> : <Icon.Unlock className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                 <p className="py-2 text-center text-xs text-slate-500">এই পেজে কোনো স্তর নেই</p>
               )}
             </section>
            )}

            {panelTab === "check" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">নথি যাচাই</h4><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", layerIssues.length ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>{layerIssues.length ? `${layerIssues.length}টি ভুল` : "সব ঠিক"}</span></div>
                {layerIssues.length ? <>
                  <p className="text-xs leading-relaxed text-slate-400">লাল দাগ দেওয়া স্তরগুলোতে সমস্যা আছে। নিচের যেকোনো সমস্যায় চাপ দিলে সেই স্তরটি নির্বাচিত হবে।</p>
                  {layerIssues.map((issue, index) => {
                    const stamp = stamps.find((item) => item.id === issue.id);
                    return <button key={`${issue.id}-${index}`} onClick={() => { setSelected(issue.id); setPanelTab("seal"); }} className="flex w-full items-start gap-2 rounded-lg bg-rose-500/10 p-2.5 text-left ring-1 ring-rose-500/30 hover:bg-rose-500/20">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">!</span>
                      <span className="min-w-0"><b className="block truncate text-xs text-rose-200">{getSeal(issue.id === stamp?.id ? stamp.sealId : "").name}</b><span className="text-[11px] leading-relaxed text-rose-200/80">{issue.message}</span></span>
                    </button>;
                  })}
                </> : <div className="rounded-xl bg-emerald-500/10 p-4 text-center ring-1 ring-emerald-500/25"><Icon.Check className="mx-auto h-6 w-6 text-emerald-400" /><p className="mt-2 text-sm text-emerald-200">কোনো ভুল পাওয়া যায়নি।</p><p className="mt-1 text-xs text-emerald-200/70">স্তর পেজের ভেতরে আছে, আকার ও কালি ঠিক আছে।</p></div>}
                {doc.kind === "pdf" && !!doc.textItems?.length && <button onClick={() => setPdfTextOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><Icon.Text className="h-4 w-4" /> PDF লেখা এডিট ও যাচাই</button>}
              </section>
            )}
            {panelTab === "page" && (
              <>
              <section className="mb-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">ডকুমেন্ট টুল</h4>
                {note && <p className="rounded-lg bg-emerald-500/15 px-2 py-1.5 text-xs text-emerald-300">{note}</p>}
                {doc.kind === "pdf" && <button disabled={pageOrganizerBusy} onClick={organizeCurrentPdf} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700 disabled:opacity-50"><b className="block">{pageOrganizerBusy ? "পেজ প্রস্তুত হচ্ছে..." : "PDF পেজ সাজান"}</b><span className="text-xs text-slate-400">বর্তমান সিলসহ পেজ বাছাই, ঘোরানো ও ডাউনলোড</span></button>}
                <button onClick={() => setPageNumberOpen(true)} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700">
                  <b className="block">পেজ নম্বর</b>
                  <span className="text-xs text-slate-400">ভাষা ও অবস্থান বেছে সব পেজে বসান</span>
                </button>
                <button onClick={() => setBatchOpen(true)} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700">
                  <b className="block">অনেক ফাইলে একই সিল</b>
                  <span className="text-xs text-slate-400">এই পেজের জায়গা অন্য ছবি/PDF-এ বসিয়ে ZIP</span>
                </button>
                <button onClick={rememberLayout} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700">
                  <b className="block">এই জায়গা মনে রাখুন</b>
                  <span className="text-xs text-slate-400">পরে অন্য কাগজে এক ক্লিকে বসবে</span>
                </button>
                {layouts.map((layout) => (
                  <div key={layout.id} className="flex items-center gap-1 rounded-lg bg-slate-950 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{layout.name}</span>
                    <button onClick={() => applyLayout(layout, false)} className="rounded px-2 py-1 text-xs text-blue-300 hover:bg-slate-800">এই পেজ</button>
                    {doc.pages.length > 1 && (
                      <button onClick={() => applyLayout(layout, true)} className="rounded px-2 py-1 text-xs text-indigo-300 hover:bg-slate-800">সব</button>
                    )}
                    <button onClick={() => setLayouts(deleteLayout(layout.id))} className="rounded p-1 text-slate-500 hover:text-red-300" title="মুছুন">
                      <Icon.X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </section>
             {doc.pages.length > 1 ? (
               <section className="mb-4">
                 <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">পেজসমূহ</h4>
                 <div className="grid grid-cols-4 gap-2">
                   {doc.pages.map((p, i) => {
                     const count = stamps.filter((s) => s.page === i).length;
                     return (
                       <button key={i} onClick={() => goPage(i)} className={cn("relative overflow-hidden rounded-md border-2 bg-white", i === pageIdx ? "border-blue-500" : "border-transparent opacity-70 hover:opacity-100")}>
                         <img src={p.src} alt={`page ${i + 1}`} className="w-full" />
                         <span className="absolute bottom-0 left-0 bg-slate-900/80 px-1 text-[10px]">{i + 1}</span>
                         {count > 0 && <span className="absolute right-0.5 top-0.5 rounded-full bg-blue-500 px-1.5 text-[10px] font-bold">{count}</span>}
                       </button>
                     );
                   })}
                 </div>
               </section>
             ) : (
               <p className="py-8 text-center text-sm text-slate-500">এই ডকুমেন্টে একটিই পেজ আছে</p>
             )}

             <section className="space-y-1.5 text-xs text-slate-500">
               <p>অ্যারো কী দিয়ে সূক্ষ্মভাবে সরান (Shift = দ্রুত)</p>
               <p>Ctrl+Z / Ctrl+Y = আনডু / রিডু · Ctrl+D = কপি</p>
               <p>Ctrl+S = সেভ · Delete = নির্বাচিত স্তর মুছুন</p>
             </section>
              </>
            )}
          </aside>
        )}
      </div>

      {quick && !saveOpen && <div className="quick-file-toast">
        <button type="button" aria-label="ডাউনলোড বার্তা বন্ধ করুন" className="quick-file-close" onClick={() => setQuick(null)}><Icon.X className="h-4 w-4" /></button>
        <DownloadResult key={quick.url} file={quick} dark />
      </div>}
      <SaveModal open={saveOpen} onClose={() => setSaveOpen(false)} doc={doc} stamps={stamps} seals={editorSeals} pageIdx={pageIdx} />
      <PdfTextModal open={pdfTextOpen} onClose={() => setPdfTextOpen(false)} doc={doc} pageIdx={pageIdx} stamps={stamps} onApply={applyPdfText} onRevert={revertPdfText} />
      <EngineeringModal
        open={engOpen}
        onClose={() => setEngOpen(false)}
        onCreate={(seal, widthFrac) => placeNewSeal(seal, 0.72, 0.78, widthFrac, "normal")}
      />
      <BatchModal open={batchOpen} onClose={() => setBatchOpen(false)} pattern={stamps.filter((s) => s.page === pageIdx && !s.hidden)} seals={editorSeals} />
      <PdfOrganizer open={pageOrganizerOpen} initialFile={pageOrganizerFile} onClose={() => { setPageOrganizerOpen(false); setPageOrganizerFile(null); }} />
      <PageNumberModal open={pageNumberOpen} onClose={() => setPageNumberOpen(false)} total={doc.pages.length} onApply={addPageNumbers} />
      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onCreate={(s) => {
          const p = doc.pages[pageIdx];
          // signatures default to ~22% of page width, near bottom-right signature line
          placeNewSeal(s, 0.76, 0.82, Math.min(0.32, (0.22 * Math.min(p.width, p.height)) / p.width * 1.2));
        }}
      />
      <TextLayerModal
        open={textModalOpen}
        onClose={() => setTextModalOpen(false)}
        initial={editingTextId ? getSeal(editingTextId) : undefined}
        onCreate={saveTextLayer}
      />
    </div>
  );
}
