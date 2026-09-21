import { describe, expect, it } from "vitest";
import { anchorColor, anchorPage, commentAnchorSchema } from "../schemas";

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
