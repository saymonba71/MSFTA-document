# Test Report — ISOE Studio 2.0.0

All gates run on branch `arena/1c3a382f-msfta-document`, Node v22, npm 10.
Browser automation uses Chromium (`@sparticuz/chromium`); Firefox/WebKit binaries
are unavailable in this sandbox (download host blocked) — see LIMITATIONS.

## Gate summary

| Gate | Command | Result |
| --- | --- | --- |
| Type-check | `npm run typecheck` | ✅ 0 errors (strict, ES2022) |
| Lint | `npm run lint` | ✅ 0 warnings (`--max-warnings 0`) |
| Unit + golden | `npm run test` | ✅ **42 / 42** (6 files) |
| E2E (legacy + studio) | `npm run test:e2e` | ✅ **49 / 49** (35 legacy + 14 studio) |
| PWA | `npm run test:pwa` | ✅ **4 / 4** |
| Build | `npm run build` | ✅ ~44 s, 308 manifest files |
| Lighthouse (mobile) | see below | ✅ **Perf 91 · A11y 100 · BP 100 · SEO 91** |
| Initial-route JS | entry + static deps | ✅ **~111 KB gzip** (budget ≤ 300 KB) |

## Lighthouse (production preview, `/#/studio`)

Lighthouse 13.6.0, mobile emulation, headless Chromium.

| Metric | Value |
| --- | --- |
| Performance | **91** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **91** |
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 1.1 s |
| Total Blocking Time | 380 ms |
| Cumulative Layout Shift | **0** |
| Speed Index | 1.2 s |

Machine-readable summary: `artifacts/lighthouse-summary.json`.

> Lighthouse 12+ removed the PWA category and its installability audits
> (`installable-manifest`, `service-worker`, `maskable-icon`). PWA installability is
> therefore verified by the dedicated Playwright PWA suite below, not a Lighthouse
> score.

### How performance was achieved
1. **Zero WASM on home.** Removed a `manualChunks` configuration that trapped Vite's
   preload helper inside the `mupdf` chunk (and a CJS helper inside `shaping`),
   which made the entry statically import both and eagerly run WASM on the home
   route (LCP was 56.6 s, perf 31). Now `onlyExplicitManualChunks: true`; the home
   route fetches no `.wasm`, `mupdf`, or `harfbuzz` assets (verified by request
   interception).
2. **No legacy CSS on studio.** Moved the 1142-line Tailwind `index.css` +
   `ui-refresh.css` into the lazy legacy `App` chunk; the studio uses the scoped
   `iso.css` design system.
3. **Zero layout shift.** Critical webfonts (Inter, Noto Sans Bengali, Noto Naskh
   Arabic) are preloaded and use `font-display: optional` (a Vite plugin rewrites
   the fontsource faces). CLS went 0.434 → 0.
4. **No lazy waterfall.** Studio is a direct import in the entry (heavy tools stay
   code-split behind the registry). LCP went 3.6 s → 1.1 s.

## Unit + golden tests (42)

`tests/unit/`: `document`, `engine`, `engineering`, `qr`, `security-project`,
`shaping-golden`. Representative proven assertions:

- EAN-13 `400638133393` → check digit 1; UPC-A `03600029145` → 2.
- EMVCo QR CRC tail `6304`; invoice totals (1250, 5 %, 50) = 1260.
- `moneyWords(1050)` = "এক হাজার পঞ্চাশ"; 15 template kinds; ID card 85.6 × 54 mm.
- 1 in = 25.4 mm; `dimLabel` 300 px @ 3 px/mm = "100.00 mm".
- `.isoe` history capped at 20; unpack rejects foreign zip / traversal / oversize;
  manifest v1 → v2 migration; `safeName("CON")` = "_CON".
- Limits: 200 MB file / 80 Mpx / 2000 pages.
- **Golden shaping** (`shaping-golden.test.ts`): HarfBuzz → mupdf → PNG for bn/ar/
  mixed, compared with pixelmatch < 0.5 % pixel diff. Refresh with `UPDATE_GOLDEN=1`.

## E2E — legacy (35) + studio (14)

Legacy suites (`workspace`, `studio`, `enhancements`) run unchanged and pass,
including: real PDF page merge/reorder/rotate/split, scannable QR encoding the exact
URL, the explicit "cover boxes are **not** secure redaction" assertion, rotated-page
PDF ink matching, and mobile overflow checks.

Studio suite (`tests/e2e/studio.spec.ts`, 14) covers: shell/palette/RTL/theme/mobile
nav; prompt 50-variation + JSON round-trip + Bengali PDF; seal watermark + DPI +
transparency; signature library; jsQR-verified QR + EAN check-digit error; PDF
merge/encrypt/wrong-password/**true redaction**; document invoice totals + taka
words + vector PDF + autosave; engineering 100 mm-exact PDF + no `__tab` leak; text
font-embedded PNG + selectable PDF; batch per-file isolation + ZIP page counts; AI
local summary + **cloud-off ⇒ zero external requests**; settings clear-data +
storage; export-center persisted history.

## PWA suite (4) — `tests/e2e/pwa.spec.ts`

Run against a production preview (`playwright.pwa.config.ts`, port 4173):

1. **Offline:** after cache warm, shell + seal + prompt work with **zero network**
   requests (route interception asserts no network hits).
2. **Accessibility:** axe-core **critical violations = 0** on home, settings, seal.
3. **Memory:** 50 open/close hash-navigation cycles; heap growth **3.4 MB** (within
   budget; precise-memory flag enabled, same realm).
4. **Installability:** manifest + 192/512/maskable icons + share target present and
   well-formed; service worker registers and controls the page.

## Reproducing

```bash
npm ci
npm run lint && npm run typecheck && npm run test
npm run build
npm run test:e2e      # dev server auto-started by Playwright
npm run test:pwa      # production preview auto-started by Playwright
```

In this sandbox, browser runs need:
`export LD_LIBRARY_PATH=/tmp/isoe-browser-libs/lib` and Chromium at `/tmp/chromium`
(`CHROME_PATH` / `CHROMIUM_PATH`). Lighthouse:

```bash
npx lighthouse "http://localhost:4173/#/studio" \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless --no-sandbox --disable-gpu" \
  --output=json --output-path=artifacts/lighthouse.json --quiet
```
