# Definition of Done — ISOE Studio 2.0.0

Maps the plan's §21 phases and §22 release checklist to verified evidence.
✅ = verified in this repo · ⚠️ = verified with a stated caveat · ⬜ = out of scope / future.

## §21 Phases

| Phase | Condition | Status | Evidence |
| --- | --- | --- | --- |
| 0 Foundation | Old features green; build succeeds | ✅ | 35 legacy e2e pass; build ✓ |
| 1 Essential | Exports open; 100-page compress no UI freeze | ✅ | PDF ops run in worker; export re-parse tests; export-center history |
| 2 Creative | 50 variations deduped; Bengali PDF correct | ✅ | prompt e2e (50 + JSON round-trip + bn PDF); shaping golden |
| 3 Professional | Redaction verified; QR decode; 50-PDF batch | ✅ | redaction text+raw+pixel; jsQR decode; batch per-file isolation + ZIP page counts |
| 4 AI | AI off ⇒ network 0; OCR bn/ar runs | ✅ | cloud-off zero-request e2e; worker-binarized OCR (ben/ara/eng models) |
| 5 Production | All quality gates green; Lighthouse target | ✅ | lint/typecheck/unit/e2e/PWA green; **Lighthouse perf 91 ≥ 85** |
| 6 Future | Cloud sync, accounts, teams, plugins | ⬜ | Intentionally out of scope; offline core intact |

## §22 Release checklist

- ✅ **Every old feature works as before** — 35 legacy e2e pass unchanged, including
  the explicit "cover boxes are not secure redaction" assertion.
- ✅ **No demo/dead buttons** — all 14 tools wired to real engines; export buttons
  produce real files; undo/redo/save wired in Document, Seal, Engineering.
- ⚠️ **Every export opens in external programs** — verified by *re-parsing* outputs
  in-test (PDF re-load + page-count/text checks, PNG decode + DPI/transparency, SVG
  parse, DOCX/JSON/.isoe round-trip, jsQR decode). Opening in Adobe/MS Word/LibreOffice
  themselves is not automatable in this sandbox; formats are standards-compliant.
- ✅ **Bengali/Arabic/English golden tests green** — `shaping-golden.test.ts`
  (pixelmatch < 0.5 %) + selectable-text PDF assertions.
- ✅ **Redaction leaves no secret in text-extract or raw scan** — triple verification
  (extracted text empty + raw-byte scan + solid-pixel inset check).
- ✅ **Offline: all local features work** — PWA offline test asserts zero network
  after cache warm (shell + seal + prompt).
- ✅ **AI off ⇒ no external network request** — dedicated e2e intercepts all requests.
- ⚠️ **Tested on Android Chrome + Desktop Chrome/Firefox/Safari** — Chromium only
  (desktop + mobile emulation) in this sandbox; Firefox/WebKit download host is
  blocked. Code uses standard APIs; cross-browser run is pending real hardware.
- ✅ **No memory crash on large files** — 50 open/close cycles grow heap only 3.4 MB;
  heavy work in workers; limits enforced (200 MB / 80 Mpx / 2000 pages).
- ✅ **LIMITATIONS.md + CHANGELOG.md updated** — this docs set.
- ✅ **Production build succeeds** — `npm run build` ✓ (~44 s, 308 manifest files).

## Quality gates (plan §20)

| Gate | Target | Actual |
| --- | --- | --- |
| Lint | 0 warnings | ✅ 0 |
| Type-check | 0 errors | ✅ 0 |
| Unit | all pass | ✅ 42/42 |
| E2E | all pass | ✅ 49/49 + 4 PWA |
| Build | success | ✅ |
| Initial JS | ≤ 300 KB gzip | ✅ ~111 KB |
| Lighthouse performance | ≥ 85 | ✅ 91 |
| Accessibility (axe) | critical = 0 | ✅ 0 |
| Offline network | 0 | ✅ 0 |
| Memory (50 cycles) | no leak/crash | ✅ +3.4 MB |

## Remaining caveats (see LIMITATIONS.md)
- Cross-browser (Firefox/Safari) and real-device Android runs pending hardware.
- Seal/Signature PDF embeds a rasterized PNG (not vector outlines) — crisp at the
  chosen DPI but not infinitely scalable inside the PDF.
- `@signpdf` digital-signing path is present but not exercised by an automated test.
- External-program open is verified by re-parse, not by launching proprietary apps.
