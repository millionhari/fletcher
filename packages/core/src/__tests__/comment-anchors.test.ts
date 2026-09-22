import { describe, expect, it } from "vitest";
import { anchorColor, anchorDisplayColor, anchorPage, commentAnchorSchema, strokesBounds } from "../schemas";

const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };

describe("comment anchors", () => {
  it("accepts both paged and page-less anchors", () => {
    expect(commentAnchorSchema.parse({ kind: "pdf", page: 3, rect })).toMatchObject({ page: 3 });
    expect(commentAnchorSchema.parse({ kind: "image", rect })).toMatchObject({ kind: "image" });
  });

  it("treats an image as the surface's only page", () => {
    expect(anchorPage({ kind: "pdf", page: 7, rect })).toBe(7);
    expect(anchorPage({ kind: "image", rect })).toBe(1);
  });

  it("rejects rects outside the normalized box", () => {
    expect(commentAnchorSchema.safeParse({ kind: "image", rect: { ...rect, x: 1.4 } }).success).toBe(false);
    expect(commentAnchorSchema.safeParse({ kind: "pdf", page: 0, rect }).success).toBe(false);
  });

  it("gives a comment the same colour every time", () => {
    const id = "0c9f3b2a-1111-2222-3333-444455556666";
    expect(anchorColor(id)).toBe(anchorColor(id));
    expect(anchorColor(id)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("drawn anchors", () => {
  it("accepts strokes on both anchor kinds and rejects an empty stroke list", () => {
    const stroke = { points: [[0.1, 0.1], [0.2, 0.3]] as [number, number][], color: "#dc2626", width: 0.004 };
    expect(commentAnchorSchema.safeParse({ kind: "image", rect: { x: 0, y: 0, w: 1, h: 1 }, strokes: [stroke] }).success).toBe(true);
    expect(commentAnchorSchema.safeParse({ kind: "pdf", page: 2, rect: { x: 0, y: 0, w: 1, h: 1 }, strokes: [stroke] }).success).toBe(true);
    expect(commentAnchorSchema.safeParse({ kind: "image", rect: { x: 0, y: 0, w: 1, h: 1 }, strokes: [] }).success).toBe(false);
  });

  it("bounds strokes with padding for the pen width, clamped to the surface", () => {
    const b = strokesBounds([{ points: [[0.2, 0.4], [0.5, 0.5]], color: "#000", width: 0.01 }, { points: [[0.99, 0.01]], color: "#000", width: 0.02 }]);
    expect(b.x).toBeCloseTo(0.18);
    expect(b.y).toBeCloseTo(0);
    expect(b.x + b.w).toBeCloseTo(1);
    expect(b.y + b.h).toBeCloseTo(0.52);
  });

  it("colours a drawn comment by its pen and a boxed one by hash", () => {
    expect(anchorDisplayColor("abc", { strokes: [{ points: [[0, 0]], color: "#059669", width: 0.01 }] })).toBe("#059669");
    expect(anchorDisplayColor("abc", null)).toBe(anchorColor("abc"));
  });
});
