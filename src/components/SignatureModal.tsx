import { useEffect, useRef, useState } from "react";
import type { Seal } from "../types";
import { uid } from "../types";
import { Icon, Modal } from "./ui";
import { cn } from "../utils/cn";

const INKS = [
  { c: "#0c1c4a", n: "নীল কালি" },
  { c: "#111827", n: "কালো" },
  { c: "#b91c1c", n: "লাল" },
];
const W = 900;
const H = 360;

/** Freehand signature pad (mouse / finger / pen) → transparent PNG seal. */
export function SignatureModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (s: Seal) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const [ink, setInk] = useState(INKS[0].c);
  const [thick, setThick] = useState(5);
  const [empty, setEmpty] = useState(true);

  const clear = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.getContext("2d")!.clearRect(0, 0, W, H);
    setEmpty(true);
  };
  useEffect(() => {
    if (open) setTimeout(clear, 0);
  }, [open]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, t: performance.now() };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, thick / 2, 0, Math.PI * 2);
    ctx.fill();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const l = last.current;
    const dist = Math.hypot(p.x - l.x, p.y - l.y);
    const speed = dist / Math.max(1, p.t - l.t);
    // faster strokes get thinner, like a real pen
    const pressure = e.pressure && e.pointerType === "pen" ? 0.5 + e.pressure : 1;
    const width = Math.max(1.2, thick * pressure * (1.25 - Math.min(0.7, speed * 0.35)));
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.quadraticCurveTo(l.x, l.y, (l.x + p.x) / 2, (l.y + p.y) / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const save = () => {
    const cv = canvasRef.current!;
    const data = cv.getContext("2d")!.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (data[(y * W + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
    if (maxX < 0) return;
    const pad = 12;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W - 1, maxX + pad);
    maxY = Math.min(H - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d")!.drawImage(cv, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    onCreate({ id: uid(), name: "আমার স্বাক্ষর", src: out.toDataURL("image/png"), aspect: out.width / out.height });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="স্বাক্ষর আঁকুন" wide>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-[#fbf8f0]">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block aspect-[5/2] w-full cursor-crosshair"
            style={{ touchAction: "none" }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          <div className="pointer-events-none absolute inset-x-8 bottom-[22%] border-b border-slate-300" />
          {empty && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              আঙুল, মাউস বা পেন দিয়ে এখানে স্বাক্ষর করুন
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {INKS.map((i) => (
              <button
                key={i.c}
                title={i.n}
                onClick={() => setInk(i.c)}
                className={cn("h-8 w-8 rounded-full border-2 border-white shadow transition", ink === i.c && "scale-110 ring-2 ring-blue-500")}
                style={{ background: i.c }}
              />
            ))}
          </div>
          <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
            কলমের মোটা
            <input type="range" min={2} max={12} value={thick} onChange={(e) => setThick(+e.target.value)} className="flex-1" />
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={clear} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
            মুছে আবার
          </button>
          <button
            disabled={empty}
            onClick={save}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Icon.Check className="h-4 w-4" /> স্বাক্ষর বসান
          </button>
        </div>
      </div>
    </Modal>
  );
}
