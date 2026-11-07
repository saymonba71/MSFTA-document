import { describe, expect, it } from "vitest";
import { convert, dist, angle3, drawingNumber, snapPoint, dimLabel, PAPER_MM, type EngDoc } from "../../src/modules/engineering/engine";

const base: EngDoc = { unit: "mm", scale: 1, pxPerMm: 3, paper: "A4", dims: [], notes: [], title: {}, revisions: [], checklist: [], status: "Draft", stamps: [] };

describe("engineering", () => {
  it("unit conversions exact", () => {
    expect(convert(1, "in", "mm")).toBeCloseTo(25.4, 6);
    expect(convert(1, "ft", "mm")).toBeCloseTo(304.8, 6);
    expect(convert(100, "cm", "m")).toBe(1);
    expect(convert(1000, "mm", "m")).toBe(1);
    expect(convert(25.4, "mm", "in")).toBeCloseTo(1, 9);
  });
  it("distance and 3-point angle", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(angle3({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 6);
    expect(angle3({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180, 6);
  });
  it("drawing number pattern with padding", () => {
    expect(drawingNumber("{PROJ}-{DISC}-{SEQ:3}-R{REV}", { PROJ: "P01", DISC: "CIV", SEQ: 7, REV: "A" })).toBe("P01-CIV-007-RA");
  });
  it("grid + endpoint + 15° angle snap", () => {
    const g = snapPoint({ x: 14, y: 16 }, base, 5, false);
    expect(g.x).toBe(15); expect(g.y).toBe(15);
    const e: EngDoc = { ...base, dims: [{ id: "1", kind: "linear", a: { x: 100, y: 100 }, b: { x: 200, y: 100 }, offset: 10, arrow: "closed" }] };
    expect(snapPoint({ x: 103, y: 102 }, e, 0, false)).toEqual({ x: 100, y: 100 });
    expect(snapPoint({ x: 152, y: 101 }, e, 0, false)).toEqual({ x: 150, y: 100 });
    const a = snapPoint({ x: 100, y: 20 }, base, 0, true, { x: 0, y: 0 });
    expect(Math.atan2(a.y, a.x) * 180 / Math.PI).toBeCloseTo(15, 6);
  });
  it("dimension labels respect scale and unit; 100mm print test math", () => {
    const d = { id: "1", kind: "linear" as const, a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, offset: 10, arrow: "closed" as const };
    expect(dimLabel(d, base)).toBe("100.00 mm");
    expect(dimLabel(d, { ...base, scale: 50 })).toBe("5000.00 mm");
    expect(dimLabel(d, { ...base, unit: "cm" })).toBe("10.00 cm");
    // PDF export maps px -> pt with MM/pxPerMm: 300px * (2.8346456693/3) = 283.4645 pt = 100 mm ± 0.001
    const pt = 300 * (2.8346456693 / 3);
    expect(pt / 72 * 25.4).toBeCloseTo(100, 3);
    expect(PAPER_MM.A4).toEqual([210, 297]);
    expect(PAPER_MM.A0).toEqual([841, 1189]);
  });
});
