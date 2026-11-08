# Changelog

## 2.0.0 — ISOE Studio

A local-first, installable (PWA), Bengali-first multi-tool workspace added at
`/#/studio`, while preserving the classic editor at `/#/` byte-for-byte in behavior.

### Added
- **14-tool workspace** with a command palette (Ctrl/Cmd+K), search, pinned tools,
  recents/downloads dashboard, onboarding, keyboard shortcuts, theme + bn/en/ar
  (RTL) switching, mobile bottom-nav + "More" drawer, install button and SW-update
  toast.
- **PDF Studio** — 26 worker operations: merge, split, rotate, resize, compress,
  encrypt/decrypt (AES-256), **true redaction**, watermark, numbers, header/footer,
  bookmarks/TOC, metadata, flatten, extract text/images, thumbnails, search,
  compare, repair, print, crop, page organizer.
- **Image Studio** — crop/resize/rotate, tone/filters, background removal, DPI-aware
  export, undo history.
- **Seal Studio** — SVG vector seals, circular `textPath`, seeded physical-ink
  realism, 300/600/1200 DPI, undo/redo + autosave.
- **Signature Studio** — typed/drawn signatures + library; separate digital tab.
- **Prompt Studio** — 50-variation generator, save, JSON round-trip, Bengali PDF.
- **Document Design** — 15 templates, mail-merge, invoice totals + taka-in-words,
  vector PDF/PNG/DOCX/JSON/.isoe, undo/redo + autosave, real QR/barcode canvas preview.
- **Text Studio** — TipTap rich text, golden bn/ar strings, font-embedded PNG,
  selectable-text PDF.
- **QR & Barcode** — jsQR-verified QR (EC level H), EAN/UPC/Code128 with check
  digits, PNG/SVG/PDF.
- **Engineering** — calibrated dimensions, units/scale, ISO-7200-style title block,
  revisions/checklist/stamps, mm-exact vector PDF, undo/redo + autosave.
- **Batch** — per-file isolated processing, aspect-correct resize, ZIP output.
- **AI Document Assistant** — local OCR (binarization moved off the main thread into
  the image worker) + local summary; cloud providers strictly opt-in.
- **Projects / Export Center / Settings** — IndexedDB autosave library, persisted
  download history, defaults, storage usage + clear, encrypted cloud-key vault,
  connection test, privacy, about.
- **Core infrastructure** — HarfBuzz shaping + font embedding for bn/ar, worker pool
  with readiness handshake, `.isoe` project format with guarded unpack + legacy
  `.sealproject` migration, autosave (2 s / 20 snapshots), command history, export
  queue, input/SVG validation, i18n, tool registry with per-tool code-splitting.
- **PWA** — web manifest (icons incl. maskable, share target), service worker with
  offline shell + lazy WASM/model cache, runtime CSP injector.
- **Tests** — 42 Vitest unit/golden tests; 49 Playwright e2e (35 legacy + 14 studio);
  4 PWA tests (offline zero-network, axe critical=0, 50-cycle memory, installability).
- **Docs & hosting** — README, TEST_REPORT, DoD, LIMITATIONS, CLOUD; `_headers` and
  `vercel.json` (non-CSP security headers).

### Performance
- Home route fetches **zero WASM**; heavy engines lazy-load per tool.
- Removed the `manualChunks` preload-helper trap; use Rollup
  `onlyExplicitManualChunks` so the entry never eagerly imports WASM.
- Moved legacy Tailwind CSS into the lazy legacy chunk; studio uses the scoped
  `iso.css` design system loaded in the entry.
- Critical webfonts preloaded + `font-display: optional` → **CLS 0**.
- Studio is a direct import (no lazy waterfall) → **LCP ~1.1 s**.
- Lighthouse (mobile, prod preview): **Performance 92, Accessibility 100, Best
  Practices 100, SEO 91**; initial-route JS **~111 KB gzip**.

### Fixed
- Service-worker registration when the deferred module entry runs after `load`.
- Worker numbering/header-footer no longer re-parses the source per page.
- PDF save strips OpenAction / AA / Names.JavaScript / XFA.
- Bengali/Arabic shaping normalization scoped to shaping paths only.
- Redaction interior color set via raw dict (`IC`) + solid-pixel verification.

### Preserved
- The classic editor (`src/App.tsx`, `src/components`, `src/lib`) and all 35 legacy
  e2e tests continue to pass unchanged in behavior.
