import { describe, expect, it } from "vitest";
import { moneyWords, invoiceTotals, mergeFields, parseCsv, template, TEMPLATE_KINDS, PAPER } from "../../src/modules/document-studio/model";

describe("document model", () => {
  it("money words bn/en", () => {
    expect(moneyWords(0)).toBe("শূন্য");
    expect(moneyWords(1050)).toBe("এক হাজার পঞ্চাশ");
    expect(moneyWords(123456)).toContain("লক্ষ");
    expect(moneyWords(10000000)).toContain("কোটি");
    expect(moneyWords(1050, "en")).toBe("one thousand fifty");
    expect(moneyWords(1234567, "en")).toContain("million");
  });
  it("invoice totals with tax and discount", () => {
    const rows = [["Item", "Qty", "Price"], ["A", "2", "500"], ["B", "1", "250"]];
    const t = invoiceTotals(rows, 5, 50);
    expect(t.sub).toBe(1250); expect(t.discount).toBe(50); expect(t.tax).toBe(60); expect(t.total).toBe(1260);
  });
  it("merge fields leaves unknown tokens", () => {
    expect(mergeFields("Hi {{name}}, {{x}}", { name: "Rahim" })).toBe("Hi Rahim, {{x}}");
  });
  it("csv parser handles quotes, commas, CRLF", () => {
    const rows = parseCsv('name,note\r\nRahim,"a,b"\r\n"Say ""hi""",ok\r\n');
    expect(rows).toEqual([{ name: "Rahim", note: "a,b" }, { name: 'Say "hi"', note: "ok" }]);
  });
  it("15 templates, physical card sizes", () => {
    expect(TEMPLATE_KINDS).toHaveLength(15);
    for (const k of TEMPLATE_KINDS) { const d = template(k); expect(d.pages.length).toBeGreaterThan(0); expect(d.pages[0].elements.length).toBeGreaterThan(0); }
    const id = template("id-card");
    expect(id.pages[0].widthMm).toBe(85.6); expect(id.pages[0].heightMm).toBe(54); expect(id.pages).toHaveLength(2);
    expect(template("visiting-card").pages[0].widthMm).toBe(90);
    expect(PAPER.A4).toEqual([210, 297]);
  });
});
