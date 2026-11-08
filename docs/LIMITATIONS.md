# Known Limitations — ISOE Studio 2.0.0

Honest, current limitations. None block the core local-first workflows; each is
either a deliberate trade-off or pending real-hardware verification.

## Browser & device coverage
- **Automated tests run on Chromium only** (desktop + mobile emulation). Firefox and
  WebKit binaries could not be downloaded in the build sandbox (the CDN host is
  blocked). The app uses standard web APIs (Canvas, OffscreenCanvas, Web Workers,
  IndexedDB, Service Worker, WebAssembly) and is expected to work in current
  Firefox/Safari, but a real cross-browser + Android-device pass is still pending.
- **`performance.memory`** is Chromium-only; the memory regression test is therefore
  Chromium-specific.

## PDF / export
- **Seal & Signature PDF** embed a rasterized PNG at the selected DPI (300/600/1200),
  not vector glyph outlines. Output is crisp at that DPI but not infinitely scalable
  *inside the PDF*. SVG and PNG exports remain fully vector / transparent respectively.
- **Digital signatures** (`@signpdf` + P-12) are implemented in the Signature Studio
  "digital" tab but are **not covered by an automated test** and require a valid
  certificate; treat as experimental. The tab is deliberately separated from
  typed/drawn signatures with a warning.
- **Bengali/Arabic in PDF** is rendered as shaped glyph outlines (HarfBuzz) with a
  hidden text layer for copy/search, because pdf-lib's `drawText` ToUnicode mapping is
  unreliable for these scripts. Visually correct and copyable; the hidden layer is a
  best-effort Unicode approximation.
- **External-program opening** (Adobe Acrobat, MS Word, LibreOffice, image viewers) is
  verified by *re-parsing* the exported bytes in tests, not by launching those
  proprietary apps. Formats are standards-compliant (PDF, PNG, SVG, DOCX, JSON, ZIP).
- A few `pdf.worker` operations still re-load a saved document internally
  (`PDFDocument.load(save(doc))`); correctness is verified, but very large files pay a
  small extra serialization cost on those specific ops.

## OCR & AI
- **OCR accuracy** depends on scan quality; handwritten Bengali/Arabic is unreliable.
  Binarization now runs in the image worker (off the main thread), but Tesseract itself
  is CPU-heavy and bounded to the first 20 pages of a PDF per run.
- **Cloud AI is opt-in and off by default.** It requires explicit per-call consent, a
  per-session API key (Ollama excepted), and an origin allowlist. See `CLOUD.md` for the
  CSP trade-off and provider notes. No cloud call happens unless all gates pass.
- **Local summarizer/table/invoice extraction** is heuristic (regex + layout), not a
  language model; complex layouts may need manual correction.

## Security / CSP
- **CSP is injected at runtime** via `public/csp.js` (a `<meta>` tag built from
  localStorage) rather than sent as an HTTP header. This is what lets a user add a
  cloud-AI origin without a rebuild, but a runtime meta-CSP is marginally weaker than a
  server header (it applies after the first inline script). Hosting headers
  (`_headers`, `vercel.json`) intentionally **omit CSP** so they don't intersect and
  block the user-allowed origin. See `CLOUD.md`.
- **Redaction** is verified three ways (text-extract, raw-byte scan, solid-pixel inset)
  for the supported PDF path. The legacy editor's "cover box" is explicitly **not**
  secure redaction and is labelled as such in the UI.

## Storage & size
- **IndexedDB quota** is browser-managed; the app requests persistent storage and shows
  usage, but eviction is still possible under extreme disk pressure. Trash is purged
  after 30 days.
- **Limits:** 200 MB per file, 80 megapixels per image, 2000 pages per PDF, plus ZIP
  entry-count and uncompressed-size (zip-bomb) guards. Inputs beyond these are rejected
  with a message rather than risking a tab crash.
- **OCR models (~26 MB) and background-removal assets (~72 MB)** are git-ignored and
  copied from npm packages by `npm run assets`; they are cached lazily by the service
  worker on first use, so the very first OCR / background-removal use needs network.

## Build warnings (non-fatal)
- Rollup reports `node:fs`/`node:module` externalized for `mupdf`/`harfbuzzjs` (browser
  builds never call them) and an `eval` note in ONNX runtime; a few lazy chunks exceed
  the 1600 KB warning threshold. These do not affect the initial route (zero WASM on
  home) or correctness.
