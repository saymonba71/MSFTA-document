# ISOE Studio — Image Seal Overlay Editor

**Local-first document, image, PDF, seal & design suite.** Everything runs in your
browser — files never leave your device unless you explicitly opt in to a cloud AI
provider. Bengali-first, with English and Arabic (RTL) UI.

> বাংলা · English · العربية — ফাইল আপনার ডিভাইসেই থাকে · অফলাইন-সক্ষম · ইনস্টলযোগ্য (PWA)

The classic single-file editor is preserved at `/#/` (legacy). The new multi-tool
workspace lives at **`/#/studio`**.

---

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173  (opens the legacy editor; add #/studio)
```

Production build + local preview:

```bash
npm run build      # tsc --noEmit && vite build && write asset-manifest.json
npm run preview    # serves dist/ on http://localhost:4173
```

`predev`/`prebuild` run `npm run assets`, which copies the OCR models and
background-removal assets into `public/` on first run (early-exits afterwards; set
`FORCE_ASSETS=1` to re-copy). These large model dirs are **git-ignored** and are
reproduced from npm packages, so the repo stays small.

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Vite dev server (0.0.0.0:5173) |
| `build` | Type-check, production build, write SW asset manifest |
| `preview` | Serve `dist/` (0.0.0.0:4173) |
| `lint` | ESLint, `--max-warnings 0` |
| `typecheck` | `tsc --noEmit` (strict, ES2022) |
| `test` / `test:unit` | Vitest unit + golden tests |
| `test:e2e` | Playwright: legacy (35) + studio (14) against the dev server |
| `test:pwa` | Playwright PWA suite (offline, a11y, memory, installability) against a prod preview |
| `test:baseline` | Legacy-only baseline suite |
| `assets` | Copy OCR + background-removal models into `public/` |

## The 14 tools

| Tool | Highlights |
| --- | --- |
| **PDF Studio** | Merge, split, rotate, compress, encrypt/decrypt (AES-256), **true redaction** (text + raw-byte + pixel verified), watermark, page numbers, header/footer, bookmarks, metadata, repair, compare |
| **Image Studio** | Crop/resize/rotate, tone & filters, background removal, format/DPI export, undo history |
| **Seal Studio** | SVG vector seals, circular `textPath`, 2–5 rings, seeded ink realism, 300/600/1200 DPI, undo/redo + autosave |
| **Signature Studio** | Typed & drawn signatures, library; digital-signing tab kept separate with a warning |
| **Prompt Studio** | 50-variation generator, save, JSON round-trip, Bengali-capable PDF |
| **Document Design** | 15 templates (invoice, certificate, ID card…), mail-merge fields, invoice totals + taka-in-words, vector PDF/PNG/DOCX, undo/redo + autosave |
| **Text Studio** | Rich text (TipTap), golden Bengali/Arabic strings, font-embedded PNG, selectable-text PDF |
| **QR & Barcode** | jsQR-verified QR (EC level H), EAN/UPC/Code128 barcodes with check digits, PNG/SVG/PDF |
| **Engineering** | Calibrated dimensions, units & scale, ISO-7200-style title block, revisions, mm-exact vector PDF, undo/redo + autosave |
| **Batch Processing** | Per-file isolated stamping/resize (aspect-correct), ZIP with page counts preserved |
| **AI Document Assistant** | Local OCR (worker-binarized) + summary; cloud providers strictly opt-in |
| **Projects** | Autosave library (IndexedDB), filter, open → routes into the tool |
| **Export Center** | Persisted download history, re-download |
| **Settings** | Theme/language, defaults, storage usage + clear, cloud AI vault, privacy, about |

## Architecture

```
src/
  main.tsx            Entry: routes #/studio (direct) vs #/ (lazy legacy), registers SW
  core/
    fonts/            HarfBuzz shaping + pdf-lib/mupdf font embedding (bn/ar outlines)
    workers/          pdf.worker (26 ops), image.worker, WorkerPool (ready handshake)
    export/           DPI metadata, export queue + history
    project/          .isoe format (zip, guarded unpack), autosave, share-target inbox
    commands/         CommandHistory + useUndoable
    security/         Input validation, SVG sanitize, sensitive-data detection
    storage/          IndexedDB (idb) v2: projects/prompts/exports/settings/signatures
    settings.ts       User defaults (localStorage)
    pwa.ts            Install prompt + SW registration/update events
    i18n/             bn/en/ar resources
    registry/         Tool registry (dynamic imports → code-split per tool)
  modules/            14 tool modules (lazy-loaded)
  ui/                 Studio shell, Settings, primitives, iso.css design system, fonts.css
public/
  csp.js              Runtime CSP <meta> injector (relaxable for cloud AI)
  sw.js               Offline shell + lazy WASM/model cache
  manifest.webmanifest, icons/, fonts/ (+OFL), ocr/, bg-assets/
```

**Performance:** the home route loads **zero WASM**. Heavy engines (mupdf,
HarfBuzz, background removal, OCR) are code-split behind the registry's dynamic
imports and only fetched when a tool needs them. Critical webfonts are preloaded
with `font-display: optional` (no layout shift). See `docs/TEST_REPORT.md`.

**Offline:** after the first visit the service worker caches the shell and lazily
caches WASM/models as tools are used. The PWA suite verifies zero-network operation.

## Privacy & security

- **Local-first:** no file is uploaded. Cloud AI is off by default and requires
  explicit consent + a per-session key (Ollama excepted) + an origin allowlist.
- **True redaction** removes content (not just a black box) and is verified three
  ways. The legacy "cover box" is explicitly labelled *not* secure redaction.
- **CSP** is injected at runtime (`public/csp.js`) so a user-allowed cloud origin
  can be added without a rebuild. See `docs/CLOUD.md` for the trade-off.
- ZIP unpack is guarded against path traversal, entry-count and zip-bomb limits.

## Testing

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e     # 49 tests (needs Chromium; see docs/TEST_REPORT.md)
npm run test:pwa     # 4 tests against a production preview
```

Full results and the Definition of Done: **`docs/TEST_REPORT.md`**, **`docs/DoD.md`**.
Known limitations: **`docs/LIMITATIONS.md`**. Cloud setup: **`docs/CLOUD.md`**.

## License

App code: repository license. Bundled fonts are SIL Open Font License (OFL); the
license texts ship in `public/fonts/`. Third-party engines retain their own licenses.
