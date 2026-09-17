import { describe, expect, it } from "vitest";
import { ASSET_SPEC_BY_KEY, checkAgainstSpec } from "../assets/specs";

describe("checkAgainstSpec", () => {
  const ig = ASSET_SPEC_BY_KEY.profile_instagram!;
  it("accepts exact dimensions", () => {
    expect(checkAgainstSpec(ig, { width: 1000, height: 1000, bytes: 100_000 }).status).toBe("ok");
  });
  it("rejects wrong dimensions", () => {
    const r = checkAgainstSpec(ig, { width: 1200, height: 600, bytes: 100_000 });
    expect(r.status).toBe("wrong_dimensions");
    expect(r.message).toContain("1000×1000");
  });
  it("rejects oversize files", () => {
    expect(checkAgainstSpec(ig, { width: 1000, height: 1000, bytes: 10 * 1024 * 1024 }).status).toBe("too_large");
  });
  it("uses minimums for Amazon", () => {
    const amazon = ASSET_SPEC_BY_KEY.banner_amazon!;
    expect(checkAgainstSpec(amazon, { width: 2000, height: 1500 }).status).toBe("ok");
    expect(checkAgainstSpec(amazon, { width: 1800, height: 1500 }).status).toBe("wrong_dimensions");
  });
  it("checks canvas duration", () => {
    const canvas = ASSET_SPEC_BY_KEY.dsp_spotify_canvas!;
    expect(checkAgainstSpec(canvas, { width: 1080, height: 1920, durationSeconds: 12 }).status).toBe("too_long");
    expect(checkAgainstSpec(canvas, { width: 1080, height: 1920, durationSeconds: 5 }).status).toBe("ok");
  });
});
