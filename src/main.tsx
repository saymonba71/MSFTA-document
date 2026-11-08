import { StrictMode, lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
// Studio design system + fonts load in the entry (render-blocking) so webfonts are
// requested before first paint — avoids the font-swap layout shift (CLS). These are
// scoped to .iso-shell and lightweight; the heavy legacy Tailwind CSS stays in App.
import "./ui/iso.css";
import "./ui/fonts.css";
import { Buffer } from "buffer";
import { registerSW } from "./core/pwa";
import Studio from "./ui/Studio";
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
// Studio is the primary shell → direct import (no lazy waterfall). Its heavy tools
// stay code-split behind the registry's dynamic imports. Legacy editor stays lazy.
const Legacy = lazy(() => import("./App"));
function Root() {
  const [studio, setStudio] = useState(() => location.hash.startsWith("#/studio"));
  useEffect(() => { const fn = () => setStudio(location.hash.startsWith("#/studio")); window.addEventListener("hashchange", fn); return () => window.removeEventListener("hashchange", fn); }, []);
  const fallback = <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading…</div>;
  return studio ? <Studio /> : <Suspense fallback={fallback}><Legacy /></Suspense>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
registerSW();
