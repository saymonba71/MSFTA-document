# Optional Cloud AI — setup, privacy & the CSP trade-off

ISOE Studio is **local-first**. OCR, summarization, table and invoice extraction run
entirely on your device. Cloud AI is an **optional, off-by-default** enhancement for
tasks you choose to send to a provider.

## Privacy model (defense in depth)

A cloud call only happens when **all** of these are true:

1. **Enabled** — the cloud toggle in Settings is on (`enabled: true`).
2. **Consent** — you confirm each call (a preview of the outgoing text is shown).
3. **Key** — a per-session API key is present (held in memory; **Ollama excepted**).
4. **Origin allowlist** — the provider origin is in `ai-allowed-origins` (IndexedDB)
   **and** permitted by the runtime CSP (Ollama excepted).
5. **Redaction** — when `redact: true` (default), sensitive patterns are masked before
   the text leaves the device.

If any gate fails, the call throws and **no network request is made**. The e2e suite
asserts that with cloud off there are zero external requests.

### Key storage
- The active key lives in memory for the session only.
- Optionally it can be saved to an **encrypted vault** (AES-GCM, key derived via
  PBKDF2 ≈ 210 k iterations). The passphrase is never stored.
- Provider error bodies are scrubbed of `sk-…` key patterns before display.

## Providers

| Provider | Default base URL | Default model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-3-5-haiku-latest` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | `gemini-1.5-flash` |
| Ollama (local) | `http://localhost:11434` | `llama3.2` |
| Custom | *(your URL)* | *(your model)* |

Use **Test connection** in Settings to verify reachability (sends a minimal "ping").
Anthropic uses the direct-browser-access header; Gemini uses the key query param;
Ollama needs no key and is treated as local.

## Enabling a provider (step by step)

1. Settings → **AI Cloud** → choose provider, set base URL + model.
2. Add the provider **origin** to the allowlist. This mirrors into
   `localStorage["isoe-csp-origins"]`.
3. **Reload the page.** The runtime CSP is built once at load, so a newly allowed
   origin takes effect after reload.
4. Enter your API key (session or vault), turn on the cloud toggle.
5. Use an AI action; confirm the consent preview. With `redact` on, sensitive data is
   masked first.

## The CSP trade-off (why it's a runtime `<meta>`, not a header)

A static server `Content-Security-Policy` header **intersects** with any meta-CSP —
the browser enforces the *most restrictive* combination. If we shipped a fixed header
CSP, a user could never add their own cloud origin without a redeploy, and the header
would block it even after they allowed it in Settings.

So CSP is delivered at **runtime** by `public/csp.js`, the first script in `<head>`.
It builds a `<meta http-equiv="Content-Security-Policy">` from a safe default plus the
user's `isoe-csp-origins` allowlist. Hosting headers (`public/_headers`, `vercel.json`)
deliberately **omit CSP** and only set the other security headers (nosniff,
referrer-policy, frame-options, permissions-policy).

**Trade-off:** a runtime meta-CSP applies after that first inline script runs, so it is
marginally weaker than a server-delivered header for the very first bytes. We accept
this to keep the app deployable as static files *and* let users opt in to their own
cloud origin without a rebuild. If you deploy in a locked-down environment and never
use cloud AI, you can add a strict CSP header at your host and remove `csp.js`.

### Ollama / localhost note
Browsers block mixed content (HTTPS page → `http://localhost`). For Ollama, run the
studio over `http://localhost` in development, or front Ollama with HTTPS. Ollama is
exempt from the key and origin-allowlist gates because it is local.

## What never leaves the device
- Your files (PDFs, images, seals, signatures, projects) — always processed locally.
- OCR text and local summaries — computed on-device.
- Only the **text you explicitly submit** to a cloud action, after consent and optional
  redaction, is sent to the provider you configured.
