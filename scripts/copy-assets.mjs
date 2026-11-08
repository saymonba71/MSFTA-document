// Copies local-only model/OCR assets into public/ so the app never fetches them from a CDN.
import { cpSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
const pub = path.join(process.cwd(), "public");
if (!process.env.FORCE_ASSETS && existsSync(path.join(pub, "ocr", "worker.min.js")) && existsSync(path.join(pub, "bg-assets", "resources.json"))) { console.log("Assets already present (FORCE_ASSETS=1 to refresh)"); process.exit(0); }
const tess = path.join(pub, "ocr"); rmSync(tess, { recursive: true, force: true }); mkdirSync(path.join(tess, "lang"), { recursive: true });
cpSync("node_modules/tesseract.js/dist/worker.min.js", path.join(tess, "worker.min.js"));
for (const f of readdirSync("node_modules/tesseract.js-core")) if (/^tesseract-core(-relaxedsimd|-simd)?-lstm\.(wasm\.js|wasm)$/.test(f)) cpSync(path.join("node_modules/tesseract.js-core", f), path.join(tess, f));
for (const lang of ["ben", "eng", "ara"]) { const dir = path.join("node_modules/@tesseract.js-data", lang); if (!existsSync(dir)) continue; const sub = readdirSync(dir).find((d) => /best_int/.test(d)) ?? readdirSync(dir)[0]; const files = readdirSync(path.join(dir, sub)); const gz = files.find((f) => f.endsWith(".traineddata.gz")) ?? files[0]; cpSync(path.join(dir, sub, gz), path.join(tess, "lang", `${lang}.traineddata.gz`)); }
const bg = path.join(pub, "bg-assets"); rmSync(bg, { recursive: true, force: true }); mkdirSync(bg, { recursive: true });
const dataDist = "node_modules/@imgly/background-removal-data/dist";
const resources = JSON.parse(readFileSync(path.join(dataDist, "resources.json"), "utf8"));
const keep = ["/models/small", "/onnxruntime-web/ort-wasm-simd-threaded.wasm", "/onnxruntime-web/ort-wasm-simd.wasm", "/onnxruntime-web/ort-wasm.wasm"];
const out = {}; const hashes = new Set();
for (const k of keep) { const e = resources[k]; if (!e) continue; out[k] = e; for (const c of e.chunks) hashes.add(c.hash); }
for (const h of hashes) cpSync(path.join(dataDist, h), path.join(bg, h));
writeFileSync(path.join(bg, "resources.json"), JSON.stringify(out));
console.log(`Assets copied: public/ocr, public/bg-assets (${hashes.size} chunks, small model)`);
