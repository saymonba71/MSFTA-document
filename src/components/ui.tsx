import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";
import type { Seal } from "../types";

type IconProps = { className?: string };
const I = ({ d, className }: { d: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn("h-5 w-5", className)}>
    {d}
  </svg>
);

export const Icon = {
  Grid: (p: IconProps) => <I {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>} />,
  ArrowUp: (p: IconProps) => <I {...p} d={<><path d="M12 20V4" /><path d="m6 10 6-6 6 6" /></>} />,
  ArrowDown: (p: IconProps) => <I {...p} d={<><path d="M12 4v16" /><path d="m6 14 6 6 6-6" /></>} />,
  Qr: (p: IconProps) => <I {...p} d={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14h1v3M14 21h3M20 20h1" /></>} />,
  Info: (p: IconProps) => <I {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>} />,
  Home: (p: IconProps) => <I {...p} d={<><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>} />,
  Search: (p: IconProps) => <I {...p} d={<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>} />,
  Bookmark: (p: IconProps) => <I {...p} d={<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z" />} />,
  Tools: (p: IconProps) => <I {...p} d={<><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5z" /><path d="m16 4 4 4" /></>} />,
  Sun: (p: IconProps) => <I {...p} d={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>} />,
  Upload: (p: IconProps) => <I {...p} d={<><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></>} />,
  Download: (p: IconProps) => <I {...p} d={<><path d="M12 4v12" /><path d="m6 10 6 6 6-6" /><path d="M4 20h16" /></>} />,
  Back: (p: IconProps) => <I {...p} d={<path d="m15 18-6-6 6-6" />} />,
  Next: (p: IconProps) => <I {...p} d={<path d="m9 18 6-6-6-6" />} />,
  Plus: (p: IconProps) => <I {...p} d={<><path d="M12 5v14" /><path d="M5 12h14" /></>} />,
  Minus: (p: IconProps) => <I {...p} d={<path d="M5 12h14" />} />,
  X: (p: IconProps) => <I {...p} d={<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>} />,
  Trash: (p: IconProps) => <I {...p} d={<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>} />,
  Copy: (p: IconProps) => <I {...p} d={<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>} />,
  Rotate: (p: IconProps) => <I {...p} d={<><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>} />,
  Expand: (p: IconProps) => <I {...p} d={<><path d="M8 3H3v5" /><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><path d="M16 21h5v-5" /></>} />,
  Shrink: (p: IconProps) => <I {...p} d={<><path d="M3 8h5V3" /><path d="M21 8h-5V3" /><path d="M3 16h5v5" /><path d="M21 16h-5v5" /></>} />,
  Fit: (p: IconProps) => <I {...p} d={<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></>} />,
  Panel: (p: IconProps) => <I {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>} />,
  Edit: (p: IconProps) => <I {...p} d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>} />,
  Image: (p: IconProps) => <I {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>} />,
  File: (p: IconProps) => <I {...p} d={<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></>} />,
  Layers: (p: IconProps) => <I {...p} d={<><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>} />,
  Check: (p: IconProps) => <I {...p} d={<path d="M20 6 9 17l-5-5" />} />,
  Shield: (p: IconProps) => <I {...p} d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />} />,
  Move: (p: IconProps) => <I {...p} d={<><path d="M12 2v20" /><path d="M2 12h20" /><path d="m9 5 3-3 3 3" /><path d="m9 19 3 3 3-3" /><path d="m5 9-3 3 3 3" /><path d="m19 9 3 3-3 3" /></>} />,
  Share: (p: IconProps) => <I {...p} d={<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>} />,
  Clipboard: (p: IconProps) => <I {...p} d={<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>} />,
  Undo: (p: IconProps) => <I {...p} d={<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>} />,
  Redo: (p: IconProps) => <I {...p} d={<><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>} />,
  Text: (p: IconProps) => <I {...p} d={<><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></>} />,
  Eye: (p: IconProps) => <I {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>} />,
  EyeOff: (p: IconProps) => <I {...p} d={<><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a15.7 15.7 0 0 1-3 3.8" /><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.3 3.5-.8" /></>} />,
  Lock: (p: IconProps) => <I {...p} d={<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>} />,
  Unlock: (p: IconProps) => <I {...p} d={<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>} />,
  Up: (p: IconProps) => <I {...p} d={<><path d="m6 14 6-6 6 6" /><path d="M12 8v12" /></>} />,
  Down: (p: IconProps) => <I {...p} d={<><path d="m6 10 6 6 6-6" /><path d="M12 4v12" /></>} />,
  Folder: (p: IconProps) => <I {...p} d={<><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 9h18" /></>} />,
  Print: (p: IconProps) => <I {...p} d={<><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" /></>} />,
};

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); }
      if (e.key !== "Tab") return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0);
      const first = items[0]; const last = items[items.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onPointerDown={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          "animate-pop max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white text-slate-800 shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
          <h3 id={id} className="text-lg font-semibold">{title}</h3>
          <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <Icon.X />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function SealPicker({
  seals,
  activeId,
  onPick,
  onDelete,
  dark,
}: {
  seals: Seal[];
  activeId: string;
  onPick: (id: string) => void;
  onDelete?: (id: string) => void;
  dark?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {seals.map((s) => (
        <div key={s.id} className="group relative">
          <button
            onClick={() => onPick(s.id)}
            data-seal-option={s.id}
            aria-pressed={s.id === activeId}
            title={s.name}
            className={cn(
              "checker flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 p-1.5 transition",
              s.id === activeId ? "border-blue-500 ring-2 ring-blue-500/30" : dark ? "border-slate-700 hover:border-slate-500" : "border-slate-200 hover:border-slate-400"
            )}
          >
            <img src={s.src} alt={s.name} className="max-h-full max-w-full object-contain" draggable={false} />
          </button>
          {onDelete && !s.builtIn && (
            <button
              onClick={() => onDelete(s.id)}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white shadow opacity-80 hover:opacity-100"
              aria-label={`${s.name} মুছুন`}
              title="মুছুন"
            >
              <Icon.X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">{display}</span>
      </div>
      <input type="range" aria-label={label} className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}
