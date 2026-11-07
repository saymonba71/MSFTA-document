/**
 * Embed same-origin @font-face rules as data: URLs so SVG rasterization
 * (<img src=svg>) and foreignObject PNG exports render bundled Bengali/Arabic
 * fonts instead of falling back to system fonts. Browser-only.
 */
const cache = new Map<string, string>();

function familiesOf(family: string): string[] {
  return family.split(",").map((f) => f.trim().replace(/^['"]|['"]$/g, "")).filter((f) => f && !/^(sans-serif|serif|monospace|system-ui|cursive)$/i.test(f));
}

async function dataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = reject; fr.readAsDataURL(blob); });
}

/** Collect @font-face CSS (with inlined data URLs) for the given font families from loaded stylesheets. */
export async function fontFaceCss(families: string[]): Promise<string> {
  const wanted = new Set(families.flatMap(familiesOf).map((f) => f.toLowerCase()));
  const key = [...wanted].sort().join("|");
  const hit = cache.get(key); if (hit) return hit;
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let css: CSSRuleList; try { css = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(css)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const fam = rule.style.getPropertyValue("font-family").replace(/^['"]|['"]$/g, "").toLowerCase();
      if (!wanted.has(fam)) continue;
      const src = rule.style.getPropertyValue("src");
      const urls = [...src.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]);
      if (!urls.length) continue;
      let out = src;
      for (const u of urls) {
        if (u.startsWith("data:")) continue;
        const abs = new URL(u, sheet.href ?? location.href).href;
        out = out.replace(u, await dataUrl(abs));
      }
      const weight = rule.style.getPropertyValue("font-weight") || "400";
      const style = rule.style.getPropertyValue("font-style") || "normal";
      const range = rule.style.getPropertyValue("unicode-range");
      rules.push(`@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};src:${out};${range ? `unicode-range:${range};` : ""}}`);
    }
  }
  const css = rules.join("\n");
  cache.set(key, css);
  return css;
}

/** Inject embedded @font-face styles into an SVG string (for <img> rasterization / export). */
export async function embedSvgFonts(svg: string): Promise<string> {
  const fams = [...svg.matchAll(/font-family=(["'])([^"']+)\1/g)].map((m) => m[2]);
  const css = await fontFaceCss(fams.length ? fams : ["Inter", "Noto Sans Bengali", "Noto Naskh Arabic"]);
  if (!css) return svg;
  const style = `<style type="text/css"><![CDATA[\n${css}\n]]></style>`;
  return svg.includes("<defs>") ? svg.replace("<defs>", `<defs>${style}`) : svg.replace(/(<svg[^>]*>)/, `$1${style}`);
}
