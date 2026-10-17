import { describe, expect, test } from "vitest";
import { computePreview } from "@/lib/preview";

describe("computePreview", () => {
  test("a short post is kept whole", () => {
    expect(computePreview("שלום\nעולם")).toEqual({ preview: "שלום\nעולם", hasMore: false });
  });

  test("cuts long text at a word boundary", () => {
    const { preview, hasMore } = computePreview("מילה ".repeat(200).trim());
    expect(hasMore).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(500);
    expect(preview.endsWith("מילה")).toBe(true);
  });

  test("caps the number of lines", () => {
    const { preview, hasMore } = computePreview(Array.from({ length: 30 }, (_, i) => i).join("\n"));
    expect(hasMore).toBe(true);
    expect(preview.split("\n")).toHaveLength(10);
  });

  test("one huge word is hard-cut", () => {
    const { preview, hasMore } = computePreview("x".repeat(900));
    expect(hasMore).toBe(true);
    expect(preview).toHaveLength(500);
  });
});
