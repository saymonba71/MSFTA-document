# Phase 0 Audit — Image Seal Overlay Editor

Audit date: 2026-11-07 (Asia/Riyadh). Branch: `arena/1c3a382f-msfta-document`.

## Existing stack
- React 19.2.6 + TypeScript 5.9.3 + Vite 7.3.2, Tailwind CSS 4.1.17.
- PDF: `pdfjs-dist` 5.5.207 (inline worker), `pdf-lib` 1.17.1.
- ZIP: `jszip`; QR: `qrcode` + `jsqr`; fonts: Fontsource Anton/Hind Siliguri/Noto Serif Bengali.
- Tests: Playwright 1.64.1. Build: `npm run build` (vite-plugin-singlefile). No lint/typecheck/unit scripts existed.
- PWA: manifest + `public/sw.js`; referenced PNG icons were missing from the extracted archive.

## Folder structure (before expansion)
`src/components` (17 legacy UI modules), `src/lib` (15 legacy logic modules), `src/utils`, `public/images`, `tests` (3 Playwright specs).

## Existing feature inventory
1. Landing/dashboard: file intake (PNG/JPG/WEBP/PDF), drag-drop, sample documents (certificate/blueprint/invoice/NOC), seal library, custom seal upload, seal customization, saved layouts, project import, install/help.
2. Editor: multi-page view, zoom/fit/pinch, seal drag/resize/rotate/lock/hide/reorder, undo/redo, ink opacity/brightness/contrast/blend presets, comparison, grid, fullscreen, validation, quick PNG.
3. Seal tools: SVG seal generator (circle/square/rect, emblems, rings, Bengali text), transparent PNG export, image processing/threshold, recolor.
4. PDF text: text-layer detection, replacement patches, font/size/color/alignment, validation, revert; explicit warning that cover boxes are not secure redaction.
5. PDF organizer: merge, page thumbnails, select/reorder/rotate/delete, split selected pages to ZIP, append, undo.
6. Image→PDF: reorder, A4/original aspect layouts.
7. Page numbers: configurable format/position/start, replaces previous numbers.
8. Engineering: approval/dimension/markup/verification stamps, QR generation, blueprint template, grid.
9. Signature: freehand pointer pad, ink/thickness, transparent PNG seal.
10. Save/export: PNG/JPG/PDF/flat PDF/original/ZIP batch, editable `.sealproject` JSON, safe filenames, embedded-iframe download handling, Save As picker.
11. Batch: pattern apply to multiple files, duplicate-name preservation.
12. Layout library: save/delete localStorage layouts.

## Baseline quality gate (before new feature code)
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS (single-file HTML 4,317 kB; gzip 2,092 kB — exceeds the new 300 kB initial-JS budget; addressed by code-splitting/lazy assets in the expansion).
- Playwright regression: **35/35 PASS** (Chromium, desktop + mobile emulation), 1.8 min. Covers all legacy feature groups above.
- Browser environment note: sandbox had no system browser; tests used `@sparticuz/chromium` with its bundled NSS libs. Two initial runs failed to launch the browser (missing `libnspr4.so`); after extracting the bundled libs all 35 passed. This was an environment issue, not an app regression.
- Lint/unit gates: introduced in this expansion (did not exist before).

## Preservation strategy
Legacy `src/components/*` and `src/lib/*` remain functional and are still the default `/` workflow covered by the original 35 tests. New code lives in `src/core/*`, `src/modules/*`, `src/ui/*`; the Studio shell is lazy-loaded from a new launcher and reachable at `/?studio=1`. Minimal integration edits only.
