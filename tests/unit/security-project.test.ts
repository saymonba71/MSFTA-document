import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { detectKind, safeName, findSensitive, maskSensitive, escapeHtml, LIMITS } from "../../src/core/security/validate";
import { packIsoe, unpackIsoe, packProject, unpackProject, SCHEMA_VERSION } from "../../src/core/project/format";
import { CommandHistory, diff } from "../../src/core/commands/history";
import { summarize, extractInvoice, grammar, diffLines, clusterTable, toCsv } from "../../src/modules/ai-assistant/local";

describe("security", () => {
  it("magic bytes beat extension", () => {
    expect(detectKind(new TextEncoder().encode("%PDF-1.7"), "x.png")).toBe("pdf");
    expect(detectKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), "x")).toBe("png");
    expect(detectKind(new Uint8Array([0xff, 0xd8, 0xff]), "x")).toBe("jpeg");
    expect(detectKind(new TextEncoder().encode("hello"), "x.pdf")).toBe("text");
    expect(detectKind(new TextEncoder().encode('{"a":1}'))).toBe("json");
    expect(detectKind(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("svg");
    expect(detectKind(new Uint8Array([0, 1, 2, 3]))).toBe("unknown");
  });
  it("safe filenames", () => {
    expect(safeName("../../etc/passwd")).not.toContain("/");
    expect(safeName("CON")).toBe("_CON");
    expect(safeName("a\u0000b")).toBe("a_b");
    expect(safeName("...")).toBe("document");
    expect(safeName("নমুনা.pdf")).toBe("নমুনা.pdf");
  });
  it("sensitive detection + masking", () => {
    const t = "call 01712345678 or a@b.com NID 1234567890 card 4111 1111 1111 1111";
    const ids = findSensitive(t).map((x) => x.id);
    expect(ids).toContain("phone"); expect(ids).toContain("email"); expect(ids).toContain("nid");
    const m = maskSensitive(t);
    expect(m).not.toContain("01712345678"); expect(m).not.toContain("a@b.com");
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
  it("limits are sane", () => {
    expect(LIMITS.fileBytes).toBe(200 * 1024 * 1024);
    expect(LIMITS.pixels).toBe(80_000_000);
    expect(LIMITS.pages).toBe(2000);
  });
});

describe(".isoe project format", () => {
  it("round-trips data, assets, history (≤20)", async () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ at: i, data: { i } }));
    const bytes = await packIsoe({ name: "T", module: "document-studio", data: { hello: "বাংলা" }, assets: new Map([["a.png", new Uint8Array([1, 2, 3])]]), history });
    const p = unpackIsoe(bytes);
    expect(p.name).toBe("T"); expect(p.module).toBe("document-studio");
    expect(p.data).toEqual({ hello: "বাংলা" });
    expect(p.assets.get("a.png")).toEqual(new Uint8Array([1, 2, 3]));
    expect(p.history).toHaveLength(20);
  });
  it("rejects foreign zip, traversal, oversize", () => {
    expect(() => unpackIsoe(zipSync({ "readme.txt": strToU8("hi") }))).toThrow();
    expect(() => unpackProject(zipSync({ "../evil": strToU8("x"), "manifest.json": strToU8("{}"), "project.json": strToU8("{}") }))).toThrow();
    expect(() => unpackIsoe(new Uint8Array(LIMITS.fileBytes + 1))).toThrow();
  });
  it("manifest migration v1 → current", async () => {
    const zip = zipSync({ "manifest.json": strToU8(JSON.stringify({ schemaVersion: 1, appVersion: "1", createdAt: "", modules: ["legacy"] })), "project.json": strToU8(JSON.stringify({ project: { a: 1 } })) });
    const p = unpackProject(zip);
    expect(p.manifest.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.project).toEqual({ a: 1 });
  });
  it("packProject dedupes assets by hash", async () => {
    const blob = await packProject({ x: 1 }, ["m"], [{ name: "a", bytes: new Uint8Array([9]) }, { name: "b", bytes: new Uint8Array([9]) }]);
    const p = unpackProject(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(p.assets)).toHaveLength(1);
  });
});

describe("command history", () => {
  it("undo/redo with deltas and 100 limit", () => {
    const h = new CommandHistory({ n: 0, arr: [1, 2] });
    for (let i = 1; i <= 120; i++) h.push({ n: i, arr: [1, 2] });
    expect(h.canUndo).toBe(true);
    let s = h.state; for (let i = 0; i < 100; i++) s = h.undo();
    expect(s.n).toBe(20);
    expect(h.canUndo).toBe(false);
    expect(h.redo().n).toBe(21);
    expect(diff({ a: 1 }, { a: 2 })).toEqual([{ path: ["a"], before: 1, after: 2 }]);
  });
});

describe("local AI helpers", () => {
  it("summarize returns ≤ count sentences in order", () => {
    const text = "Dhaka is the capital. Cairo is in Egypt. The river Padma flows far. Cities grow quickly. Markets open early.";
    const s = summarize(text, 2);
    expect(s).toHaveLength(2);
    expect(text.indexOf(s[0])).toBeLessThan(text.indexOf(s[1]));
  });
  it("invoice extraction: total must not match subtotal; bn digits", () => {
    const r = extractInvoice("Invoice No: INV-9\nDate: 2026-01-02\nSubtotal: 1,000.00\nTax: 50\nTotal: 1,050.00");
    expect(r.invoiceNo).toBe("INV-9"); expect(r.subtotal).toBe("1000.00"); expect(r.tax).toBe("50"); expect(r.total).toBe("1050.00");
    const b = extractInvoice("চালান নং ১২\nমোট: ৫০০");
    expect(b.total).toBe("500");
  });
  it("grammar, diff, table clustering, csv", () => {
    expect(grammar("i  went ,home").text).toBe("I went, home");
    const d = diffLines("a\nb", "a\nc");
    expect(d.map((x) => x.kind)).toEqual(["same", "del", "add"]);
    const rows = clusterTable([{ text: "A", x: 0, y: 0 }, { text: "B", x: 100, y: 1 }, { text: "1", x: 0, y: 20 }, { text: "2", x: 100, y: 20 }]);
    expect(rows).toEqual([["A", "B"], ["1", "2"]]);
    expect(toCsv([["a", 'b"c']])).toBe('"a","b""c"');
  });
});
