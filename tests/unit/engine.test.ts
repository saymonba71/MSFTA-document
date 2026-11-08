import { describe, expect, it } from "vitest";
import { CATEGORIES, STYLE_PACKS, TEMPLATES, defaults, buildPrompt, enhance, adapt, rng, jaccard, variations, oneToMany, detectCategory } from "../../src/modules/prompt-studio/engine";

describe("prompt engine", () => {
  it("has 16 categories, style packs for each, 10 templates", () => {
    expect(CATEGORIES).toHaveLength(16);
    for (const c of CATEGORIES) expect(STYLE_PACKS[c.id].length).toBeGreaterThanOrEqual(8);
    expect(TEMPLATES).toHaveLength(10);
    expect(TEMPLATES.find((t) => t.name === "YouTube Thumbnail")?.size).toBe("1280×720");
  });
  it("detects category from bn/en/ar keywords", () => {
    expect(detectCategory("একটি লোগো ডিজাইন")).toBe("logo");
    expect(detectCategory("cinematic video of Dhaka")).toBe("video");
    expect(detectCategory("تصميم شعار")).toBe("logo");
    expect(detectCategory("a cat")).toBe("photography");
  });
  it("builds and enhances prompts with negative", () => {
    const s = defaults("photography", "a tiger");
    const p = buildPrompt(s);
    expect(p).toContain("a tiger");
    const e = enhance(s, "photography");
    expect(e.enhanced.length).toBeGreaterThan(p.length);
    expect(e.negative).toBeTruthy();
    expect(e.added.length).toBeGreaterThan(0);
  });
  it("adapts to all 6 targets", () => {
    const s = defaults("logo", "acme logo");
    const mj = adapt("prompt", "blurry", "midjourney", s);
    expect(mj).toContain("--ar 1:1"); expect(mj).toContain("--no blurry");
    expect(adapt("p", "n", "sd", s)).toContain("Negative prompt: n");
    expect(adapt("p", "n", "dalle", s)).toContain("Create an image");
    expect(adapt("p", "n", "video", s)).toContain("Camera movement");
    expect(adapt("p", "n", "coding", s)).toContain("Acceptance criteria");
    expect(adapt("p", "n", "business", s)).toContain("CTA");
  });
  it("seeded rng is reproducible", () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });
  it("jaccard basics", () => {
    expect(jaccard("a b c", "a b c")).toBe(1);
    expect(jaccard("a b", "c d")).toBe(0);
    expect(jaccard("", "")).toBe(0);
  });
  it("variations: reproducible, deduped, reaches requested counts", () => {
    const s = defaults("logo", "company logo for a modern tech brand");
    const v1 = variations(s, "logo", 20, 42, "all");
    const v2 = variations(s, "logo", 20, 42, "all");
    expect(v1).toEqual(v2);
    expect(v1.length).toBeGreaterThanOrEqual(5);
    expect(new Set(v1).size).toBe(v1.length);
    const v50 = variations(s, "photography", 50, 7, "all");
    expect(v50.length).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < v50.length; i++) for (let j = i + 1; j < v50.length; j++) expect(v50[i]).not.toBe(v50[j]);
    const styleOnly = variations(s, "logo", 10, 1, "style");
    expect(styleOnly.length).toBeGreaterThanOrEqual(5);
  });
  it("oneToMany yields a prompt per style pack", () => {
    const many = oneToMany(defaults("logo", "x"), "logo");
    expect(many).toHaveLength(STYLE_PACKS.logo.length);
    expect(many[0].prompt).toContain("material");
  });
});
