import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Webfonts: use font-display:optional (no swap → no layout shift) and preload the
// critical above-the-fold faces so they win the race and render on first paint.
function fontPerf(): Plugin {
  const critical = ["inter-latin-400", "inter-latin-700", "noto-sans-bengali-bengali-400", "noto-naskh-arabic-arabic-400"];
  return {
    name: "isoe-font-perf",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("@fontsource") && id.endsWith(".css")) return { code: code.replace(/font-display:\s*swap/g, "font-display:optional"), map: null };
      return null;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const links: string[] = [];
        for (const file of Object.keys(ctx.bundle)) {
          if (file.endsWith(".woff2") && critical.some((c) => file.includes(c))) links.push(`<link rel="preload" as="font" type="font/woff2" crossorigin href="/${file}">`);
        }
        return html.replace("</head>", links.join("\n    ") + "\n  </head>");
      },
    },
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Studio v2: code-split build (legacy single-file bundle replaced; see docs/LIMITATIONS.md).
export default defineConfig({
  plugins: [fontPerf(), react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), buffer: "buffer/" } },
  define: { "process.env": {}, global: "globalThis", __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "2.0.0") },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["mupdf", "harfbuzzjs"] },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1600,
    // Let Rollup auto-split on dynamic-import boundaries. A manualChunks function
    // trapped Vite's preload helper inside the mupdf chunk, forcing the home route
    // to eagerly load mupdf+harfbuzz WASM (56s LCP). Heavy libs stay behind lazy imports.
    rollupOptions: { output: { onlyExplicitManualChunks: true } },
  },
  server: { host: "0.0.0.0", port: 5173, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 4173, allowedHosts: true },
});
