// Post-build: list hashed assets for the service worker precache (skip huge model dirs; they cache on first use).
import { readdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
const dist = path.join(process.cwd(), "dist");
const out = [];
function walk(dir, rel = "") {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name), r = rel + "/" + name;
    const st = statSync(p);
    if (st.isDirectory()) { if (["ocr", "bg-assets", "images"].includes(name)) continue; walk(p, r); }
    else if (st.size < 8 * 1024 * 1024 && /\.(js|mjs|css|woff2?|ttf|svg|png|json|webmanifest)$/.test(name)) out.push(r);
  }
}
walk(dist);
writeFileSync(path.join(dist, "asset-manifest.json"), JSON.stringify(out));
console.log(`asset-manifest.json: ${out.length} files`);
